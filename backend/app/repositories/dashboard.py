"""All SQLAlchemy access for dashboard metrics lives here.

Every query starts from ``apply_customer_scope`` (Phase 04) — admin/manager
see everything, a csm sees only their own book. Reusing that single scope
function is what keeps this consistent with customers/interactions instead
of drifting into a second definition of "own".
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Customer, CustomerStatus, Insight, Interaction, Sentiment, User
from app.repositories.customer import apply_customer_scope


class DashboardRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def summary(self, user: User) -> dict[str, object]:
        base = apply_customer_scope(select(Customer), user)
        total_customers = self.db.scalar(select(func.count()).select_from(base.subquery())) or 0

        status_stmt = apply_customer_scope(
            select(Customer.status, func.count()).group_by(Customer.status), user
        )
        status_counts = {row[0].value: row[1] for row in self.db.execute(status_stmt)}
        by_status = {s.value: status_counts.get(s.value, 0) for s in CustomerStatus}

        total_arr = self.db.scalar(
            apply_customer_scope(select(func.coalesce(func.sum(Customer.arr), 0)), user)
        )

        avg_health = self.db.scalar(
            apply_customer_scope(select(func.avg(Customer.health_score)), user)
        )

        since = datetime.now(UTC) - timedelta(days=30)
        interactions_stmt = apply_customer_scope(
            select(func.count())
            .select_from(Interaction)
            .join(Customer, Interaction.customer_id == Customer.id)
            .where(Interaction.occurred_at >= since),
            user,
        )
        interactions_last_30d = self.db.scalar(interactions_stmt) or 0

        sentiment_stmt = apply_customer_scope(
            select(Insight.sentiment, func.count())
            .select_from(Insight)
            .join(Interaction, Insight.interaction_id == Interaction.id)
            .join(Customer, Interaction.customer_id == Customer.id)
            .where(Insight.sentiment.is_not(None))
            .group_by(Insight.sentiment),
            user,
        )
        sentiment_counts = {row[0].value: row[1] for row in self.db.execute(sentiment_stmt)}
        sentiment_breakdown = {s.value: sentiment_counts.get(s.value, 0) for s in Sentiment}

        return {
            "total_customers": int(total_customers),
            "by_status": by_status,
            "total_arr": total_arr if total_arr is not None else Decimal("0"),
            "avg_health_score": round(float(avg_health), 1) if avg_health is not None else 0.0,
            "interactions_last_30d": int(interactions_last_30d),
            "sentiment_breakdown": sentiment_breakdown,
        }

    def sentiment_trend(self, user: User, days: int) -> list[dict[str, object]]:
        since = datetime.now(UTC) - timedelta(days=days)
        day_expr = func.date_trunc("day", Interaction.occurred_at)
        stmt = apply_customer_scope(
            select(day_expr.label("day"), Insight.sentiment, func.count())
            .select_from(Interaction)
            .join(Customer, Interaction.customer_id == Customer.id)
            .join(Insight, Insight.interaction_id == Interaction.id)
            .where(Interaction.occurred_at >= since, Insight.sentiment.is_not(None))
            .group_by(day_expr, Insight.sentiment)
            .order_by(day_expr),
            user,
        )

        buckets: dict[str, dict[str, int]] = {}
        for day, sentiment, count in self.db.execute(stmt):
            key = day.date().isoformat()
            bucket = buckets.setdefault(key, dict.fromkeys((s.value for s in Sentiment), 0))
            bucket[sentiment.value] = count

        return [{"date": d, **counts} for d, counts in sorted(buckets.items())]

    def at_risk(self, user: User, limit: int) -> list[Customer]:
        # Ranked by health, not filtered to status='at_risk': a formally
        # "active" customer whose health just cratered should still surface.
        stmt = apply_customer_scope(
            select(Customer).order_by(Customer.health_score.asc(), Customer.id).limit(limit),
            user,
        )
        return list(self.db.scalars(stmt))
