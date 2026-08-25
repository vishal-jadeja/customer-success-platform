"""FastAPI dependencies: DB session, current user, role gate."""

from __future__ import annotations

import uuid
from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.exceptions import AuthError, PermissionDeniedError
from app.core.security import decode_access_token
from app.db import get_db
from app.models import Role, User
from app.repositories.user import UserRepository

__all__ = ["get_db", "get_current_user", "require_roles", "DbSession", "CurrentUser"]

bearer = HTTPBearer(auto_error=False)

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise AuthError("Not authenticated")
    payload = decode_access_token(credentials.credentials)
    try:
        user_id = uuid.UUID(payload["sub"])
    except (ValueError, TypeError) as exc:
        raise AuthError("Invalid access token") from exc
    # The DB is authoritative for role/active state — the JWT claim is informational.
    user = UserRepository(db).get_by_id(user_id)
    if user is None or not user.is_active:
        raise AuthError("Not authenticated")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: Role) -> Callable[..., User]:
    """Route-level verb gate. Services still do the row-level check."""
    allowed = set(roles)

    def checker(user: CurrentUser, request: Request) -> User:
        if user.role not in allowed:
            raise PermissionDeniedError(
                f"Role '{user.role.value}' may not {request.method} {request.url.path}"
            )
        return user

    return checker
