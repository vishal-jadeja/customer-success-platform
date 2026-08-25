"""Phase 05: interaction CRUD, scope inherited from the parent customer,
pending-insight-row-on-create, author-vs-role update/delete rules.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Customer, User
from tests.conftest import auth_headers, make_interaction


def test_csm_creates_on_owned_customer_pending_insight_committed(
    client: TestClient, csm: User, customer_of_csm: Customer
) -> None:
    resp = client.post(
        "/api/v1/interactions",
        headers=auth_headers(csm),
        json={
            "customer_id": str(customer_of_csm.id),
            "type": "meeting",
            "title": "QBR",
            "notes": "Long enough note about the meeting to pass validation.",
            "occurred_at": "2026-08-20T10:00:00Z",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["insight"]["status"] == "pending"
    assert body["insight"]["error_message"] is None


def test_csm_create_on_non_owned_customer_forbidden(
    client: TestClient, csm: User, customer_of_csm2: Customer
) -> None:
    resp = client.post(
        "/api/v1/interactions",
        headers=auth_headers(csm),
        json={
            "customer_id": str(customer_of_csm2.id),
            "type": "call",
            "title": "Check-in",
            "notes": "Long enough note about the call to pass validation.",
            "occurred_at": "2026-08-20T10:00:00Z",
        },
    )
    assert resp.status_code == 403


def test_notes_too_short_is_422(client: TestClient, csm: User, customer_of_csm: Customer) -> None:
    resp = client.post(
        "/api/v1/interactions",
        headers=auth_headers(csm),
        json={
            "customer_id": str(customer_of_csm.id),
            "type": "call",
            "title": "Quick",
            "notes": "too short",
            "occurred_at": "2026-08-20T10:00:00Z",
        },
    )
    assert resp.status_code == 422


def test_nested_list_scoped_to_customer(
    client: TestClient,
    db: Session,
    csm: User,
    customer_of_csm: Customer,
    customer_of_csm2: Customer,
) -> None:
    make_interaction(db, customer_of_csm, csm, title="A")
    make_interaction(db, customer_of_csm, csm, title="B")
    make_interaction(db, customer_of_csm2, csm, title="Other")  # different customer

    resp = client.get(
        f"/api/v1/customers/{customer_of_csm.id}/interactions", headers=auth_headers(csm)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    assert {i["title"] for i in body["items"]} == {"A", "B"}


def test_nested_list_403_for_non_owner(
    client: TestClient, csm: User, customer_of_csm2: Customer
) -> None:
    resp = client.get(
        f"/api/v1/customers/{customer_of_csm2.id}/interactions", headers=auth_headers(csm)
    )
    assert resp.status_code == 403


def test_filter_by_type_and_date_range(
    client: TestClient, db: Session, manager: User, customer_of_csm: Customer
) -> None:
    now = datetime.now(UTC)
    make_interaction(
        db, customer_of_csm, manager, type="meeting", title="Meet", occurred_at=now
    )
    make_interaction(
        db,
        customer_of_csm,
        manager,
        type="email",
        title="Mail",
        occurred_at=now - timedelta(days=10),
    )

    type_resp = client.get(
        "/api/v1/interactions?type=meeting", headers=auth_headers(manager)
    ).json()
    assert type_resp["total"] == 1
    assert type_resp["items"][0]["title"] == "Meet"

    date_resp = client.get(
        "/api/v1/interactions",
        params={"date_from": (now - timedelta(days=1)).isoformat()},
        headers=auth_headers(manager),
    ).json()
    assert date_resp["total"] == 1
    assert date_resp["items"][0]["title"] == "Meet"


def test_manager_deletes_csm_cannot(
    client: TestClient, db: Session, manager: User, csm: User, customer_of_csm: Customer
) -> None:
    interaction = make_interaction(db, customer_of_csm, csm)

    resp = client.delete(f"/api/v1/interactions/{interaction.id}", headers=auth_headers(csm))
    assert resp.status_code == 403

    resp = client.delete(
        f"/api/v1/interactions/{interaction.id}", headers=auth_headers(manager)
    )
    assert resp.status_code == 204


def test_update_author_rule(
    client: TestClient, db: Session, csm: User, csm2: User, customer_of_csm: Customer
) -> None:
    interaction = make_interaction(db, customer_of_csm, csm)

    # csm2 didn't author it -> 403 even though update isn't customer-scoped.
    resp = client.patch(
        f"/api/v1/interactions/{interaction.id}",
        headers=auth_headers(csm2),
        json={"title": "Hijacked"},
    )
    assert resp.status_code == 403

    resp = client.patch(
        f"/api/v1/interactions/{interaction.id}",
        headers=auth_headers(csm),
        json={"title": "Updated title"},
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Updated title"


def test_manager_can_update_any_authors_interaction(
    client: TestClient, db: Session, manager: User, csm: User, customer_of_csm: Customer
) -> None:
    interaction = make_interaction(db, customer_of_csm, csm)
    resp = client.patch(
        f"/api/v1/interactions/{interaction.id}",
        headers=auth_headers(manager),
        json={"title": "Manager edited"},
    )
    assert resp.status_code == 200
