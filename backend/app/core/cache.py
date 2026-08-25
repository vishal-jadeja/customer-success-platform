"""Versioned Redis cache: build a scoped key, get/set JSON, invalidate a namespace.

Version-key scheme (master plan): ``csp:ver:{ns}`` is an integer counter;
``csp:{ns}:{op}:v{ver}:{scope}:{sha1(params)}`` is the cache key. Invalidation
is a single ``INCR`` on the version key — O(1), atomic, and namespace-global:
one write invalidates every user's cached entries in that namespace, not just
the writer's. That is coarse but always correct (never stale); a per-scope
counter would be the next step if write volume grew.

Every Redis call here goes through the Phase 03 ``safe_*`` wrappers
(``app/core/redis.py``), so this module is fail-open by construction: a
Redis outage degrades every cache op to a no-op (get→miss, set→dropped,
invalidate→dropped), never a 5xx.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from app.core.logging import get_logger
from app.core.redis import safe_get, safe_incr, safe_setex
from app.models import Role, User

logger = get_logger(__name__)


class _CacheEncoder(json.JSONEncoder):
    def default(self, o: Any) -> Any:
        if isinstance(o, Decimal):
            return str(o)
        if isinstance(o, uuid.UUID):
            return str(o)
        if isinstance(o, datetime | date):
            return o.isoformat()
        return super().default(o)


def scope_for(user: User) -> str:
    if user.role in (Role.admin, Role.manager):
        return f"role-{user.role.value}"
    return f"csm-{user.id}"


def _version(namespace: str) -> int:
    raw = safe_get(f"csp:ver:{namespace}")
    # Missing key defaults to 0, deliberately NOT the 1 that a first INCR
    # would produce — if it defaulted to 1 too, the very first invalidate()
    # on a namespace nobody had ever bumped would land on the same version
    # number a fresh read had already assumed, silently failing to change
    # the key.
    return int(raw) if raw is not None else 0


def build_key(namespace: str, op: str, user: User, params: dict[str, Any]) -> str:
    version = _version(namespace)
    scope = scope_for(user)
    digest = hashlib.sha1(
        json.dumps(params, sort_keys=True, cls=_CacheEncoder).encode(), usedforsecurity=False
    ).hexdigest()
    return f"csp:{namespace}:{op}:v{version}:{scope}:{digest}"


def get_json(key: str) -> Any | None:
    raw = safe_get(key)
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError) as exc:
        logger.warning("cache get_json: corrupt value for %s (%s)", key, exc)
        return None


def set_json(key: str, value: Any, ttl_seconds: int) -> None:
    try:
        payload = json.dumps(value, cls=_CacheEncoder)
    except TypeError as exc:
        logger.warning("cache set_json: value for %s not JSON-serializable (%s)", key, exc)
        return
    safe_setex(key, ttl_seconds, payload)


def invalidate(namespace: str) -> None:
    safe_incr(f"csp:ver:{namespace}")
