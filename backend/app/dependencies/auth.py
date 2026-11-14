from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.errors import api_error, not_authenticated
from app.models import Role, User
from app.security import InvalidTokenError, decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if credentials is None:
        raise not_authenticated()
    try:
        claims = decode_access_token(credentials.credentials)
        user = db.get(User, int(claims["sub"]))
    except (InvalidTokenError, ValueError):
        raise not_authenticated() from None
    if user is None:
        raise not_authenticated()
    return user

def require_roles(*roles: Role) -> Callable[[User], User]:
    def check_role(user: Annotated[User, Depends(get_current_user)]) -> User:
        if user.role not in roles:
            raise api_error(
                status.HTTP_403_FORBIDDEN, "forbidden", "You cannot access this resource."
            )
        return user

    return check_role
