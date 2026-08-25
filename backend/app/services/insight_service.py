"""AI insight generation.

The interaction and its ``pending`` insight row are already committed
(Phase 05) before anything here runs. This module only ever *updates* that
row — never creates one — and never lets an LLM failure raise past itself:
a failure is persisted as ``status='failed'`` with an ``error_message``.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import ExternalServiceError
from app.core.logging import get_logger
from app.llm.cerebras import CerebrasProvider
from app.llm.client import FailoverLLMClient
from app.llm.groq import GroqProvider
from app.models import Insight, InsightStatus, Interaction, Sentiment
from app.services.cache_hooks import invalidate_interactions

logger = get_logger(__name__)

_PROVIDER_CLASSES = {"groq": GroqProvider, "cerebras": CerebrasProvider}


def _build_client() -> FailoverLLMClient:
    settings = get_settings()
    provider_keys = {"groq": settings.GROQ_API_KEY, "cerebras": settings.CEREBRAS_API_KEY}
    provider_models = {"groq": settings.GROQ_MODEL, "cerebras": settings.CEREBRAS_MODEL}

    providers = []
    for name in (p.strip() for p in settings.LLM_PROVIDER_ORDER.split(",")):
        cls = _PROVIDER_CLASSES.get(name)
        key = provider_keys.get(name)
        if cls is None or not key:  # empty key -> never construct the provider
            continue
        providers.append(cls(api_key=key, model=provider_models[name]))

    return FailoverLLMClient(
        providers,
        per_call_timeout=settings.LLM_TIMEOUT_SECONDS,
        total_budget=settings.LLM_TOTAL_BUDGET_SECONDS,
    )


class InsightService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def generate_for_interaction(self, interaction: Interaction) -> Insight | None:
        insight = interaction.insight
        if insight is None:
            # Phase 05's create() always inserts one alongside the interaction;
            # a missing row here is a bug elsewhere, not something to crash on.
            logger.error("interaction %s has no insight row to update", interaction.id)
            return None

        insight.attempts += 1
        settings = get_settings()

        if not settings.AI_ENABLED:
            insight.status = InsightStatus.failed
            insight.error_message = "AI disabled"
            self.db.commit()
            invalidate_interactions()
            return insight

        try:
            result = _build_client().generate(
                notes=interaction.notes,
                customer_name=interaction.customer.name,
                customer_status=interaction.customer.status.value,
            )
        except ExternalServiceError as exc:
            insight.status = InsightStatus.failed
            insight.error_message = exc.message
            insight.raw_response = (exc.details or {}).get("raw_response")
            self.db.commit()
            invalidate_interactions()
            return insight
        except Exception:  # noqa: BLE001 - a bug in generation must never fail the request
            logger.exception(
                "unexpected error generating insight for interaction %s", interaction.id
            )
            insight.status = InsightStatus.failed
            insight.error_message = "Unexpected error during generation"
            self.db.commit()
            invalidate_interactions()
            return insight

        insight.status = InsightStatus.completed
        insight.summary = result.payload.summary
        insight.sentiment = Sentiment(result.payload.sentiment)
        insight.action_items = result.payload.action_items
        insight.risks = result.payload.risks
        insight.provider = result.provider
        insight.model = result.model
        insight.latency_ms = result.latency_ms
        insight.raw_response = result.raw
        insight.error_message = None
        self.db.commit()
        invalidate_interactions()
        return insight

    def regenerate(self, interaction: Interaction) -> Insight | None:
        if interaction.insight is None:
            return None
        interaction.insight.status = InsightStatus.pending
        interaction.insight.error_message = None
        self.db.commit()
        return self.generate_for_interaction(interaction)
