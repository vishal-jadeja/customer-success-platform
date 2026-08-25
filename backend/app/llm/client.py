"""Failover across configured LLM providers with one overall time budget.

Two timeouts stack: a per-call timeout (``LLM_TIMEOUT_SECONDS``) and an
overall deadline (``LLM_TOTAL_BUDGET_SECONDS``) that every call — including
repair calls — draws down from. Without the overall deadline the naive worst
case (2 providers x (call + repair)) blows past the 45s client-side cap.
"""

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass

from pydantic import ValidationError

from app.core.exceptions import ExternalServiceError
from app.core.logging import get_logger
from app.llm.base import LLMAuthError, LLMError, LLMProvider, LLMTimeoutError
from app.llm.prompts import REPAIR_INSTRUCTION, SYSTEM_PROMPT, build_user_prompt
from app.schemas.insight import InsightPayload

logger = get_logger(__name__)

_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)

# A repair call is only worth attempting if this much of the overall budget
# remains — otherwise it would just eat the deadline without a real chance
# to complete.
MIN_REPAIR_BUDGET_SECONDS = 8.0


@dataclass
class GenerationResult:
    payload: InsightPayload
    provider: str
    model: str
    latency_ms: int
    raw: str


def _extract_json(raw: str) -> dict:
    """``json.loads`` first; on failure, pull the first ```-fenced block and retry."""
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    match = _FENCE_RE.search(raw)
    if not match:
        raise json.JSONDecodeError("no JSON object found in response", raw, 0)
    return json.loads(match.group(1))


class FailoverLLMClient:
    def __init__(
        self,
        providers: list[LLMProvider],
        *,
        per_call_timeout: float,
        total_budget: float,
    ) -> None:
        self.providers = providers
        self.per_call_timeout = per_call_timeout
        self.total_budget = total_budget

    def _parse_and_validate(self, raw: str) -> InsightPayload | None:
        try:
            data = _extract_json(raw)
        except json.JSONDecodeError:
            return None
        try:
            return InsightPayload.model_validate(data)
        except ValidationError:
            return None

    def generate(
        self, *, notes: str, customer_name: str, customer_status: str
    ) -> GenerationResult:
        if not self.providers:
            raise ExternalServiceError("No LLM provider configured")

        deadline = time.monotonic() + self.total_budget
        user_prompt = build_user_prompt(
            notes=notes, customer_name=customer_name, customer_status=customer_status
        )
        last_raw = ""

        for provider in self.providers:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                logger.warning("LLM budget exhausted before trying %s", provider.name)
                break

            provider_start = time.monotonic()
            timeout = min(self.per_call_timeout, remaining)
            try:
                raw = provider.complete(SYSTEM_PROMPT, user_prompt, timeout=timeout)
            except LLMTimeoutError as exc:
                logger.warning("LLM %s timed out: %s", provider.name, exc)
                continue
            except LLMAuthError as exc:
                logger.error("LLM %s bad credentials: %s", provider.name, exc)
                continue
            except LLMError as exc:
                logger.warning("LLM %s request failed: %s", provider.name, exc)
                continue

            last_raw = raw
            payload = self._parse_and_validate(raw)

            if payload is None:
                remaining = deadline - time.monotonic()
                if remaining >= MIN_REPAIR_BUDGET_SECONDS:
                    repair_timeout = min(self.per_call_timeout, remaining)
                    try:
                        raw = provider.complete(
                            SYSTEM_PROMPT,
                            REPAIR_INSTRUCTION.format(broken=raw),
                            timeout=repair_timeout,
                        )
                        last_raw = raw
                        payload = self._parse_and_validate(raw)
                    except LLMError as exc:
                        logger.warning("LLM %s repair call failed: %s", provider.name, exc)

            if payload is None:
                logger.warning("LLM %s returned unparseable JSON, advancing", provider.name)
                continue

            latency_ms = int((time.monotonic() - provider_start) * 1000)
            return GenerationResult(
                payload=payload,
                provider=provider.name,
                model=provider.model,
                latency_ms=latency_ms,
                raw=last_raw,
            )

        raise ExternalServiceError(
            "All LLM providers failed or timed out",
            details={"raw_response": last_raw} if last_raw else None,
        )
