"""All SQLAlchemy access to ``interactions`` lives here.

Scope is inherited from the parent customer: join to ``customers`` and reuse
``apply_customer_scope`` (Phase 04) on that join — never reimplement ownership
here, or the two scope checks can drift apart.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import Customer, Insight, Interaction, InteractionType, Sentiment
from app.models import User as UserModel
from app.repositories.customer import apply_customer_scope

_LOAD_INSIGHT = selectinload(Interaction.insight)


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class InteractionRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def _scoped_query(
        self,
        user: UserModel,
        *,
        customer_id: uuid.UUID | None,
        type_: InteractionType | None,
        sentiment: Sentiment | None,
        date_from: datetime | None,
        date_to: datetime | None,
        q: str | None,
    ) -> Select[Any]:
        stmt = select(Interaction).join(Customer, Interaction.customer_id == Customer.id)
        stmt = apply_customer_scope(stmt, user)

        if customer_id is not None:
            stmt = stmt.where(Interaction.customer_id == customer_id)
        if type_ is not None:
            stmt = stmt.where(Interaction.type == type_)
        if sentiment is not None:
            stmt = stmt.join(Insight, Insight.interaction_id == Interaction.id).where(
                Insight.sentiment == sentiment
            )
        if date_from is not None:
            stmt = stmt.where(Interaction.occurred_at >= date_from)
        if date_to is not None:
            stmt = stmt.where(Interaction.occurred_at <= date_to)
        if q:
            pattern = f"%{_escape_like(q)}%"
            stmt = stmt.where(
                or_(
                    Interaction.title.ilike(pattern, escape="\\"),
                    Interaction.notes.ilike(pattern, escape="\\"),
                )
            )
        return stmt

    def list(
        self,
        user: UserModel,
        *,
        customer_id: uuid.UUID | None = None,
        type_: InteractionType | None = None,
        sentiment: Sentiment | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        q: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Interaction], int]:
        stmt = self._scoped_query(
            user,
            customer_id=customer_id,
            type_=type_,
            sentiment=sentiment,
            date_from=date_from,
            date_to=date_to,
            q=q,
        )
        total = self.db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        items = list(
            self.db.scalars(
                stmt.order_by(Interaction.occurred_at.desc(), Interaction.id)
                .offset((page - 1) * page_size)
                .limit(page_size)
                .options(_LOAD_INSIGHT)
            )
        )
        return items, int(total)

    def get(self, interaction_id: uuid.UUID) -> Interaction | None:
        # Unscoped by design: the service checks existence (404) before access
        # (403), same pattern as CustomerRepository.get.
        return self.db.scalar(
            select(Interaction)
            .where(Interaction.id == interaction_id)
            .options(_LOAD_INSIGHT, selectinload(Interaction.customer))
        )

    def create(self, **fields: Any) -> Interaction:
        """Insert the interaction + its pending insight row in one flush.

        Both rows are added to the session here; the caller commits once, so
        interaction and insight land in the same transaction (master plan
        hard rule) with no LLM call in between.
        """
        interaction = Interaction(**fields)
        self.db.add(interaction)
        self.db.flush()  # need interaction.id for the insight FK
        insight = Insight(interaction_id=interaction.id)
        self.db.add(insight)
        self.db.flush()
        interaction.insight = insight
        return interaction

    def update(self, interaction: Interaction, **fields: Any) -> Interaction:
        for key, value in fields.items():
            setattr(interaction, key, value)
        self.db.flush()
        return interaction

    def delete(self, interaction: Interaction) -> None:
        self.db.delete(interaction)
        self.db.flush()
