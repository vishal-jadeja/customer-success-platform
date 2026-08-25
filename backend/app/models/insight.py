from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import Enum, ForeignKey, Integer, SmallInteger, String, Text, Uuid, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, TimestampMixin
from app.models.enums import InsightStatus, Sentiment, db_enum_values

if TYPE_CHECKING:
    from app.models.interaction import Interaction


class Insight(TimestampMixin, Base):
    """AI-generated insight, exactly one per interaction.

    Created as ``pending`` in the same transaction as the interaction; updated
    to ``completed`` / ``failed`` after the LLM call. Seeded rows carry
    ``provider='seed'`` and never impersonate a real provider.
    """

    __tablename__ = "insights"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    interaction_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("interactions.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    status: Mapped[InsightStatus] = mapped_column(
        Enum(InsightStatus, name="insight_status", values_callable=db_enum_values),
        nullable=False,
        default=InsightStatus.pending,
        server_default=text("'pending'"),
    )
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    sentiment: Mapped[Sentiment | None] = mapped_column(
        Enum(Sentiment, name="sentiment", values_callable=db_enum_values), nullable=True
    )
    action_items: Mapped[list[Any]] = mapped_column(
        JSONB, nullable=False, default=list, server_default=text("'[]'::jsonb")
    )
    risks: Mapped[list[Any]] = mapped_column(
        JSONB, nullable=False, default=list, server_default=text("'[]'::jsonb")
    )
    raw_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    provider: Mapped[str | None] = mapped_column(String(32), nullable=True)
    model: Mapped[str | None] = mapped_column(String(80), nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    attempts: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default=text("0")
    )

    interaction: Mapped[Interaction] = relationship(back_populates="insight")
