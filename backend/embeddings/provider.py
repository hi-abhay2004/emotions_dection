from __future__ import annotations

import os
from functools import lru_cache
from typing import Iterable, Protocol


class EmbeddingProvider(Protocol):
    def embed(self, texts: list[str]) -> list[list[float]]:
        ...


class LocalEmbeddingProvider:
    def __init__(self, model_name: str):
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError as exc:
            raise RuntimeError("sentence-transformers is not installed") from exc

        self._model = SentenceTransformer(model_name)

    def embed(self, texts: list[str]) -> list[list[float]]:
        vectors = self._model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
        return [vector.tolist() for vector in vectors]


class OpenAIEmbeddingProvider:
    def __init__(self, model_name: str):
        try:
            from openai import OpenAI
        except ImportError as exc:
            raise RuntimeError("openai is not installed") from exc

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is not set")

        # Construct a safe httpx client to avoid proxy kwarg incompatibility
        try:
            import httpx  # type: ignore
            http_client = httpx.Client(timeout=30.0, http2=True)
            self._client = OpenAI(api_key=api_key, http_client=http_client)
        except Exception:
            self._client = OpenAI(api_key=api_key)
        self._model_name = model_name

    def embed(self, texts: list[str]) -> list[list[float]]:
        response = self._client.embeddings.create(model=self._model_name, input=texts)
        return [item.embedding for item in response.data]


class GeminiEmbeddingProvider:
    def __init__(self, model_name: str):
        try:
            import google.generativeai as genai
        except ImportError as exc:
            raise RuntimeError("google-generativeai is not installed") from exc

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is not set")

        genai.configure(api_key=api_key)
        self._genai = genai
        self._model_name = model_name

    def embed(self, texts: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        for text in texts:
            response = self._genai.embed_content(
                model=self._model_name,
                content=text,
                task_type="retrieval_document",
            )
            vectors.append(response["embedding"])
        return vectors


def get_embedding_provider(config: dict) -> EmbeddingProvider:
    provider = config.get("EMBEDDING_PROVIDER", "local")
    if provider == "openai":
        return OpenAIEmbeddingProvider(
            config.get("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
        )
    if provider == "gemini":
        return GeminiEmbeddingProvider(
            config.get("GEMINI_EMBEDDING_MODEL", "models/embedding-001")
        )

    return LocalEmbeddingProvider(
        config.get("LOCAL_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    )


@lru_cache(maxsize=4)
def get_cached_embedding_provider(
    provider: str,
    local_model: str,
    openai_model: str,
    gemini_model: str,
) -> EmbeddingProvider:
    config = {
        "EMBEDDING_PROVIDER": provider,
        "LOCAL_EMBEDDING_MODEL": local_model,
        "OPENAI_EMBEDDING_MODEL": openai_model,
        "GEMINI_EMBEDDING_MODEL": gemini_model,
    }
    return get_embedding_provider(config)
