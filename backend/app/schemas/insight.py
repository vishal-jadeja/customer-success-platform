"""``InsightPayload`` is the LLM's JSON contract (validated after parsing);
``InsightOut`` is the stored-row read schema.
"""

from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import InsightStatus, Sentiment

_VALID_SENTIMENTS = {s.value for s in Sentiment}


class InsightPayload(BaseModel):
    summary: str = Field(min_length=1)
    sentiment: str
    action_items: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)

    @field_validator("sentiment", mode="after")
    @classmethod
    def _normalize_sentiment(cls, v: str) -> str:
        # Models return "Positive" / "POSITIVE" / "mixed" / etc. Lowercase and
        # map anything we don't recognize to neutral — never fail validation
        # over sentiment alone.
        v = v.strip().lower()
        return v if v in _VALID_SENTIMENTS else "neutral"


class InsightOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: InsightStatus
    summary: str | None
    sentiment: Sentiment | None
    action_items: list[str]
    risks: list[str]
    error_message: str | None
    provider: str | None
    model: str | None
    latency_ms: int | None
    attempts: int
