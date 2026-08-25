"""All SQLAlchemy access to ``users`` lives here."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import Role, User


class UserRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_email(self, email: str) -> User | None:
        return self.db.scalar(select(User).where(User.email == email))

    def get_by_id(self, user_id: uuid.UUID) -> User | None:
        return self.db.get(User, user_id)

    def create(self, **fields: Any) -> User:
        """Add + flush. An ``IntegrityError`` (duplicate email) propagates to the 409 handler."""
        user = User(**fields)
        self.db.add(user)
        self.db.flush()
        return user

    def update(self, user: User, **fields: Any) -> User:
        for key, value in fields.items():
            setattr(user, key, value)
        self.db.flush()
        return user

    def list(
        self,
        *,
        page: int,
        page_size: int,
        q: str | None = None,
        role: Role | None = None,
    ) -> tuple[list[User], int]:
        stmt = select(User)
        if q:
            pattern = f"%{q.lower()}%"
            stmt = stmt.where(
                or_(func.lower(User.email).like(pattern), func.lower(User.full_name).like(pattern))
            )
        if role is not None:
            stmt = stmt.where(User.role == role)
        total = self.db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        items = list(
            self.db.scalars(
                stmt.order_by(User.created_at.asc(), User.id)
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        )
        return items, int(total)
