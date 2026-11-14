from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.errors import api_error
from app.models import Role, User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserOut
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

DUMMY_HASH = hash_password("not-a-real-password")


def email_taken() -> Exception:
    return api_error(status.HTTP_409_CONFLICT, "email_taken", "This email is already registered.")


def invalid_credentials() -> Exception:
    return api_error(
        status.HTTP_401_UNAUTHORIZED, "invalid_credentials", "Wrong email or password."
    )


def token_for(user: User) -> TokenResponse:
    return TokenResponse(access_token=create_access_token(user), user=UserOut.model_validate(user))


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Annotated[Session, Depends(get_db)]) -> TokenResponse:
    if db.scalar(select(User.id).where(User.email == body.email)) is not None:
        raise email_taken()
    user = User(
        name=body.name,
        email=body.email,
        password_hash=hash_password(body.password),
        role=Role.CUSTOMER,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise email_taken() from None
    return token_for(user)


@router.post("/login")
def login(body: LoginRequest, db: Annotated[Session, Depends(get_db)]) -> TokenResponse:
    user = db.scalar(select(User).where(User.email == body.email))
    password_hash = user.password_hash if user else DUMMY_HASH
    password_ok = verify_password(body.password, password_hash)
    if user is None or not password_ok:
        raise invalid_credentials()
    return token_for(user)


@router.get("/me")
def read_current_user(user: Annotated[User, Depends(get_current_user)]) -> UserOut:
    return UserOut.model_validate(user)
