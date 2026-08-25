"""Phase 07: cache encoder correctness, versioned-key scoping, hit/miss
behavior, write-invalidation, and Redis fail-open — all against the real
fakeredis fixture from conftest.py (autouse), no external network.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal

import pytest
import redis as redis_lib
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core import redis as redis_module
from app.core.cache import build_key, get_json, invalidate, set_json
from app.models import Customer, User
from app.repositories.dashboard import DashboardRepository
from tests.conftest import auth_headers, make_customer


def test_encoder_roundtrips_decimal_uuid_datetime() -> None:
    key = "csp:test:encoder"
    value = {
        "arr": Decimal("1234.50"),
        "id": uuid.uuid4(),
        "when": datetime(2026, 1, 15, 10, 30, tzinfo=UTC),
    }
    set_json(key, value, ttl_seconds=10)
    result = get_json(key)

    assert result == {
        "arr": "1234.50",
        "id": str(value["id"]),
        "when": "2026-01-15T10:30:00+00:00",
    }


def test_invalidate_changes_the_key(admin: User) -> None:
    key_before = build_key("customers", "list", admin, {})
    invalidate("customers")
    key_after = build_key("customers", "list", admin, {})
    assert key_before != key_after


def test_scope_is_in_the_key(admin: User, csm: User) -> None:
    admin_key = build_key("dashboard", "summary", admin, {})
    csm_key = build_key("dashboard", "summary", csm, {})
    assert admin_key != csm_key


def test_dashboard_summary_hit_avoids_second_query(
    client: TestClient, admin: User, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls = {"n": 0}
    original = DashboardRepository.summary

    def spy(self: DashboardRepository, user: User) -> dict:
        calls["n"] += 1
        return original(self, user)

    monkeypatch.setattr(DashboardRepository, "summary", spy)

    r1 = client.get("/api/v1/dashboard/summary", headers=auth_headers(admin))
    r2 = client.get("/api/v1/dashboard/summary", headers=auth_headers(admin))

    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json() == r2.json()
    assert calls["n"] == 1  # second request was a cache hit, no repo call


def test_customer_write_invalidates_dashboard_cache(
    client: TestClient, db: Session, admin: User, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls = {"n": 0}
    original = DashboardRepository.summary

    def spy(self: DashboardRepository, user: User) -> dict:
        calls["n"] += 1
        return original(self, user)

    monkeypatch.setattr(DashboardRepository, "summary", spy)

    before = client.get("/api/v1/dashboard/summary", headers=auth_headers(admin)).json()
    assert calls["n"] == 1

    resp = client.post(
        "/api/v1/customers",
        headers=auth_headers(admin),
        json={"name": "New Co", "company": "New Co", "email": "newco@example.com"},
    )
    assert resp.status_code == 201

    after = client.get("/api/v1/dashboard/summary", headers=auth_headers(admin)).json()
    assert calls["n"] == 2  # real MISS, not served from the pre-write cache
    assert after["total_customers"] == before["total_customers"] + 1


def test_csm_scoped_admin_global(
    client: TestClient, admin: User, csm: User, customer_of_csm: Customer
) -> None:
    admin_body = client.get("/api/v1/dashboard/summary", headers=auth_headers(admin)).json()
    csm_body = client.get("/api/v1/dashboard/summary", headers=auth_headers(csm)).json()

    assert csm_body["total_customers"] == 1
    assert admin_body["total_customers"] >= csm_body["total_customers"]


class _BrokenRedis:
    """Every call raises, like a Redis outage — never a hang, never a 5xx."""

    def get(self, *a: object, **k: object) -> None:
        raise redis_lib.ConnectionError("redis is down")

    def setex(self, *a: object, **k: object) -> None:
        raise redis_lib.ConnectionError("redis is down")

    def incr(self, *a: object, **k: object) -> None:
        raise redis_lib.ConnectionError("redis is down")

    def ping(self, *a: object, **k: object) -> None:
        raise redis_lib.ConnectionError("redis is down")


def test_redis_down_dashboard_still_200(
    client: TestClient, admin: User, customer_of_csm: Customer
) -> None:
    redis_module.set_redis(_BrokenRedis())
    try:
        resp = client.get("/api/v1/dashboard/summary", headers=auth_headers(admin))
        assert resp.status_code == 200
        assert resp.json()["total_customers"] >= 1
    finally:
        redis_module.set_redis(None)  # restore for any later test in this module


def test_at_risk_ordered_by_health_ascending(
    client: TestClient, db: Session, admin: User
) -> None:
    make_customer(db, admin, health_score=80)
    make_customer(db, admin, health_score=5)
    make_customer(db, admin, health_score=40)

    resp = client.get("/api/v1/dashboard/at-risk?limit=3", headers=auth_headers(admin))
    assert resp.status_code == 200
    scores = [c["health_score"] for c in resp.json()]
    assert scores == sorted(scores)
    assert scores[0] == 5
