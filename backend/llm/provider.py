from __future__ import annotations

import os
from typing import Protocol


class LLMProvider(Protocol):
    def generate(self, prompt: str) -> str:
        ...


class OpenAIProvider:
    def __init__(self, model_name: str):
        """Create an OpenAI client in a way that's compatible with httpx>=0.27 changes.

        Some OpenAI client versions attempt to instantiate httpx.Client with a
        deprecated 'proxies' kwarg, which breaks with newer httpx. We avoid that
        code path by constructing our own httpx.Client and passing it to OpenAI.
        """
        try:
            from openai import OpenAI
        except ImportError as exc:
            raise RuntimeError("openai is not installed") from exc

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is not set")

        # Avoid OpenAI creating its own client (which may pass unsupported kwargs)
        try:
            import httpx  # type: ignore
            http_client = httpx.Client(timeout=30.0, http2=True)
            self._client = OpenAI(api_key=api_key, http_client=http_client)
        except Exception:
            # Fallback to default construction if httpx is unavailable
            self._client = OpenAI(api_key=api_key)
        self._model_name = model_name

    def generate(self, prompt: str) -> str:
        response = self._client.chat.completions.create(
            model=self._model_name,
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.4,
        )
        return response.choices[0].message.content or ""


class GeminiProvider:
    def __init__(self, model_name: str):
        try:
            import google.generativeai as genai
        except ImportError as exc:
            raise RuntimeError("google-generativeai is not installed") from exc

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is not set")

        genai.configure(api_key=api_key)
        self._model = genai.GenerativeModel(model_name)

    def generate(self, prompt: str) -> str:
        response = self._model.generate_content(prompt)
        return response.text or ""


def get_llm_provider(config: dict) -> LLMProvider | None:
    provider = config.get("LLM_PROVIDER", "none")
    if provider == "openai":
        return OpenAIProvider(config.get("OPENAI_CHAT_MODEL", "gpt-4o-mini"))
    if provider == "gemini":
        return GeminiProvider(config.get("GEMINI_CHAT_MODEL", "gemini-1.5-flash"))
    return None
