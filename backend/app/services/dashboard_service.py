"""Dashboard metrics: cache-or-query per endpoint.

Each method builds a scoped, versioned cache key, tries a hit, and on a miss
queries the repository, caches the result, and returns it. All three read
paths degrade to a direct DB read if Redis is unavailable — ``core/cache.py``
is fail-open by construction.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.cache import build_key, get_json, set_json
from app.models import Customer, User
from app.repositories.dashboard import DashboardRepository
from app.schemas.customer import CustomerListItem

_SUMMARY_TTL = 120
_TREND_TTL = 300
_AT_RISK_TTL = 120


class DashboardService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = DashboardRepository(db)

    def summary(self, user: User) -> dict[str, object]:
        key = build_key("dashboard", "summary", user, {})
        cached = get_json(key)
        if cached is not None:
            return cached
        data = self.repo.summary(user)
        set_json(key, data, _SUMMARY_TTL)
        return data

    def sentiment_trend(self, user: User, days: int) -> list[dict[str, object]]:
        key = build_key("dashboard", "sentiment_trend", user, {"days": days})
        cached = get_json(key)
        if cached is not None:
            return cached
        data = self.repo.sentiment_trend(user, days)
        set_json(key, data, _TREND_TTL)
        return data

    def at_risk(self, user: User, limit: int) -> list[dict[str, object]]:
        key = build_key("dashboard", "at_risk", user, {"limit": limit})
        cached = get_json(key)
        if cached is not None:
            return cached
        customers: list[Customer] = self.repo.at_risk(user, limit)
        data = [CustomerListItem.model_validate(c).model_dump(mode="json") for c in customers]
        set_json(key, data, _AT_RISK_TTL)
        return data
