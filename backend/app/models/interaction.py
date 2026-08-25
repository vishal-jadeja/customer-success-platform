from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, Index, SmallInteger, String, Text, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TIMESTAMP

from app.db import Base, TimestampMixin
from app.models.enums import InteractionType, db_enum_values

if TYPE_CHECKING:
    from app.models.customer import Customer
    from app.models.insight import Insight
    from app.models.user import User


class Interaction(TimestampMixin, Base):
    __tablename__ = "interactions"
    __table_args__ = (
        Index("ix_interactions_customer_id_occurred_at", "customer_id", text("occurred_at DESC")),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # "logged by" — RESTRICT so history is never silently lost with its author.
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    type: Mapped[InteractionType] = mapped_column(
        Enum(InteractionType, name="interaction_type", values_callable=db_enum_values),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=False)  # AI input; min 20 chars (schema)
    occurred_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    duration_minutes: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)

    customer: Mapped[Customer] = relationship(back_populates="interactions")
    user: Mapped[User] = relationship()
    insight: Mapped[Insight | None] = relationship(
        back_populates="interaction",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
