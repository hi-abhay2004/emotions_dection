from __future__ import annotations

from typing import Any

try:
    import chromadb
except ImportError as exc:  # pragma: no cover - optional dependency
    chromadb = None

from ..ingest.models import MediaRecord


class ChromaStore:
    def __init__(self, persist_dir: str, collection_name: str = "media"):
        if chromadb is None:
            raise RuntimeError("chromadb is not installed")

        self._client = chromadb.PersistentClient(path=persist_dir)
        self._collection = self._client.get_or_create_collection(name=collection_name)

    def count(self) -> int:
        """Return number of items in the collection."""
        try:
            return int(self._collection.count())
        except Exception:
            return 0

    def upsert_records(self, records: list[MediaRecord], embeddings: list[list[float]]) -> None:
        if len(records) != len(embeddings):
            raise ValueError("records and embeddings must be the same length")

        ids = [record.record_id for record in records]
        documents = [record.to_document() for record in records]
        metadatas = [self._sanitize_metadata(record.to_metadata()) for record in records]

        self._collection.upsert(
            ids=ids,
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas,
        )

    def query(self, query_embedding: list[float], top_k: int = 10, where: dict | None = None):
        return self._collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            where=where,
            include=["documents", "metadatas", "distances"],
        )

    def type_counts(self, limit: int = 500) -> dict[str, int]:
        """Return an approximate breakdown of item types by scanning up to `limit` entries."""
        try:
            result = self._collection.get(include=["metadatas"], limit=limit)
            metas = result.get("metadatas") or []
            # chromadb returns a list of metadatas (not nested) for `get`
            counts: dict[str, int] = {}
            for md in metas:
                t = str((md or {}).get("type", "unknown")).lower()
                counts[t] = counts.get(t, 0) + 1
            return counts
        except Exception:
            return {}

    @staticmethod
    def _sanitize_metadata(metadata: dict[str, Any]) -> dict[str, Any]:
        cleaned: dict[str, Any] = {}
        for key, value in metadata.items():
            if value is None:
                continue
            if isinstance(value, list):
                cleaned[key] = ", ".join([str(item) for item in value])
            else:
                cleaned[key] = value
        return cleaned
