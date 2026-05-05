from __future__ import annotations

from typing import Any

from ..llm import get_llm_provider
from .retriever import RetrievalResult


def explain_recommendations(config: dict, result: RetrievalResult) -> dict[str, list[str]]:
    provider = get_llm_provider(config)
    if provider is None:
        return {
            "movies": [item.reason for item in result.movies],
            "songs": [item.reason for item in result.songs],
        }

    context = _build_context(result)
    prompt = (
        "Using only the provided metadata, write short reasons for each item. "
        "Do not invent details. Return JSON with keys 'movies' and 'songs' containing arrays.\n\n"
        f"Metadata:\n{context}"
    )

    try:
        response = provider.generate(prompt)
    except Exception:
        return {
            "movies": [item.reason for item in result.movies],
            "songs": [item.reason for item in result.songs],
        }

    return _safe_parse_json(response, result)


def _build_context(result: RetrievalResult) -> str:
    lines: list[str] = []
    for item in result.movies:
        lines.append(f"Movie: {item.title}. Metadata: {item.metadata}")
    for item in result.songs:
        lines.append(f"Song: {item.title}. Metadata: {item.metadata}")
    for doc in result.documents:
        lines.append(f"Document: {doc.get('metadata')}. Content: {doc.get('content')}")
    return "\n".join(lines)


def _safe_parse_json(text: str, result: RetrievalResult) -> dict[str, list[str]]:
    import json

    try:
        payload = json.loads(_extract_json(text))
        if not isinstance(payload, dict):
            raise ValueError("Invalid JSON")
        movies = payload.get("movies")
        songs = payload.get("songs")
        if not isinstance(movies, list) or not isinstance(songs, list):
            raise ValueError("Missing keys")
        return {
            "movies": [str(item) for item in movies],
            "songs": [str(item) for item in songs],
        }
    except Exception:
        return {
            "movies": [item.reason for item in result.movies],
            "songs": [item.reason for item in result.songs],
        }


def _extract_json(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        cleaned = cleaned.replace("json", "", 1).strip()

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        return cleaned[start : end + 1]

    return cleaned
