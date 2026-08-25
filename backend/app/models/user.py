from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum, String, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, TimestampMixin
from app.models.enums import Role, db_enum_values

if TYPE_CHECKING:
    from app.models.customer import Customer
    from app.models.refresh_token import RefreshToken


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    role: Mapped[Role] = mapped_column(
        Enum(Role, name="user_role", values_callable=db_enum_values),
        nullable=False,
        default=Role.csm,
        server_default=text("'csm'"),
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )

    refresh_tokens: Mapped[list[RefreshToken]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    customers: Mapped[list[Customer]] = relationship(back_populates="owner")
