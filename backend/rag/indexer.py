from __future__ import annotations

import os
from typing import Iterable

from ..embeddings import ChromaStore
from ..embeddings.provider import get_embedding_provider
from ..ingest import load_csv, load_docx, load_pdf
from ..ingest.models import MediaRecord


SUPPORTED_EXTENSIONS = {".csv", ".pdf", ".docx"}


def discover_files(data_dir: str) -> list[str]:
    files: list[str] = []
    for root, _, filenames in os.walk(data_dir):
        for filename in filenames:
            ext = os.path.splitext(filename)[1].lower()
            if ext in SUPPORTED_EXTENSIONS:
                files.append(os.path.join(root, filename))
    return files


def load_records(path: str) -> list[MediaRecord]:
    ext = os.path.splitext(path)[1].lower()
    if ext == ".csv":
        default_type = "movie" if "movie" in os.path.basename(path).lower() else "song"
        return load_csv(path, default_type=default_type)
    if ext == ".pdf":
        return load_pdf(path, default_type="document")
    if ext == ".docx":
        return load_docx(path, default_type="document")
    return []


def build_index(config: dict, data_dir: str) -> int:
    provider = get_embedding_provider(config)
    store = ChromaStore(persist_dir=config.get("CHROMA_DIR", "./data/chroma"))

    files = discover_files(data_dir)
    all_records: list[MediaRecord] = []
    for path in files:
        all_records.extend(load_records(path))

    seen: set[str] = set()
    unique_records: list[MediaRecord] = []
    for record in all_records:
        if record.record_id in seen:
            continue
        seen.add(record.record_id)
        unique_records.append(record)

    if not unique_records:
        return 0

    documents = [record.to_document() for record in unique_records]
    embeddings = provider.embed(documents)
    store.upsert_records(unique_records, embeddings)
    return len(unique_records)
