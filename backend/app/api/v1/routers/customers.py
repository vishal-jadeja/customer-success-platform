"""HTTP only: parse, call CustomerService, shape the response. No SQLAlchemy here."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import CurrentUser, DbSession, require_roles
from app.models import Customer, CustomerStatus, Role, User
from app.schemas.common import Page, PageParams
from app.schemas.customer import (
    CustomerCreate,
    CustomerListItem,
    CustomerOut,
    CustomerSort,
    CustomerUpdate,
    SortOrder,
)
from app.schemas.user import UserOut
from app.services.customer_service import CustomerService

router = APIRouter(prefix="/customers", tags=["customers"])

AdminOnly = Annotated[User, Depends(require_roles(Role.admin))]


def _to_out(customer: Customer, interaction_count: int, *, with_owner: bool = False) -> CustomerOut:
    data = CustomerListItem.model_validate(customer).model_dump()
    data["phone"] = customer.phone
    data["interaction_count"] = interaction_count
    if with_owner:
        data["owner"] = UserOut.model_validate(customer.owner)
    return CustomerOut.model_validate(data)


@router.get("", response_model=Page[CustomerListItem])
def list_customers(
    user: CurrentUser,
    db: DbSession,
    page_params: Annotated[PageParams, Depends()],
    q: Annotated[str | None, Query(max_length=160)] = None,
    status_: Annotated[CustomerStatus | None, Query(alias="status")] = None,
    owner_id: uuid.UUID | None = None,
    industry: Annotated[str | None, Query(max_length=80)] = None,
    min_health: Annotated[int | None, Query(ge=0, le=100)] = None,
    max_health: Annotated[int | None, Query(ge=0, le=100)] = None,
    sort: CustomerSort = "created_at",
    order: SortOrder = "desc",
) -> Page[CustomerListItem]:
    items, total = CustomerService(db).list_customers(
        user,
        q=q,
        status=status_,
        owner_id=owner_id,
        industry=industry,
        min_health=min_health,
        max_health=max_health,
        sort=sort,
        order=order,
        page=page_params.page,
        page_size=page_params.page_size,
    )
    return Page[CustomerListItem].build(
        [CustomerListItem.model_validate(c) for c in items],
        total,
        page_params.page,
        page_params.page_size,
    )


@router.post("", status_code=status.HTTP_201_CREATED, response_model=CustomerOut)
def create_customer(data: CustomerCreate, user: CurrentUser, db: DbSession) -> CustomerOut:
    customer = CustomerService(db).create_customer(user, data)
    return _to_out(customer, 0)


@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(customer_id: uuid.UUID, user: CurrentUser, db: DbSession) -> CustomerOut:
    customer, interaction_count = CustomerService(db).get_customer(user, customer_id)
    return _to_out(customer, interaction_count, with_owner=True)


@router.patch("/{customer_id}", response_model=CustomerOut)
def update_customer(
    customer_id: uuid.UUID, data: CustomerUpdate, user: CurrentUser, db: DbSession
) -> CustomerOut:
    service = CustomerService(db)
    customer = service.update_customer(user, customer_id, data)
    interaction_count = service.customers.count_interactions(customer_id)
    return _to_out(customer, interaction_count)


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_customer(customer_id: uuid.UUID, _: AdminOnly, user: CurrentUser, db: DbSession) -> None:
    CustomerService(db).delete_customer(user, customer_id)
