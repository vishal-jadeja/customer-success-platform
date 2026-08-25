"""Cache-invalidation call sites, wired up for real in Phase 07.

Until ``app/core/cache.py`` exists, these are no-ops so write paths have a
single, stable place to call — nothing here should touch Redis yet.
"""

from __future__ import annotations


def invalidate_customers() -> None:
    """Bump ``csp:ver:customers`` (+ ``dashboard``) once Phase 07 lands."""
