from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from ..embeddings import ChromaStore
from ..embeddings.provider import get_cached_embedding_provider


@dataclass
class Recommendation:
    title: str
    media_type: str
    score: float
    reason: str
    metadata: dict[str, Any]


@dataclass
class RetrievalResult:
    movies: list[Recommendation]
    songs: list[Recommendation]
    query_text: str
    documents: list[dict[str, Any]]


def retrieve_recommendations(
    config: dict,
    mood_result: dict[str, Any],
    preferences: dict[str, Any] | None = None,
    top_k: int = 5,
) -> RetrievalResult:
    preferences = preferences or {}
    goal = preferences.get("goal", "match")
    content_type = preferences.get("content_type", "both")

    target_valence, target_arousal = _target_valence_arousal(mood_result, goal)
    query_text = _build_query_text(mood_result, target_valence, target_arousal, preferences)

    provider = get_cached_embedding_provider(
        config.get("EMBEDDING_PROVIDER", "local"),
        config.get("LOCAL_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"),
        config.get("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"),
        config.get("GEMINI_EMBEDDING_MODEL", "models/embedding-001"),
    )
    store = ChromaStore(persist_dir=config.get("CHROMA_DIR", "./data/chroma"))

    # Guard: empty index should report a clear error message
    try:
        count = getattr(store, "count", None)
        if callable(count) and count() == 0:
            raise RuntimeError(
                "Recommendation index is empty. Upload dataset and build index first."
            )
    except Exception:
        # If count not available, do a tiny probe query later; continue.
        pass

    query_embedding = provider.embed([query_text])[0]

    movies = []
    songs = []
    if content_type in {"both", "movies"}:
        movies = _query(store, query_embedding, "movie", top_k * 6)
    if content_type in {"both", "songs"}:
        songs = _query(store, query_embedding, "song", top_k * 6)
    documents = _query(store, query_embedding, "document", top_k)

    ranked_movies = _rank(movies, target_valence, target_arousal, preferences)
    ranked_songs = _rank(songs, target_valence, target_arousal, preferences)

    # If nothing ranked, surface a helpful error
    if not ranked_movies and not ranked_songs:
        raise RuntimeError(
            "No recommendations found. Ensure your index contains items typed as 'movie' or 'song' and that filters are not too restrictive."
        )

    return RetrievalResult(
        movies=ranked_movies[:top_k],
        songs=ranked_songs[:top_k],
        query_text=query_text,
        documents=_format_documents(documents),
    )


def _query(store: ChromaStore, embedding: list[float], media_type: str, top_k: int):
    return store.query(embedding, top_k=top_k, where={"type": media_type})


def _rank(
    query_result: dict[str, Any],
    target_valence: float,
    target_arousal: float,
    preferences: dict[str, Any],
) -> list[Recommendation]:
    results: list[Recommendation] = []
    metadatas = query_result.get("metadatas", [[]])[0]
    documents = query_result.get("documents", [[]])[0]
    distances = query_result.get("distances", [[]])[0]

    for metadata, document, distance in zip(metadatas, documents, distances):
        if not _passes_filters(metadata, preferences):
            continue
        score = _score_candidate(metadata, distance, target_valence, target_arousal, preferences)
        reason = _template_reason(metadata, target_valence, target_arousal)
        results.append(
            Recommendation(
                title=str(metadata.get("title", "")),
                media_type=str(metadata.get("type", "")),
                score=score,
                reason=reason,
                metadata=metadata,
            )
        )

    results.sort(key=lambda item: item.score, reverse=True)
    return results


def _score_candidate(
    metadata: dict[str, Any],
    distance: float,
    target_valence: float,
    target_arousal: float,
    preferences: dict[str, Any],
) -> float:
    semantic_score = 1.0 / (1.0 + float(distance))
    valence = _safe_float(metadata.get("valence"))
    arousal = _safe_float(metadata.get("arousal"))
    mood_distance = ((valence - target_valence) ** 2 + (arousal - target_arousal) ** 2) ** 0.5
    mood_score = 1.0 / (1.0 + mood_distance)
    rating_score = _safe_float(metadata.get("rating")) / 10.0
    preference_score = _preference_score(metadata, preferences)

    return 0.45 * semantic_score + 0.30 * mood_score + 0.15 * rating_score + 0.10 * preference_score


def _preference_score(metadata: dict[str, Any], preferences: dict[str, Any]) -> float:
    genres_pref = preferences.get("genres") or []
    if genres_pref:
        genres_raw = str(metadata.get("genre", ""))
        genres = [item.strip().lower() for item in genres_raw.split(",") if item.strip()]
        if not any(item.lower() in genres for item in genres_pref):
            return 0.1

    return 1.0


def _template_reason(metadata: dict[str, Any], target_valence: float, target_arousal: float) -> str:
    title = metadata.get("title", "This")
    tags = metadata.get("mood_tags", "")
    return (
        f"{title} aligns with a target valence of {target_valence:.2f} and arousal of "
        f"{target_arousal:.2f}. Tags: {tags}."
    )


def _target_valence_arousal(mood_result: dict[str, Any], goal: str) -> tuple[float, float]:
    valence = float(mood_result.get("valence", 0.0))
    arousal = float(mood_result.get("arousal", 0.0))

    if goal == "improve":
        return _shift_valence_arousal(mood_result.get("final_mood"), valence, arousal)

    return valence, arousal


def _shift_valence_arousal(mood_label: str | None, valence: float, arousal: float) -> tuple[float, float]:
    mood = (mood_label or "").lower()
    if mood in {"sad", "anxious"}:
        return min(valence + 0.6, 0.5), min(arousal + 0.3, 0.4)
    if mood in {"angry", "fear"}:
        return 0.4, 0.1
    if mood == "neutral":
        return 0.5, 0.5
    if mood in {"happy", "calm"}:
        return min(valence + 0.1, 0.9), min(arousal + 0.1, 0.8)
    return valence, arousal


def _build_query_text(
    mood_result: dict[str, Any],
    target_valence: float,
    target_arousal: float,
    preferences: dict[str, Any],
) -> str:
    mood = mood_result.get("final_mood", "")
    language = preferences.get("language")
    genres = preferences.get("genres") or []

    parts = [
        f"Recommend movies and songs for mood {mood}",
        f"Target valence {target_valence:.2f} and arousal {target_arousal:.2f}",
    ]
    if language:
        parts.append(f"Language {language}")
    if genres:
        parts.append(f"Genres {', '.join(genres)}")

    return ". ".join(parts) + "."


def _safe_float(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _passes_filters(metadata: dict[str, Any], preferences: dict[str, Any]) -> bool:
    language_pref = preferences.get("language")
    if language_pref and metadata.get("language"):
        if str(metadata.get("language", "")).lower() != str(language_pref).lower():
            return False

    exclude_genres = preferences.get("exclude_genres") or []
    if exclude_genres:
        genres_raw = str(metadata.get("genre", ""))
        genres = [item.strip().lower() for item in genres_raw.split(",") if item.strip()]
        if any(item.lower() in genres for item in exclude_genres):
            return False

    hide_explicit = preferences.get("hide_explicit")
    if hide_explicit:
        explicit = str(metadata.get("explicit", "")).lower()
        if explicit in {"true", "1", "yes"}:
            return False

    return True


def _format_documents(query_result: dict[str, Any]) -> list[dict[str, Any]]:
    documents = query_result.get("documents", [[]])[0]
    metadatas = query_result.get("metadatas", [[]])[0]
    results: list[dict[str, Any]] = []
    for metadata, document in zip(metadatas, documents):
        results.append({"metadata": metadata, "content": document})
    return results
