from __future__ import annotations

from typing import Iterable

from .models import MediaRecord
from .normalize import normalize_text

try:
    from pypdf import PdfReader
except ImportError:  # pragma: no cover - optional dependency
    PdfReader = None


def load_pdf(path: str, default_type: str = "document") -> list[MediaRecord]:
    if PdfReader is None:
        raise RuntimeError("pypdf is not installed")

    reader = PdfReader(path)
    text_parts: list[str] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        if text.strip():
            text_parts.append(text)

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
