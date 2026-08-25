"""Password hashing (bcrypt directly — no passlib), JWT access tokens, refresh tokens.

bcrypt only considers the first 72 bytes; the 8–72 char cap is enforced in the
request schemas. Refresh tokens: only the SHA-256 hex of the raw value is stored.
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt

from app.core.config import get_settings
from app.core.exceptions import AuthError


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        # Malformed stored hash — treat as a failed check, never a 500.
        return False


def create_access_token(user_id: uuid.UUID, role: str) -> tuple[str, int]:
    """Return ``(token, expires_in_seconds)``. ``role`` is informational — DB is authoritative."""
    settings = get_settings()
    now = datetime.now(UTC)
    ttl = timedelta(minutes=settings.ACCESS_TOKEN_TTL_MIN)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "role": role,
        "type": "access",
        "iat": now,
        "exp": now + ttl,
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return token, int(ttl.total_seconds())


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise AuthError("Access token expired") from exc
    except jwt.PyJWTError as exc:
        raise AuthError("Invalid access token") from exc
    if payload.get("type") != "access" or "sub" not in payload:
        raise AuthError("Invalid access token")
    return payload


def hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def new_refresh_token() -> tuple[str, str]:
    """``(raw, sha256_hex)`` — the raw value goes only into the cookie."""
    raw = secrets.token_urlsafe(48)
    return raw, hash_refresh_token(raw)
