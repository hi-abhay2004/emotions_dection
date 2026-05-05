from __future__ import annotations

import os
from dotenv import load_dotenv
from pathlib import Path


def _get_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def _select_llm_provider(openai_enabled: bool, gemini_enabled: bool) -> str:
    if openai_enabled:
        return "openai"
    if gemini_enabled:
        return "gemini"
    return "none"


def _select_embedding_provider(
    openai_enabled: bool,
    gemini_enabled: bool,
    configured: str | None,
) -> str:
    if configured:
        return configured.strip().lower()
    if openai_enabled:
        return "openai"
    if gemini_enabled:
        return "gemini"
    return "local"


def _load_env_robust() -> None:
    """Load .env from common locations (cwd and project root), last one wins.

    This helps when the working directory differs (e.g., different runners).
    """
    # 1) Default search from current working directory
    load_dotenv()
    # 2) Explicitly load from project root (one level above backend/)
    try:
        project_root = Path(__file__).resolve().parents[1]
        dotenv_path = project_root / ".env"
        if dotenv_path.exists():
            load_dotenv(dotenv_path=dotenv_path, override=True)
    except Exception:
        pass


def load_config() -> dict:
    _load_env_robust()

    openai_enabled = _get_bool(os.getenv("OPENAI"), False)
    gemini_enabled = _get_bool(os.getenv("GEMINI"), False)

    return {
        "APP_ENV": os.getenv("APP_ENV", "dev"),
        "FLASK_DEBUG": _get_bool(os.getenv("FLASK_DEBUG"), True),
        "OPENAI": openai_enabled,
        "GEMINI": gemini_enabled,
        "LLM_PROVIDER": _select_llm_provider(openai_enabled, gemini_enabled),
        "EMBEDDING_PROVIDER": _select_embedding_provider(
            openai_enabled,
            gemini_enabled,
            os.getenv("EMBEDDING_PROVIDER"),
        ),
        "CHROMA_DIR": os.getenv("CHROMA_DIR", "./data/chroma"),
        "LOCAL_EMBEDDING_MODEL": os.getenv(
            "LOCAL_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
        ),
        "OPENAI_EMBEDDING_MODEL": os.getenv(
            "OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"
        ),
        "GEMINI_EMBEDDING_MODEL": os.getenv(
            "GEMINI_EMBEDDING_MODEL", "models/embedding-001"
        ),
        "OPENAI_CHAT_MODEL": os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini"),
        "GEMINI_CHAT_MODEL": os.getenv("GEMINI_CHAT_MODEL", "gemini-1.5-flash"),
    }
