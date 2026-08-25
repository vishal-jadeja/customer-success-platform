"""Admin user management. Route gate here; row gate in UserService."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import DbSession, require_roles
from app.models import Role, User
from app.schemas.common import Page
from app.schemas.user import UserCreateIn, UserOut, UserUpdateIn
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])

AdminOrManager = Annotated[User, Depends(require_roles(Role.admin, Role.manager))]
AdminOnly = Annotated[User, Depends(require_roles(Role.admin))]


@router.get("", response_model=Page[UserOut])
def list_users(
    _: AdminOrManager,
    db: DbSession,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    q: Annotated[str | None, Query(max_length=120)] = None,
    role: Role | None = None,
) -> Page[UserOut]:
    items, total = UserService(db).list_users(page=page, page_size=page_size, q=q, role=role)
    return Page[UserOut].build([UserOut.model_validate(u) for u in items], total, page, page_size)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=UserOut)
def create_user(data: UserCreateIn, actor: AdminOnly, db: DbSession) -> UserOut:
    return UserOut.model_validate(UserService(db).create_user(actor, data))


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: uuid.UUID, data: UserUpdateIn, actor: AdminOnly, db: DbSession) -> UserOut:
    return UserOut.model_validate(UserService(db).update_user(actor, user_id, data))


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def deactivate_user(user_id: uuid.UUID, actor: AdminOnly, db: DbSession) -> None:
    UserService(db).deactivate_user(actor, user_id)
