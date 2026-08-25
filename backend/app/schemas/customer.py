from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.enums import CustomerStatus
from app.schemas.user import UserOut

CustomerSort = Literal["created_at", "name", "health_score", "arr"]
SortOrder = Literal["asc", "desc"]


def _lower(v: str) -> str:
    return v.strip().lower()


class CustomerBase(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    company: str = Field(min_length=1, max_length=160)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=32)
    industry: str | None = Field(default=None, max_length=80)
    status: CustomerStatus = CustomerStatus.onboarding
    health_score: int = Field(default=50, ge=0, le=100)
    arr: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)

    _lower_email = field_validator("email", mode="after")(_lower)


class CustomerCreate(CustomerBase):
    # Service decides: csm -> forced self; admin/manager -> self if omitted, else this value.
    owner_id: uuid.UUID | None = None


class CustomerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    company: str | None = Field(default=None, min_length=1, max_length=160)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=32)
    industry: str | None = Field(default=None, max_length=80)
    status: CustomerStatus | None = None
    health_score: int | None = Field(default=None, ge=0, le=100)
    arr: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    owner_id: uuid.UUID | None = None

    _lower_email = field_validator("email", mode="after")(_lower)


class CustomerListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    company: str
    email: str
    industry: str | None
    status: CustomerStatus
    health_score: int
    arr: Decimal | None
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class CustomerOut(CustomerListItem):
    phone: str | None
    interaction_count: int
    owner: UserOut | None = None
