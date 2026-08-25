"""Cache-invalidation call sites, shared by every write path.

``customer_service``, ``interaction_service``, and ``insight_service`` all
call these two functions at every write — this is the single place that
wires them to the real Redis version-key cache (``app/core/cache.py``).
"""

from __future__ import annotations

from app.core.cache import invalidate


def invalidate_customers() -> None:
    invalidate("customers")
    invalidate("dashboard")


def invalidate_interactions() -> None:
    invalidate("interactions")
    invalidate("dashboard")
