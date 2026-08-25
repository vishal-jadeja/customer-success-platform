"""Shared test infrastructure: real Postgres (enums + JSONB need it), fakeredis,
rate limiting off, per-test transaction rollback.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import fakeredis
import pytest
import sqlalchemy
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

# --- Settings MUST be overridden before app.* modules are imported, since
# get_settings() is @lru_cache'd at import time. -----------------------------
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg2://csp:csp@localhost:5432/csp_test"
)
os.environ.setdefault("DATABASE_URL", TEST_DATABASE_URL)
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/15")
os.environ.setdefault("JWT_SECRET", "test-secret-not-for-prod-min-32-bytes")
os.environ.setdefault("RATE_LIMIT_ENABLED", "false")
os.environ.setdefault("COOKIE_SECURE", "false")
os.environ.setdefault("GROQ_API_KEY", "test")
os.environ.setdefault("CEREBRAS_API_KEY", "test")
os.environ.setdefault("ENV", "test")

from app.core.config import get_settings  # noqa: E402

get_settings.cache_clear()

from app.core import redis as redis_module  # noqa: E402
from app.core.deps import get_db  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Role, User  # noqa: E402


def _ensure_test_database(url: str) -> None:
    """Create the test DB on the maintenance connection if it doesn't exist yet."""
    db_url = sqlalchemy.engine.make_url(url)
    admin_engine = create_engine(db_url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin_engine.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": db_url.database}
        ).scalar()
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{db_url.database}"'))
    admin_engine.dispose()


@pytest.fixture(scope="session", autouse=True)
def _migrated_db() -> Iterator[None]:
    _ensure_test_database(TEST_DATABASE_URL)
    cfg = Config(str(_backend_root() / "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", TEST_DATABASE_URL.replace("%", "%%"))
    command.upgrade(cfg, "head")
    yield


def _backend_root():
    from pathlib import Path

    return Path(__file__).resolve().parents[1]


@pytest.fixture(scope="session")
def _engine():
    engine = create_engine(TEST_DATABASE_URL)
    yield engine
    engine.dispose()


@pytest.fixture
def db(_engine) -> Iterator[Session]:
    connection = _engine.connect()
    outer_txn = connection.begin()
    TestSession = sessionmaker(bind=connection, autoflush=False, autocommit=False)
    session = TestSession()
    # Nested transaction: service-layer commit()s release a SAVEPOINT, not the
    # outer transaction, so the whole test still rolls back at teardown.
    session.begin_nested()

    @sqlalchemy.event.listens_for(session, "after_transaction_end")
    def _restart_savepoint(sess, transaction):
        if transaction.nested and not transaction._parent.nested:
            sess.begin_nested()

    try:
        yield session
    finally:
        session.close()
        if outer_txn.is_active:
            outer_txn.rollback()
        connection.close()


@pytest.fixture(autouse=True)
def _fake_redis() -> Iterator[None]:
    client = fakeredis.FakeRedis(decode_responses=True)
    redis_module.set_redis(client)
    yield
    redis_module.set_redis(None)


@pytest.fixture
def client(db: Session) -> Iterator[TestClient]:
    def _override_get_db() -> Iterator[Session]:
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_db, None)


# --- role fixtures (created directly via the model, not the API) ------------
def _make_user(db: Session, email: str, role: Role, password: str = "Passw0rd!") -> User:
    user = User(
        email=email,
        full_name=email.split("@")[0],
        role=role,
        hashed_password=hash_password(password),
    )
    db.add(user)
    db.flush()
    db.commit()
    return user


@pytest.fixture
def admin(db: Session) -> User:
    return _make_user(db, "admin@csptest.example.com", Role.admin)


@pytest.fixture
def manager(db: Session) -> User:
    return _make_user(db, "manager@csptest.example.com", Role.manager)


@pytest.fixture
def csm(db: Session) -> User:
    return _make_user(db, "csm@csptest.example.com", Role.csm)


@pytest.fixture
def csm2(db: Session) -> User:
    return _make_user(db, "csm2@csptest.example.com", Role.csm)


def token_for(user: User) -> str:
    from app.core.security import create_access_token

    token, _ = create_access_token(user.id, user.role.value)
    return token


def auth_headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {token_for(user)}"}


def backdate_revoked(db: Session, token_hash: str, seconds: int) -> None:
    """Push a refresh token's revoked_at back in time, to test reuse past the grace window."""
    from app.models import RefreshToken

    row = db.scalar(sqlalchemy.select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    assert row is not None
    row.revoked_at = datetime.now(UTC) - timedelta(seconds=seconds)
    db.flush()
    db.commit()


def hash_of(raw: str) -> str:
    from app.core.security import hash_refresh_token

    return hash_refresh_token(raw)
