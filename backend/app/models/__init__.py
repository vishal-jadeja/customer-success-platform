"""Import every model here so ``Base.metadata`` is complete for Alembic."""

from app.models.customer import Customer
from app.models.enums import CustomerStatus, InsightStatus, InteractionType, Role, Sentiment
from app.models.insight import Insight
from app.models.interaction import Interaction
from app.models.refresh_token import RefreshToken
from app.models.user import User

__all__ = [
    "Customer",
    "CustomerStatus",
    "Insight",
    "InsightStatus",
    "Interaction",
    "InteractionType",
    "RefreshToken",
    "Role",
    "Sentiment",
    "User",
]
