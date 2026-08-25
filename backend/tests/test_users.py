"""RBAC exercised through real routes: /users."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.models import User
from tests.conftest import auth_headers


def test_csm_cannot_list_users(client: TestClient, csm: User) -> None:
    r = client.get("/api/v1/users", headers=auth_headers(csm))
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "PERMISSION_DENIED"


def test_manager_can_list_but_not_create(client: TestClient, manager: User) -> None:
    listed = client.get("/api/v1/users", headers=auth_headers(manager))
    assert listed.status_code == 200
    body = listed.json()
    assert {"items", "total", "page", "page_size", "total_pages"} <= body.keys()

    created = client.post(
        "/api/v1/users",
        headers=auth_headers(manager),
        json={"email": "x@x.com", "password": "pw123456", "full_name": "X", "role": "csm"},
    )
    assert created.status_code == 403


def test_admin_creates_user(client: TestClient, admin: User) -> None:
    r = client.post(
        "/api/v1/users",
        headers=auth_headers(admin),
        json={
            "email": "newmgr@csptest.example.com",
            "password": "pw123456",
            "full_name": "New Mgr",
            "role": "manager",
        },
    )
    assert r.status_code == 201
    assert r.json()["role"] == "manager"


def test_admin_duplicate_email_is_409(client: TestClient, admin: User, csm: User) -> None:
    r = client.post(
        "/api/v1/users",
        headers=auth_headers(admin),
        json={"email": csm.email, "password": "pw123456", "full_name": "Dup", "role": "csm"},
    )
    assert r.status_code == 409


def test_admin_cannot_deactivate_self(client: TestClient, admin: User) -> None:
    r = client.delete(f"/api/v1/users/{admin.id}", headers=auth_headers(admin))
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "CONFLICT"


def test_admin_deactivates_csm_and_token_dies(client: TestClient, admin: User, csm: User) -> None:
    r = client.delete(f"/api/v1/users/{csm.id}", headers=auth_headers(admin))
    assert r.status_code == 204

    still_using_old_token = client.get("/api/v1/auth/me", headers=auth_headers(csm))
    assert still_using_old_token.status_code == 401
