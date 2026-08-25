"""Phase 06: provider failover + malformed-JSON repair.

Monkeypatches the provider boundary (``GroqProvider.complete`` /
``CerebrasProvider.complete``), never httpx — both providers exist only
because ``conftest.py`` sets dummy ``GROQ_API_KEY``/``CEREBRAS_API_KEY``; with
empty keys neither would be constructed and the patch would silently do
nothing. No test performs a real external HTTP call.
"""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app.llm.base import LLMTimeoutError
from app.llm.cerebras import CerebrasProvider
from app.llm.groq import GroqProvider
from app.models import Customer, User
from tests.conftest import auth_headers

_GOOD_PAYLOAD = {
    "summary": "Customer is happy with support but worried about price.",
    "sentiment": "Positive",  # deliberately mixed-case to exercise normalization
    "action_items": ["Send updated pricing"],
    "risks": ["Renewal at risk if price rises"],
}

_CREATE_BODY = {
    "type": "call",
    "title": "Renewal",
    "notes": "Customer worried about pricing and slow onboarding, but likes support.",
    "occurred_at": "2026-08-20T10:00:00Z",
}


def _create(client: TestClient, csm: User, customer: Customer) -> dict:
    resp = client.post(
        "/api/v1/interactions",
        headers=auth_headers(csm),
        json={**_CREATE_BODY, "customer_id": str(customer.id)},
    )
    assert resp.status_code == 201
    return resp.json()


def test_groq_fails_cerebras_succeeds(
    client: TestClient,
    csm: User,
    customer_of_csm: Customer,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _raise(self, system, user, *, timeout):  # noqa: ANN001, ARG001
        raise LLMTimeoutError("groq timed out")

    def _ok(self, system, user, *, timeout):  # noqa: ANN001, ARG001
        return json.dumps(_GOOD_PAYLOAD)

    monkeypatch.setattr(GroqProvider, "complete", _raise)
    monkeypatch.setattr(CerebrasProvider, "complete", _ok)

    body = _create(client, csm, customer_of_csm)

    assert body["insight"]["status"] == "completed"
    assert body["insight"]["provider"] == "cerebras"
    assert body["insight"]["sentiment"] == "positive"  # normalized from "Positive"
    assert body["insight"]["summary"]


def test_both_providers_fail_is_still_201(
    client: TestClient,
    csm: User,
    customer_of_csm: Customer,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _raise(self, system, user, *, timeout):  # noqa: ANN001, ARG001
        raise LLMTimeoutError("timed out")

    monkeypatch.setattr(GroqProvider, "complete", _raise)
    monkeypatch.setattr(CerebrasProvider, "complete", _raise)

    body = _create(client, csm, customer_of_csm)

    assert body["insight"]["status"] == "failed"
    assert body["insight"]["error_message"]

    # The row genuinely exists (not null) on the follow-up GET.
    detail = client.get(f"/api/v1/interactions/{body['id']}", headers=auth_headers(csm)).json()
    assert detail["insight"]["status"] == "failed"


def test_unrecoverable_malformed_json_fails_not_500(
    client: TestClient,
    csm: User,
    customer_of_csm: Customer,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _garbage(self, system, user, *, timeout):  # noqa: ANN001, ARG001
        return "this is not json, and never will be, even after a repair call"

    monkeypatch.setattr(GroqProvider, "complete", _garbage)
    monkeypatch.setattr(CerebrasProvider, "complete", _garbage)

    body = _create(client, csm, customer_of_csm)

    assert body["insight"]["status"] == "failed"
    assert body["insight"]["error_message"]


def test_regenerate_flips_failed_to_completed(
    client: TestClient,
    csm: User,
    customer_of_csm: Customer,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _raise(self, system, user, *, timeout):  # noqa: ANN001, ARG001
        raise LLMTimeoutError("timed out")

    monkeypatch.setattr(GroqProvider, "complete", _raise)
    monkeypatch.setattr(CerebrasProvider, "complete", _raise)
    body = _create(client, csm, customer_of_csm)
    assert body["insight"]["status"] == "failed"

    def _ok(self, system, user, *, timeout):  # noqa: ANN001, ARG001
        return json.dumps(_GOOD_PAYLOAD)

    monkeypatch.setattr(GroqProvider, "complete", _ok)

    resp = client.post(
        f"/api/v1/interactions/{body['id']}/insight/regenerate", headers=auth_headers(csm)
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "completed"
    assert resp.json()["provider"] == "groq"
