"""All SQLAlchemy access to ``refresh_tokens`` lives here."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import RefreshToken


class RefreshTokenRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, user_id: uuid.UUID, token_hash: str, expires_at: datetime) -> RefreshToken:
        token = RefreshToken(user_id=user_id, token_hash=token_hash, expires_at=expires_at)
        self.db.add(token)
        self.db.flush()
        return token

    def get_by_hash(self, token_hash: str, *, for_update: bool = False) -> RefreshToken | None:
        """``for_update=True`` takes a row lock so two concurrent refreshes with the
        same token serialise: the second sees ``revoked_at`` set (-> REFRESH_RACE)
        instead of both minting a new pair."""
        stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        if for_update:
            stmt = stmt.with_for_update()
        return self.db.scalar(stmt)

    def revoke(self, token: RefreshToken, now: datetime) -> None:
        if token.revoked_at is None:
            token.revoked_at = now
            self.db.flush()

    def revoke_all_for_user(self, user_id: uuid.UUID, now: datetime) -> int:
        result = self.db.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        return int(result.rowcount or 0)
