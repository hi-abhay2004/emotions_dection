from __future__ import annotations

from typing import Any

from ..llm import get_llm_provider


def generate_caption(config: dict, mood: str, movie: str | None, song: str | None) -> dict[str, str]:
    provider = get_llm_provider(config)
    fallback = {
        "top_text": f"WHEN YOU FEEL {mood.upper()}",
        "bottom_text": "AND A SMALL SPARK OF HOPE SHOWS UP",
    }
    if provider is None:
        return fallback

    movie_text = movie or "a movie"
    song_text = song or "a song"
    prompt = (
        "Create a short, kind meme caption. Keep it supportive and light. "
        "Use the mood and media context. Return JSON with top_text and bottom_text.\n\n"
        f"Mood: {mood}\nMovie: {movie_text}\nSong: {song_text}"
    )

    try:
        response = provider.generate(prompt)
        return _safe_parse_json(response, fallback)
    except Exception:
        return fallback


def _safe_parse_json(text: str, fallback: dict[str, str]) -> dict[str, str]:
    import json

    try:
        payload = json.loads(_extract_json(text))
        top = str(payload.get("top_text", "")).strip()
        bottom = str(payload.get("bottom_text", "")).strip()
        if not top or not bottom:
            return fallback
        return {"top_text": top, "bottom_text": bottom}
    except Exception:
        return fallback


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
