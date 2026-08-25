from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel


class DashboardSummary(BaseModel):
    total_customers: int
    by_status: dict[str, int]
    total_arr: Decimal
    avg_health_score: float
    interactions_last_30d: int
    sentiment_breakdown: dict[str, int]


class SentimentTrendPoint(BaseModel):
    date: str
    positive: int
    neutral: int
    negative: int
