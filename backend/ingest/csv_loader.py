from __future__ import annotations

import csv
import os
import re

from .models import MediaRecord
from .normalize import normalize_text, parse_float, split_and_normalize


EXPECTED_FIELDS = {
    "id",
    "record_id",
    "type",
    "media_type",
    "category",
    "title",
    "name",
    "movie",
    "movie_name",
    "song",
    "song_name",
    "track",
    "track_name",
    "description",
    "overview",
    "plot",
    "summary",
    "genre",
    "genres",
    "mood",
    "moods",
    "mood_tags",
    "tags",
    "emotion",
    "emotions",
    "valence",
    "arousal",
    "rating",
    "imdb_rating",
    "language",
    "explicit",
}


def load_csv(path: str, default_type: str | None = None) -> list[MediaRecord]:
    records: list[MediaRecord] = []
    with open(path, "r", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        for index, raw_row in enumerate(reader):
            if not raw_row:
                continue

            row = _normalize_row_keys(raw_row)

            title = _first_value(
                row,
                "title",
                "name",
                "movie",
                "movie_name",
                "song",
                "song_name",
                "track",
                "track_name",
            )
            if not title:
                continue

            record_id = (
                _first_value(row, "id", "record_id")
                or f"{os.path.basename(path)}:{index}:{title}"
            )

            media_type = _normalize_media_type(
                _first_value(row, "type", "media_type", "category")
                or default_type
                or _infer_type_from_filename(path)
            )

            description = _first_value(
                row,
                "description",
                "overview",
                "plot",
                "summary",
            )

            genre_value = _first_value(row, "genre", "genres")
            mood_value = _first_value(
                row,
                "mood_tags",
                "mood",
                "moods",
                "tags",
                "emotion",
                "emotions",
            )

            record = MediaRecord(
                record_id=normalize_text(record_id),
                media_type=media_type,
                title=normalize_text(title),
                description=normalize_text(description),
                genre=split_and_normalize(genre_value),
                mood_tags=split_and_normalize(mood_value),
                valence=_clamp(parse_float(_first_value(row, "valence")), -1.0, 1.0),
                arousal=_clamp(parse_float(_first_value(row, "arousal")), -1.0, 1.0),
                rating=parse_float(_first_value(row, "rating", "imdb_rating")),
                language=normalize_text(_first_value(row, "language")),
                source=path,
                extra=_extra_fields(row),
            )
            records.append(record)
    return records


def _normalize_row_keys(row: dict[str, str]) -> dict[str, str]:
    cleaned = {}
    for key, value in row.items():
        if key is None:
            continue
        normalized_key = key.strip().lower()
        normalized_key = re.sub(r"[^a-z0-9]+", "_", normalized_key).strip("_")
        cleaned[normalized_key] = value
    return cleaned


def _first_value(row: dict[str, str], *keys: str) -> str:
    for key in keys:
        value = row.get(key)
        value = normalize_text(value)
        if value:
            return value
    return ""


def _normalize_media_type(value: str | None) -> str:
    value = (normalize_text(value) or "").lower()
    if value in {"movie", "movies", "film", "films", "cinema"}:
        return "movie"
    if value in {"song", "songs", "music", "track", "tracks"}:
        return "song"
    return value or "unknown"


def _infer_type_from_filename(path: str) -> str:
    name = os.path.basename(path).lower()
    if "movie" in name or "film" in name:
        return "movie"
    if "song" in name or "music" in name or "track" in name:
        return "song"
    return "unknown"


def _extra_fields(row: dict[str, str]) -> dict[str, str]:
    extras: dict[str, str] = {}
    for key, value in row.items():
        if key in EXPECTED_FIELDS:
            continue
        normalized = normalize_text(value)
        if normalized:
            extras[key] = normalized
    return extras


def _clamp(value: float | None, lo: float, hi: float) -> float | None:
    if value is None:
        return None
    return max(lo, min(hi, value))
