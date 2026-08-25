"""Register / login / refresh (rotation + reuse detection) / logout / profile update."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import AuthError
from app.core.logging import get_logger
from app.core.security import (
    create_access_token,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    verify_password,
)
from app.models import RefreshToken, Role, User
from app.repositories.refresh_token import RefreshTokenRepository
from app.repositories.user import UserRepository
from app.schemas.auth import MeUpdateIn, RegisterIn

logger = get_logger(__name__)

INVALID_CREDENTIALS = "Invalid credentials"  # never reveal which field was wrong


class AuthService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.settings = get_settings()
        self.users = UserRepository(db)
        self.tokens = RefreshTokenRepository(db)

    # -- helpers -------------------------------------------------------------
    def _issue_pair(self, user: User) -> tuple[str, int, str]:
        """Mint access token + store a new refresh token.

        Returns (access, expires_in, raw_refresh).
        """
        access, expires_in = create_access_token(user.id, user.role.value)
        raw, token_hash = new_refresh_token()
        expires_at = datetime.now(UTC) + timedelta(days=self.settings.REFRESH_TOKEN_TTL_DAYS)
        self.tokens.create(user.id, token_hash, expires_at)
        return access, expires_in, raw

    # -- use cases -----------------------------------------------------------
    def register(self, data: RegisterIn) -> User:
        # No existence pre-check: the unique index + IntegrityError handler -> 409.
        user = self.users.create(
            email=data.email,
            full_name=data.full_name,
            hashed_password=hash_password(data.password),
            role=Role.csm,  # self-signup is always a csm
        )
        self.db.commit()
        return user

    def login(self, email: str, password: str) -> tuple[str, int, str, User]:
        user = self.users.get_by_email(email)
        if user is None or not verify_password(password, user.hashed_password):
            raise AuthError(INVALID_CREDENTIALS)
        if not user.is_active:
            raise AuthError(INVALID_CREDENTIALS)
        access, expires_in, raw = self._issue_pair(user)
        self.db.commit()
        return access, expires_in, raw, user

    def refresh(self, raw: str | None) -> tuple[str, int, str, User]:
        if not raw:
            raise AuthError("Missing refresh token")
        now = datetime.now(UTC)
        token: RefreshToken | None = self.tokens.get_by_hash(hash_refresh_token(raw))
        if token is None:
            raise AuthError("Invalid refresh token")

        if token.revoked_at is not None:
            age = (now - token.revoked_at).total_seconds()
            if age <= self.settings.REFRESH_REUSE_GRACE_SECONDS:
                # Two tabs refreshed at once: benign. Client retries with the newer cookie.
                raise AuthError("Refresh token already rotated", code="REFRESH_RACE")
            # Reuse well after rotation = theft. Kill the whole family.
            revoked = self.tokens.revoke_all_for_user(token.user_id, now)
            self.db.commit()
            logger.warning(
                "refresh token reuse detected user=%s revoked=%d", token.user_id, revoked
            )
            raise AuthError("Refresh token reuse detected")

        if token.expires_at <= now:
            raise AuthError("Refresh token expired")

        user = self.users.get_by_id(token.user_id)
        if user is None or not user.is_active:
            raise AuthError(INVALID_CREDENTIALS)

        self.tokens.revoke(token, now)
        access, expires_in, new_raw = self._issue_pair(user)
        self.db.commit()
        return access, expires_in, new_raw, user

    def logout(self, raw: str | None) -> None:
        """Idempotent: unknown/absent/already-revoked tokens are a no-op."""
        if not raw:
            return
        token = self.tokens.get_by_hash(hash_refresh_token(raw))
        if token is not None:
            self.tokens.revoke(token, datetime.now(UTC))
            self.db.commit()

    def update_me(self, user: User, data: MeUpdateIn) -> User:
        fields: dict[str, object] = {}
        if data.full_name is not None:
            fields["full_name"] = data.full_name
        if data.new_password is not None:
            if not verify_password(data.current_password or "", user.hashed_password):
                raise AuthError("Current password is incorrect")
            fields["hashed_password"] = hash_password(data.new_password)
        self.users.update(user, **fields)
        self.db.commit()
        return user
