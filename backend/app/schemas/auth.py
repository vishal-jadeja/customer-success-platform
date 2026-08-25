from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.schemas.user import PasswordStr, UserOut, _lower


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = PasswordStr
    full_name: str = Field(min_length=1, max_length=120)

    _lower_email = field_validator("email", mode="after")(_lower)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)

    _lower_email = field_validator("email", mode="after")(_lower)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


class MeUpdateIn(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    current_password: str | None = Field(default=None, max_length=72)
    new_password: str | None = Field(default=None, min_length=8, max_length=72)

    @model_validator(mode="after")
    def _password_pair(self) -> MeUpdateIn:
        if self.new_password is not None and not self.current_password:
            raise ValueError("current_password is required to set new_password")
        if self.full_name is None and self.new_password is None:
            raise ValueError("nothing to update")
        return self
