from __future__ import annotations

import re
from typing import Iterable


def normalize_list(items: Iterable[str] | None) -> list[str]:
    if not items:
        return []
    cleaned: list[str] = []
    for item in items:
        value = re.sub(r"\s+", " ", str(item)).strip().strip("\"'")
        value = value.lower()
        if value:
            cleaned.append(value)
    return cleaned


def split_and_normalize(value: str | None) -> list[str]:
    if not value:
        return []
    parts = re.split(r"[|,;/]", value)
    return normalize_list(parts)


def parse_float(value: str | None) -> float | None:
    if value is None:
        return None
    try:
        return float(str(value).strip())
    except ValueError:
        return None


def normalize_text(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()
