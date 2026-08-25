"""All SQLAlchemy access to ``customers`` lives here.

``apply_customer_scope`` is the single scope function (master plan): every
list/get of customers (and, via parent join, interactions in Phase 05) must
route through it. A hand-written ``select(Customer)`` elsewhere is a data leak.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import ValidationError
from app.models import Customer, Interaction, Role, User

_SORT_COLUMNS = {
    "created_at": Customer.created_at,
    "name": Customer.name,
    "health_score": Customer.health_score,
    "arr": Customer.arr,
}


def apply_customer_scope(stmt: Select[Any], user: User) -> Select[Any]:
    if user.role in (Role.admin, Role.manager):
        return stmt
    return stmt.where(Customer.owner_id == user.id)


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class CustomerRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list(
        self,
        user: User,
        *,
        q: str | None = None,
        status: Any = None,
        owner_id: uuid.UUID | None = None,
        industry: str | None = None,
        min_health: int | None = None,
        max_health: int | None = None,
        sort: str = "created_at",
        order: str = "desc",
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Customer], int]:
        stmt = apply_customer_scope(select(Customer), user)

        if q:
            pattern = f"%{_escape_like(q)}%"
            stmt = stmt.where(
                or_(
                    Customer.name.ilike(pattern, escape="\\"),
                    Customer.company.ilike(pattern, escape="\\"),
                )
            )
        if status is not None:
            stmt = stmt.where(Customer.status == status)
        if owner_id is not None:
            stmt = stmt.where(Customer.owner_id == owner_id)
        if industry:
            stmt = stmt.where(Customer.industry.ilike(f"%{_escape_like(industry)}%", escape="\\"))
        if min_health is not None:
            stmt = stmt.where(Customer.health_score >= min_health)
        if max_health is not None:
            stmt = stmt.where(Customer.health_score <= max_health)

        total = self.db.scalar(select(func.count()).select_from(stmt.subquery())) or 0

        column = _SORT_COLUMNS.get(sort)
        if column is None:
            raise ValidationError(f"Invalid sort field: {sort!r}")
        ordered = column.desc().nulls_last() if order == "desc" else column.asc().nulls_last()

        items = list(
            self.db.scalars(
                stmt.order_by(ordered, Customer.id)
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        )
        return items, int(total)

    def get(self, customer_id: uuid.UUID) -> Customer | None:
        # Unscoped by design: the service checks existence (404) before access
        # (403), so a non-owned row still 404s correctly and an owned-but-wrong
        # -role row 403s rather than leaking a false 404.
        return self.db.scalar(
            select(Customer)
            .where(Customer.id == customer_id)
            .options(selectinload(Customer.owner))
        )

    def count_interactions(self, customer_id: uuid.UUID) -> int:
        return (
            self.db.scalar(
                select(func.count())
                .select_from(Interaction)
                .where(Interaction.customer_id == customer_id)
            )
            or 0
        )

    def create(self, **fields: Any) -> Customer:
        """Add + flush. An ``IntegrityError`` (duplicate email) propagates to the 409 handler."""
        customer = Customer(**fields)
        self.db.add(customer)
        self.db.flush()
        return customer

    def update(self, customer: Customer, **fields: Any) -> Customer:
        for key, value in fields.items():
            setattr(customer, key, value)
        self.db.flush()
        return customer

    def delete(self, customer: Customer) -> None:
        self.db.delete(customer)
        self.db.flush()
