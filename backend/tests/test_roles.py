from typing import Annotated

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.database import get_db
from app.dependencies.auth import require_roles
from app.models import Role, User
from app.security import create_access_token, hash_password


@pytest.fixture
def role_client(db_session):
    app = FastAPI()

    @app.get("/owner-only")
    def owner_only(user: Annotated[User, Depends(require_roles(Role.RESTAURANT_OWNER))]):
        return {"role": user.role.value}

    app.dependency_overrides[get_db] = lambda: db_session
    return TestClient(app)


def token_for_role(db_session, role: Role) -> str:
    user = User(
        name="Test",
        email=f"{role.value}@masaischool.ac.in",
        password_hash=hash_password("s3cret-pass-word"),
        role=role,
    )
    db_session.add(user)
    db_session.commit()
    return create_access_token(user)


@pytest.mark.parametrize(
    ("role", "status_code"),
    [
        (Role.RESTAURANT_OWNER, 200),
        (Role.CUSTOMER, 403),
        (Role.DELIVERY_PARTNER, 403),
    ],
)
def test_require_roles_by_role(role_client, db_session, role, status_code):
    token = token_for_role(db_session, role)

    response = role_client.get("/owner-only", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == status_code
    if status_code == 403:
        assert response.json()["detail"]["code"] == "forbidden"


def test_require_roles_without_token_is_unauthenticated(role_client):
    response = role_client.get("/owner-only")

    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"
