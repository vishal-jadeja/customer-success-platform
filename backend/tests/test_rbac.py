"""Phase 04 required test: two-level RBAC on the customer module.

A CSM cannot read/write another CSM's customer; admin/manager operate globally;
CSM create/update cannot assign ownership away from self.
"""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Customer, User
from tests.conftest import auth_headers


def test_csm_cannot_read_other_csm_customer(
    client: TestClient, csm: User, customer_of_csm2: Customer
) -> None:
    resp = client.get(f"/api/v1/customers/{customer_of_csm2.id}", headers=auth_headers(csm))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "PERMISSION_DENIED"


def test_csm_can_read_own_customer(
    client: TestClient, csm: User, customer_of_csm: Customer
) -> None:
    resp = client.get(f"/api/v1/customers/{customer_of_csm.id}", headers=auth_headers(csm))
    assert resp.status_code == 200
    assert resp.json()["id"] == str(customer_of_csm.id)


def test_manager_can_read_any_customer(
    client: TestClient, manager: User, customer_of_csm: Customer, customer_of_csm2: Customer
) -> None:
    for c in (customer_of_csm, customer_of_csm2):
        resp = client.get(f"/api/v1/customers/{c.id}", headers=auth_headers(manager))
        assert resp.status_code == 200


def test_admin_lists_all_csm_lists_only_own(
    client: TestClient,
    admin: User,
    csm: User,
    customer_of_csm: Customer,
    customer_of_csm2: Customer,
) -> None:
    admin_resp = client.get("/api/v1/customers", headers=auth_headers(admin))
    csm_resp = client.get("/api/v1/customers", headers=auth_headers(csm))
    assert admin_resp.status_code == 200
    assert csm_resp.status_code == 200
    assert admin_resp.json()["total"] == 2
    assert csm_resp.json()["total"] == 1
    assert csm_resp.json()["items"][0]["id"] == str(customer_of_csm.id)


def test_csm_delete_forbidden_admin_delete_ok(
    client: TestClient, admin: User, csm: User, customer_of_csm: Customer
) -> None:
    resp = client.delete(f"/api/v1/customers/{customer_of_csm.id}", headers=auth_headers(csm))
    assert resp.status_code == 403

    resp = client.delete(f"/api/v1/customers/{customer_of_csm.id}", headers=auth_headers(admin))
    assert resp.status_code == 204


def test_csm_create_with_other_owner_forbidden_omitted_self_owned(
    client: TestClient, csm: User, csm2: User
) -> None:
    resp = client.post(
        "/api/v1/customers",
        headers=auth_headers(csm),
        json={
            "name": "A",
            "company": "A Co",
            "email": "a@example.com",
            "owner_id": str(csm2.id),
        },
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "PERMISSION_DENIED"

    resp = client.post(
        "/api/v1/customers",
        headers=auth_headers(csm),
        json={"name": "B", "company": "B Co", "email": "b@example.com"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["owner_id"] == str(csm.id)


def test_csm_reassign_owner_forbidden(
    client: TestClient, csm: User, csm2: User, customer_of_csm: Customer
) -> None:
    resp = client.patch(
        f"/api/v1/customers/{customer_of_csm.id}",
        headers=auth_headers(csm),
        json={"owner_id": str(csm2.id)},
    )
    assert resp.status_code == 403


def test_manager_reassign_owner_moves_scope(
    client: TestClient,
    db: Session,
    manager: User,
    csm: User,
    csm2: User,
    customer_of_csm: Customer,
) -> None:
    resp = client.patch(
        f"/api/v1/customers/{customer_of_csm.id}",
        headers=auth_headers(manager),
        json={"owner_id": str(csm2.id)},
    )
    assert resp.status_code == 200
    assert resp.json()["owner_id"] == str(csm2.id)

    # No longer visible to the old owner, now visible to the new one.
    old_owner_resp = client.get(
        f"/api/v1/customers/{customer_of_csm.id}", headers=auth_headers(csm)
    )
    assert old_owner_resp.status_code == 403
    new_owner_resp = client.get(
        f"/api/v1/customers/{customer_of_csm.id}", headers=auth_headers(csm2)
    )
    assert new_owner_resp.status_code == 200
