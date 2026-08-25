"""Minimal insight read schema.

Phase 05 needs just enough to serialize the ``pending`` row created alongside
an interaction. Phase 06 extends this with summary/sentiment/action_items/
risks/provider once the LLM pipeline actually fills those columns.
"""

from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict

from app.models.enums import InsightStatus


class InsightOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: InsightStatus
    error_message: str | None
