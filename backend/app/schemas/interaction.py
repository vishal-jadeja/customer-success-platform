from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import InteractionType
from app.schemas.insight import InsightOut


class InteractionCreate(BaseModel):
    customer_id: uuid.UUID
    type: InteractionType
    title: str = Field(min_length=1, max_length=200)
    notes: str = Field(min_length=20)  # AI input; short notes can't produce a useful insight
    occurred_at: datetime
    duration_minutes: int | None = Field(default=None, ge=0, le=1440)


class InteractionUpdate(BaseModel):
    type: InteractionType | None = None
    title: str | None = Field(default=None, min_length=1, max_length=200)
    notes: str | None = Field(default=None, min_length=20)
    occurred_at: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=0, le=1440)


class InteractionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    customer_id: uuid.UUID
    user_id: uuid.UUID
    type: InteractionType
    title: str
    notes: str
    occurred_at: datetime
    duration_minutes: int | None
    created_at: datetime
    updated_at: datetime
    insight: InsightOut | None = None
