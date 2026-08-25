"""Phase 04 supplementary tests: pagination envelope, filters, sort validation,
duplicate-email conflict.
"""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import User
from tests.conftest import auth_headers, make_customer


def test_duplicate_email_on_create_returns_409(client: TestClient, manager: User) -> None:
    payload = {"name": "A", "company": "A Co", "email": "dup@example.com"}
    first = client.post("/api/v1/customers", headers=auth_headers(manager), json=payload)
    assert first.status_code == 201

    second = client.post(
        "/api/v1/customers",
        headers=auth_headers(manager),
        json={"name": "B", "company": "B Co", "email": "dup@example.com"},
    )
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "CONFLICT"


def test_duplicate_email_on_update_returns_409(
    client: TestClient, db: Session, manager: User
) -> None:
    make_customer(db, manager, email="one@example.com")
    c2 = make_customer(db, manager, email="two@example.com")
    c2_id = c2.id

    resp = client.patch(
        f"/api/v1/customers/{c2_id}",
        headers=auth_headers(manager),
        json={"email": "one@example.com"},
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "CONFLICT"


def test_pagination_envelope_across_pages(
    client: TestClient, db: Session, manager: User
) -> None:
    for _ in range(5):
        make_customer(db, manager)

    page1 = client.get(
        "/api/v1/customers?page=1&page_size=2", headers=auth_headers(manager)
    ).json()
    page2 = client.get(
        "/api/v1/customers?page=2&page_size=2", headers=auth_headers(manager)
    ).json()
    page3 = client.get(
        "/api/v1/customers?page=3&page_size=2", headers=auth_headers(manager)
    ).json()

    assert page1["total"] == 5
    assert page1["total_pages"] == 3
    assert len(page1["items"]) == 2
    assert len(page2["items"]) == 2
    assert len(page3["items"]) == 1

    ids = {i["id"] for i in page1["items"]} | {i["id"] for i in page2["items"]} | {
        i["id"] for i in page3["items"]
    }
    assert len(ids) == 5  # no duplicates, no gaps


def test_filters_q_status_health_range(
    client: TestClient, db: Session, manager: User
) -> None:
    from app.models.enums import CustomerStatus

    make_customer(
        db, manager, name="Acme Rockets", company="Acme", status=CustomerStatus.active,
        health_score=90,
    )
    make_customer(
        db, manager, name="Globex", company="Globex Corp", status=CustomerStatus.churned,
        health_score=10,
    )

    q_resp = client.get(
        "/api/v1/customers?q=rocket", headers=auth_headers(manager)
    ).json()
    assert q_resp["total"] == 1
    assert q_resp["items"][0]["name"] == "Acme Rockets"

    status_resp = client.get(
        "/api/v1/customers?status=churned", headers=auth_headers(manager)
    ).json()
    assert status_resp["total"] == 1
    assert status_resp["items"][0]["name"] == "Globex"

    health_resp = client.get(
        "/api/v1/customers?min_health=50", headers=auth_headers(manager)
    ).json()
    assert all(i["health_score"] >= 50 for i in health_resp["items"])


def test_invalid_sort_field_returns_422(client: TestClient, manager: User) -> None:
    resp = client.get("/api/v1/customers?sort=bogus", headers=auth_headers(manager))
    assert resp.status_code == 422
