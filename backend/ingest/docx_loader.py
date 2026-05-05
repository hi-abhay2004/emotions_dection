from __future__ import annotations

from typing import Iterable

from .models import MediaRecord
from .normalize import normalize_text

try:
    import docx
except ImportError:  # pragma: no cover - optional dependency
    docx = None


def load_docx(path: str, default_type: str = "document") -> list[MediaRecord]:
    if docx is None:
        raise RuntimeError("python-docx is not installed")

    document = docx.Document(path)
    text_parts = [para.text for para in document.paragraphs if para.text.strip()]
    content = normalize_text(" ".join(text_parts))
    if not content:
        return []

    record = MediaRecord(
        record_id=path,
        media_type=default_type,
        title=path.split("/")[-1],
        description=content,
        source=path,
    )
    return [record]
