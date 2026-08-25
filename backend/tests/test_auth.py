"""Register/login basics + the highest-value security test: refresh rotation
and reuse detection (grace-window race vs. real theft)."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import backdate_revoked, hash_of

REGISTER = {"email": "New.User@Example.com", "password": "pw123456", "full_name": "New User"}


def test_register_forces_csm_role(client: TestClient) -> None:
    r = client.post("/api/v1/auth/register", json=REGISTER)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["role"] == "csm"
    assert body["email"] == "new.user@example.com"  # lowercased


def test_register_duplicate_email_is_409_envelope(client: TestClient) -> None:
    client.post("/api/v1/auth/register", json=REGISTER)
    r = client.post("/api/v1/auth/register", json=REGISTER)
    assert r.status_code == 409
    body = r.json()
    assert body["error"]["code"] == "CONFLICT"
    assert body["error"]["request_id"]
    assert r.headers["x-request-id"] == body["error"]["request_id"]


def test_login_bad_password_and_unknown_email_both_generic_401(client: TestClient) -> None:
    client.post("/api/v1/auth/register", json=REGISTER)
    bad_pw = client.post(
        "/api/v1/auth/login", json={"email": REGISTER["email"], "password": "wrongpass"}
    )
    unknown = client.post(
        "/api/v1/auth/login", json={"email": "nobody@example.com", "password": "wrongpass"}
    )
    assert bad_pw.status_code == unknown.status_code == 401
    assert (
        bad_pw.json()["error"]["message"]
        == unknown.json()["error"]["message"]
        == "Invalid credentials"
    )


def test_refresh_rotation_and_race_window(client: TestClient, db: Session) -> None:
    client.post("/api/v1/auth/register", json=REGISTER)
    login = client.post(
        "/api/v1/auth/login", json={"email": REGISTER["email"], "password": REGISTER["password"]}
    )
    assert login.status_code == 200
    old_cookie = client.cookies.get("refresh_token")
    assert old_cookie

    rotated = client.post("/api/v1/auth/refresh")
    assert rotated.status_code == 200
    new_cookie = client.cookies.get("refresh_token")
    assert new_cookie and new_cookie != old_cookie

    # Replaying the OLD cookie immediately after rotation = benign race (two tabs).
    client.cookies.set("refresh_token", old_cookie)
    replay = client.post("/api/v1/auth/refresh")
    client.cookies.set("refresh_token", new_cookie)
    assert replay.status_code == 401
    assert replay.json()["error"]["code"] == "REFRESH_RACE"

    # The current cookie must still work — family was NOT revoked by the race.
    still_valid = client.post("/api/v1/auth/refresh")
    assert still_valid.status_code == 200


def test_refresh_reuse_past_grace_window_revokes_family(client: TestClient, db: Session) -> None:
    client.post("/api/v1/auth/register", json=REGISTER)
    client.post(
        "/api/v1/auth/login", json={"email": REGISTER["email"], "password": REGISTER["password"]}
    )
    old_cookie = client.cookies.get("refresh_token")
    rotated = client.post("/api/v1/auth/refresh")
    new_cookie = client.cookies.get("refresh_token")
    assert rotated.status_code == 200

    # Push the OLD (now revoked) token's revoked_at back beyond the grace window
    # to simulate a stolen token being replayed much later.
    backdate_revoked(db, hash_of(old_cookie), seconds=60)

    client.cookies.set("refresh_token", old_cookie)
    stolen_replay = client.post("/api/v1/auth/refresh")
    assert stolen_replay.status_code == 401
    assert stolen_replay.json()["error"]["code"] == "UNAUTHORIZED"

    # Whole family revoked: even the CURRENT cookie is now dead.
    client.cookies.set("refresh_token", new_cookie)
    now_dead = client.post("/api/v1/auth/refresh")
    assert now_dead.status_code == 401


def test_me_requires_bearer_token(client: TestClient) -> None:
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "UNAUTHORIZED"


def test_unknown_route_uses_error_envelope(client: TestClient) -> None:
    r = client.get("/nope")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"
