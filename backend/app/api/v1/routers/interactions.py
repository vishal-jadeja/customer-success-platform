"""HTTP only: parse, call InteractionService, shape the response. No SQLAlchemy here.

Two routers: ``router`` for the flat ``/interactions`` CRUD surface, and
``customer_router`` for the nested ``/customers/{customer_id}/interactions``
list — both included from ``main.py``.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import CurrentUser, DbSession, require_roles
from app.models import InteractionType, Role, Sentiment, User
from app.schemas.common import Page, PageParams
from app.schemas.insight import InsightOut
from app.schemas.interaction import InteractionCreate, InteractionOut, InteractionUpdate
from app.services.interaction_service import InteractionService

router = APIRouter(prefix="/interactions", tags=["interactions"])
customer_router = APIRouter(prefix="/customers", tags=["interactions"])

AdminOrManager = Annotated[User, Depends(require_roles(Role.admin, Role.manager))]


@router.get("", response_model=Page[InteractionOut])
def list_interactions(
    user: CurrentUser,
    db: DbSession,
    page_params: Annotated[PageParams, Depends()],
    customer_id: uuid.UUID | None = None,
    type: InteractionType | None = None,  # noqa: A002 - matches the query param name
    sentiment: Sentiment | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    q: Annotated[str | None, Query(max_length=200)] = None,
) -> Page[InteractionOut]:
    items, total = InteractionService(db).list_interactions(
        user,
        customer_id=customer_id,
        type_=type,
        sentiment=sentiment,
        date_from=date_from,
        date_to=date_to,
        q=q,
        page=page_params.page,
        page_size=page_params.page_size,
    )
    return Page[InteractionOut].build(
        [InteractionOut.model_validate(i) for i in items],
        total,
        page_params.page,
        page_params.page_size,
    )


@router.post("", status_code=status.HTTP_201_CREATED, response_model=InteractionOut)
def create_interaction(
    data: InteractionCreate, user: CurrentUser, db: DbSession
) -> InteractionOut:
    interaction = InteractionService(db).create_interaction(user, data)
    return InteractionOut.model_validate(interaction)


@router.get("/{interaction_id}", response_model=InteractionOut)
def get_interaction(interaction_id: uuid.UUID, user: CurrentUser, db: DbSession) -> InteractionOut:
    interaction = InteractionService(db).get_interaction(user, interaction_id)
    return InteractionOut.model_validate(interaction)


@router.patch("/{interaction_id}", response_model=InteractionOut)
def update_interaction(
    interaction_id: uuid.UUID, data: InteractionUpdate, user: CurrentUser, db: DbSession
) -> InteractionOut:
    interaction = InteractionService(db).update_interaction(user, interaction_id, data)
    return InteractionOut.model_validate(interaction)


@router.delete("/{interaction_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_interaction(
    interaction_id: uuid.UUID, _: AdminOrManager, user: CurrentUser, db: DbSession
) -> None:
    InteractionService(db).delete_interaction(user, interaction_id)


@router.post("/{interaction_id}/insight/regenerate", response_model=InsightOut)
def regenerate_insight(interaction_id: uuid.UUID, user: CurrentUser, db: DbSession) -> InsightOut:
    interaction = InteractionService(db).regenerate_insight(user, interaction_id)
    return InsightOut.model_validate(interaction.insight)


@customer_router.get("/{customer_id}/interactions", response_model=Page[InteractionOut])
def list_customer_interactions(
    customer_id: uuid.UUID,
    user: CurrentUser,
    db: DbSession,
    page_params: Annotated[PageParams, Depends()],
    type: InteractionType | None = None,  # noqa: A002
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> Page[InteractionOut]:
    items, total = InteractionService(db).list_for_customer(
        user,
        customer_id,
        type_=type,
        date_from=date_from,
        date_to=date_to,
        page=page_params.page,
        page_size=page_params.page_size,
    )
    return Page[InteractionOut].build(
        [InteractionOut.model_validate(i) for i in items],
        total,
        page_params.page,
        page_params.page_size,
    )
