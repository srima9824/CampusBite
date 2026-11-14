import re
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints

from app.models import Role

EMAIL_PATTERN = re.compile(r"[^\s@]+@masaischool\.ac\.in")
EMAIL_MESSAGE = "Use your @masaischool.ac.in email address."


def normalize_email(value: str) -> str:
    email = value.strip().lower()
    if not EMAIL_PATTERN.fullmatch(email):
        raise ValueError(EMAIL_MESSAGE)
    return email


def reject_long_password(value: str) -> str:
    if len(value.encode()) > 72:
        raise ValueError("Password must be at most 72 bytes.")
    return value


Email = Annotated[str, AfterValidator(normalize_email)]
LoginPassword = Annotated[str, AfterValidator(reject_long_password)]
NewPassword = Annotated[LoginPassword, Field(min_length=8)]


class RegisterRequest(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    email: Email
    password: NewPassword


class LoginRequest(BaseModel):
    email: Email
    password: LoginPassword


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    role: Role


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
