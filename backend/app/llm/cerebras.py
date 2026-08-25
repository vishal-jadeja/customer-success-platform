from __future__ import annotations

from app.llm.base import OpenAICompatibleProvider


class CerebrasProvider(OpenAICompatibleProvider):
    name = "cerebras"
    base_url = "https://api.cerebras.ai/v1/chat/completions"
