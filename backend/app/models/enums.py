"""Python enums mirrored 1:1 by Postgres enum types (see the initial migration).

``str`` comes first in the bases so JSON serialization yields ``"admin"``,
not ``Role.admin``.
"""

from __future__ import annotations

import enum


class Role(str, enum.Enum):
    admin = "admin"
    manager = "manager"
    csm = "csm"


class CustomerStatus(str, enum.Enum):
    onboarding = "onboarding"
    active = "active"
    at_risk = "at_risk"
    churned = "churned"


class InteractionType(str, enum.Enum):
    meeting = "meeting"
    call = "call"
    email = "email"
    support_ticket = "support_ticket"
    qbr = "qbr"


class Sentiment(str, enum.Enum):
    positive = "positive"
    neutral = "neutral"
    negative = "negative"


class InsightStatus(str, enum.Enum):
    pending = "pending"
    completed = "completed"
    failed = "failed"


def db_enum_values(enum_cls: type[enum.Enum]) -> list[str]:
    """``values_callable`` for ``sa.Enum``: store ``.value``, never the member name."""
    return [member.value for member in enum_cls]
