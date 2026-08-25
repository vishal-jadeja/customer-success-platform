from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.enums import Role

PasswordStr = Field(min_length=8, max_length=72)  # bcrypt 72-byte cap


def _lower(v: str) -> str:
    return v.strip().lower()


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    role: Role
    is_active: bool
    created_at: datetime


class UserCreateIn(BaseModel):
    email: EmailStr
    password: str = PasswordStr
    full_name: str = Field(min_length=1, max_length=120)
    role: Role = Role.csm

    _lower_email = field_validator("email", mode="after")(_lower)


class UserUpdateIn(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    role: Role | None = None
    is_active: bool | None = None
