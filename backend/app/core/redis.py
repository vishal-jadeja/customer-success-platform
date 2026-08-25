"""Redis client + fail-open wrappers. Redis down = slower, never wrong, never 5xx."""

from __future__ import annotations

import redis

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_client: redis.Redis | None = None


def get_redis() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.Redis.from_url(
            get_settings().REDIS_URL,
            decode_responses=True,
            socket_timeout=1,
            socket_connect_timeout=1,
        )
    return _client


def set_redis(client: redis.Redis | None) -> None:
    """Test hook: swap the singleton (e.g. for fakeredis)."""
    global _client
    _client = client


def _warn(op: str, exc: Exception) -> None:
    logger.warning("redis %s failed (fail-open): %s", op, exc)


def safe_get(key: str) -> str | None:
    try:
        return get_redis().get(key)
    except (redis.RedisError, OSError) as exc:
        _warn("GET", exc)
        return None


def safe_setex(key: str, ttl_seconds: int, value: str) -> bool | None:
    try:
        return bool(get_redis().setex(key, ttl_seconds, value))
    except (redis.RedisError, OSError) as exc:
        _warn("SETEX", exc)
        return None


def safe_incr(key: str) -> int | None:
    try:
        return int(get_redis().incr(key))
    except (redis.RedisError, OSError) as exc:
        _warn("INCR", exc)
        return None


def safe_ping() -> bool:
    try:
        return bool(get_redis().ping())
    except (redis.RedisError, OSError) as exc:
        _warn("PING", exc)
        return False
