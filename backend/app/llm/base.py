"""LLM provider contract + shared OpenAI-compatible httpx call shape.

Groq and Cerebras (``llm/groq.py``, ``llm/cerebras.py``) differ only in
base URL, API key, and model — everything else (request shape, error
mapping) lives here once.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

import httpx


class LLMError(Exception):
    """Base for every typed LLM error. The client catches this family and
    advances to the next provider — it never propagates past the client."""


class LLMTimeoutError(LLMError):
    pass


class LLMHTTPError(LLMError):
    def __init__(self, status_code: int, body: str) -> None:
        super().__init__(f"HTTP {status_code}: {body[:500]}")
        self.status_code = status_code
        self.body = body


class LLMAuthError(LLMHTTPError):
    """401/403 — bad credentials. Never retried on the same provider."""


@dataclass
class LLMResult:
    content: str
    provider: str
    model: str
    latency_ms: int


class LLMProvider(Protocol):
    name: str
    model: str

    def complete(self, system: str, user: str, *, timeout: float) -> str:
        """Return the raw response content (not yet parsed as JSON)."""
        ...


class OpenAICompatibleProvider:
    """One httpx call shape for any OpenAI-compatible ``/chat/completions`` API."""

    name: str
    base_url: str

    def __init__(self, api_key: str, model: str) -> None:
        self.api_key = api_key
        self.model = model

    def complete(self, system: str, user: str, *, timeout: float) -> str:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
        }
        try:
            with httpx.Client(timeout=timeout) as client:
                resp = client.post(self.base_url, json=payload, headers=headers)
        except httpx.TimeoutException as exc:
            raise LLMTimeoutError(f"{self.name} timed out after {timeout:.1f}s") from exc
        except httpx.HTTPError as exc:
            raise LLMError(f"{self.name} request failed: {exc}") from exc

        if resp.status_code in (401, 403):
            raise LLMAuthError(resp.status_code, resp.text)
        if resp.status_code >= 400:
            raise LLMHTTPError(resp.status_code, resp.text)

        data = resp.json()
        return data["choices"][0]["message"]["content"]
