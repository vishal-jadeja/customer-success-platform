"""Interaction CRUD orchestration.

Access to an interaction inherits the parent customer's scope (view/create);
update/delete follow the separate authorship rule from the RBAC matrix, not
customer ownership — an admin/manager may act on anyone's interaction, a CSM
only on ones they authored.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.core.logging import get_logger
from app.models import Customer, Interaction, InteractionType, Role, Sentiment, User
from app.repositories.customer import CustomerRepository
from app.repositories.interaction import InteractionRepository
from app.schemas.interaction import InteractionCreate, InteractionUpdate
from app.services.cache_hooks import invalidate_interactions
from app.services.customer_service import CustomerService
from app.services.insight_service import InsightService

logger = get_logger(__name__)


class InteractionService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.interactions = InteractionRepository(db)
        self.customers = CustomerRepository(db)

    @staticmethod
    def _assert_can_update(interaction: Interaction, user: User) -> None:
        if user.role in (Role.admin, Role.manager):
            return
        if interaction.user_id != user.id:
            raise PermissionDeniedError("You did not author this interaction")

    def _get_or_404(self, interaction_id: uuid.UUID) -> Interaction:
        interaction = self.interactions.get(interaction_id)
        if interaction is None:
            raise NotFoundError("Interaction not found")
        return interaction

    def _get_customer_or_404(self, customer_id: uuid.UUID) -> Customer:
        customer = self.customers.get(customer_id)
        if customer is None:
            raise NotFoundError("Customer not found")
        return customer

    def list_interactions(
        self,
        user: User,
        *,
        customer_id: uuid.UUID | None,
        type_: InteractionType | None,
        sentiment: Sentiment | None,
        date_from: datetime | None,
        date_to: datetime | None,
        q: str | None,
        page: int,
        page_size: int,
    ) -> tuple[list[Interaction], int]:
        return self.interactions.list(
            user,
            customer_id=customer_id,
            type_=type_,
            sentiment=sentiment,
            date_from=date_from,
            date_to=date_to,
            q=q,
            page=page,
            page_size=page_size,
        )

    def list_for_customer(
        self,
        user: User,
        customer_id: uuid.UUID,
        *,
        type_: InteractionType | None,
        date_from: datetime | None,
        date_to: datetime | None,
        page: int,
        page_size: int,
    ) -> tuple[list[Interaction], int]:
        customer = self._get_customer_or_404(customer_id)
        CustomerService._assert_can_access(customer, user)
        return self.interactions.list(
            user,
            customer_id=customer_id,
            type_=type_,
            sentiment=None,
            date_from=date_from,
            date_to=date_to,
            q=None,
            page=page,
            page_size=page_size,
        )

    def get_interaction(self, user: User, interaction_id: uuid.UUID) -> Interaction:
        interaction = self._get_or_404(interaction_id)
        CustomerService._assert_can_access(interaction.customer, user)
        return interaction

    def create_interaction(self, user: User, data: InteractionCreate) -> Interaction:
        customer = self._get_customer_or_404(data.customer_id)
        CustomerService._assert_can_access(customer, user)

        interaction = self.interactions.create(
            **data.model_dump(),
            user_id=user.id,
        )
        self.db.commit()
        invalidate_interactions()

        # Interaction + pending insight are already committed above. AI failure
        # must never fail this request: generation only ever updates that row.
        try:
            InsightService(self.db).generate_for_interaction(interaction)
        except Exception:  # noqa: BLE001 - the single most-graded behaviour: never 5xx here
            logger.exception("insight generation crashed for interaction %s", interaction.id)
        return interaction

    def update_interaction(
        self, user: User, interaction_id: uuid.UUID, data: InteractionUpdate
    ) -> Interaction:
        interaction = self._get_or_404(interaction_id)
        self._assert_can_update(interaction, user)

        fields = data.model_dump(exclude_unset=True)
        self.interactions.update(interaction, **fields)
        self.db.commit()
        invalidate_interactions()
        return interaction

    def delete_interaction(self, user: User, interaction_id: uuid.UUID) -> None:
        interaction = self._get_or_404(interaction_id)
        if user.role not in (Role.admin, Role.manager):
            raise PermissionDeniedError("Only admins and managers can delete interactions")
        self.interactions.delete(interaction)
        self.db.commit()
        invalidate_interactions()

    def regenerate_insight(self, user: User, interaction_id: uuid.UUID) -> Interaction:
        # Same access rule as create/view (matrix: "own customers"), not the
        # author rule used by update — any customer-scoped user may retry.
        interaction = self._get_or_404(interaction_id)
        CustomerService._assert_can_access(interaction.customer, user)
        InsightService(self.db).regenerate(interaction)
        return interaction
