"""Engine, session factory, declarative base and the ``get_db`` dependency.

Schema is owned by Alembic migrations — never call ``Base.metadata.create_all``.
"""

from __future__ import annotations

from collections.abc import Generator
from datetime import datetime

from sqlalchemy import MetaData, create_engine, func
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker
from sqlalchemy.types import TIMESTAMP

from app.core.config import get_settings

settings = get_settings()

# A request holds its pooled connection for the whole (≤35 s) synchronous LLM
# call in Phase 06, so the pool is bounded explicitly. Use Neon's pooler URL in
# prod so 10 connections per instance never exhausts the DB.
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=5,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

# Deterministic constraint names: they appear verbatim in the migration and are
# what the IntegrityError -> 409 mapper (Phase 03) can match on.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class TimestampMixin:
    """``created_at`` / ``updated_at`` as server-side defaults.

    ``server_default`` (not a Python default) so raw SQL inserts still get a
    timestamp; ``onupdate`` keeps ``updated_at`` fresh on ORM updates.
    """

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency: one session per request, always closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
