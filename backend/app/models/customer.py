from __future__ import annotations

import uuid
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    SmallInteger,
    String,
    Uuid,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, TimestampMixin
from app.models.enums import CustomerStatus, db_enum_values

if TYPE_CHECKING:
    from app.models.interaction import Interaction
    from app.models.user import User


class Customer(TimestampMixin, Base):
    __tablename__ = "customers"
    __table_args__ = (
        CheckConstraint("health_score BETWEEN 0 AND 100", name="health_score_range"),
        Index("ix_customers_owner_id_status", "owner_id", "status"),
        Index("ix_customers_created_at", text("created_at DESC")),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    company: Mapped[str] = mapped_column(String(160), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(80), nullable=True)
    status: Mapped[CustomerStatus] = mapped_column(
        Enum(CustomerStatus, name="customer_status", values_callable=db_enum_values),
        nullable=False,
        default=CustomerStatus.onboarding,
        server_default=text("'onboarding'"),
    )
    health_score: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=50, server_default=text("50")
    )
    arr: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    # RESTRICT: deleting a user who still owns customers is an IntegrityError
    # (-> 409 in Phase 03), never a silent orphaning or cascade.
    owner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    owner: Mapped[User] = relationship(back_populates="customers")
    interactions: Mapped[list[Interaction]] = relationship(
        back_populates="customer",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="desc(Interaction.occurred_at)",
    )
