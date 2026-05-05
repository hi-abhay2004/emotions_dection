from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class MediaRecord:
    record_id: str
    media_type: str
    title: str
    description: str
    genre: list[str] = field(default_factory=list)
    mood_tags: list[str] = field(default_factory=list)
    valence: float | None = None
    arousal: float | None = None
    rating: float | None = None
    language: str | None = None
    source: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    def to_document(self) -> str:
        parts = [
            f"Title: {self.title}",
            f"Type: {self.media_type}",
        ]
        if self.genre:
            parts.append(f"Genre: {', '.join(self.genre)}")
        if self.description:
            parts.append(f"Description: {self.description}")
        if self.mood_tags:
            parts.append(f"Mood Tags: {', '.join(self.mood_tags)}")
        if self.valence is not None:
            parts.append(f"Valence: {self.valence}")
        if self.arousal is not None:
            parts.append(f"Arousal: {self.arousal}")
        if self.rating is not None:
            parts.append(f"Rating: {self.rating}")
        if self.language:
            parts.append(f"Language: {self.language}")
        return ". ".join(parts) + "."

    def to_metadata(self) -> dict[str, Any]:
        return {
            "record_id": self.record_id,
            "type": self.media_type,
            "title": self.title,
            "genre": self.genre,
            "mood_tags": self.mood_tags,
            "valence": self.valence,
            "arousal": self.arousal,
            "rating": self.rating,
            "language": self.language,
            "source": self.source,
            **self.extra,
        }
