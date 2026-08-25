"""HTTP only: parse, call DashboardService, shape the response. No SQLAlchemy here."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from app.core.deps import CurrentUser, DbSession
from app.schemas.customer import CustomerListItem
from app.schemas.dashboard import DashboardSummary, SentimentTrendPoint
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def get_summary(user: CurrentUser, db: DbSession) -> DashboardSummary:
    return DashboardSummary.model_validate(DashboardService(db).summary(user))


@router.get("/sentiment-trend", response_model=list[SentimentTrendPoint])
def get_sentiment_trend(
    user: CurrentUser,
    db: DbSession,
    days: Annotated[int, Query(ge=1, le=365)] = 30,
) -> list[SentimentTrendPoint]:
    points = DashboardService(db).sentiment_trend(user, days)
    return [SentimentTrendPoint.model_validate(p) for p in points]


@router.get("/at-risk", response_model=list[CustomerListItem])
def get_at_risk(
    user: CurrentUser,
    db: DbSession,
    limit: Annotated[int, Query(ge=1, le=100)] = 10,
) -> list[CustomerListItem]:
    items = DashboardService(db).at_risk(user, limit)
    return [CustomerListItem.model_validate(c) for c in items]
