"""Customer CRUD orchestration. Route gate = require_roles; row gate = _assert_can_access."""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError, PermissionDeniedError, ValidationError
from app.models import Customer, Role, User
from app.repositories.customer import CustomerRepository
from app.repositories.user import UserRepository
from app.schemas.customer import CustomerCreate, CustomerUpdate
from app.services.cache_hooks import invalidate_customers


class CustomerService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.customers = CustomerRepository(db)
        self.users = UserRepository(db)

    @staticmethod
    def _assert_can_access(customer: Customer, user: User) -> None:
        if user.role in (Role.admin, Role.manager):
            return
        if customer.owner_id != user.id:
            raise PermissionDeniedError("You do not have access to this customer")

    def _get_or_404(self, customer_id: uuid.UUID) -> Customer:
        customer = self.customers.get(customer_id)
        if customer is None:
            raise NotFoundError("Customer not found")
        return customer

    def _resolve_owner_id(
        self, user: User, requested: uuid.UUID | None, *, current: uuid.UUID | None = None
    ) -> uuid.UUID:
        if user.role == Role.csm:
            if requested is None or requested == user.id:
                return user.id
            raise PermissionDeniedError("CSMs cannot assign a customer to another owner")

        # admin/manager
        if requested is None:
            return current if current is not None else user.id
        if requested != current:
            owner = self.users.get_by_id(requested)
            if owner is None:
                raise ValidationError("Owner not found")
        return requested

    def list_customers(
        self,
        user: User,
        *,
        q: str | None,
        status: object,
        owner_id: uuid.UUID | None,
        industry: str | None,
        min_health: int | None,
        max_health: int | None,
        sort: str,
        order: str,
        page: int,
        page_size: int,
    ) -> tuple[list[Customer], int]:
        return self.customers.list(
            user,
            q=q,
            status=status,
            owner_id=owner_id,
            industry=industry,
            min_health=min_health,
            max_health=max_health,
            sort=sort,
            order=order,
            page=page,
            page_size=page_size,
        )

    def get_customer(self, user: User, customer_id: uuid.UUID) -> tuple[Customer, int]:
        customer = self._get_or_404(customer_id)
        self._assert_can_access(customer, user)
        return customer, self.customers.count_interactions(customer_id)

    def create_customer(self, user: User, data: CustomerCreate) -> Customer:
        owner_id = self._resolve_owner_id(user, data.owner_id)
        fields = data.model_dump(exclude={"owner_id"})
        customer = self.customers.create(owner_id=owner_id, **fields)
        self.db.commit()
        invalidate_customers()
        return customer

    def update_customer(
        self, user: User, customer_id: uuid.UUID, data: CustomerUpdate
    ) -> Customer:
        customer = self._get_or_404(customer_id)
        self._assert_can_access(customer, user)

        fields = data.model_dump(exclude_unset=True)
        if "owner_id" in fields:
            fields["owner_id"] = self._resolve_owner_id(
                user, fields["owner_id"], current=customer.owner_id
            )

        self.customers.update(customer, **fields)
        self.db.commit()
        invalidate_customers()
        return customer

    def delete_customer(self, user: User, customer_id: uuid.UUID) -> None:
        customer = self._get_or_404(customer_id)
        self._assert_can_access(customer, user)
        self.customers.delete(customer)
        self.db.commit()
        invalidate_customers()
