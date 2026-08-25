"""Admin user management. Route gate = require_roles; row gate = _assert_can_manage."""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError
from app.core.security import hash_password
from app.models import Role, User
from app.repositories.user import UserRepository
from app.schemas.user import UserCreateIn, UserUpdateIn


class UserService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.users = UserRepository(db)

    @staticmethod
    def _assert_can_manage(actor: User) -> None:
        if actor.role != Role.admin:
            raise PermissionDeniedError("Only admins can manage users")

    def _get_or_404(self, user_id: uuid.UUID) -> User:
        user = self.users.get_by_id(user_id)
        if user is None:
            raise NotFoundError("User not found")
        return user

    def list_users(
        self, *, page: int, page_size: int, q: str | None, role: Role | None
    ) -> tuple[list[User], int]:
        return self.users.list(page=page, page_size=page_size, q=q, role=role)

    def create_user(self, actor: User, data: UserCreateIn) -> User:
        self._assert_can_manage(actor)
        user = self.users.create(
            email=data.email,
            full_name=data.full_name,
            hashed_password=hash_password(data.password),
            role=data.role,
        )
        self.db.commit()
        return user

    def update_user(self, actor: User, user_id: uuid.UUID, data: UserUpdateIn) -> User:
        self._assert_can_manage(actor)
        target = self._get_or_404(user_id)
        fields = data.model_dump(exclude_none=True)
        if target.id == actor.id:
            if fields.get("role", Role.admin) != Role.admin:
                raise ConflictError("You cannot change your own role")
            if fields.get("is_active", True) is False:
                raise ConflictError("You cannot deactivate yourself")
        self.users.update(target, **fields)
        self.db.commit()
        return target

    def deactivate_user(self, actor: User, user_id: uuid.UUID) -> None:
        """Soft delete. Hard delete is never exposed (ON DELETE RESTRICT guards direct DB)."""
        self._assert_can_manage(actor)
        target = self._get_or_404(user_id)
        if target.id == actor.id:
            raise ConflictError("You cannot deactivate yourself")
        self.users.update(target, is_active=False)
        self.db.commit()
