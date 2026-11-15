import pytest
from sqlalchemy import select

from app import seed
from app.models import User
from app.security import create_access_token

# authz: access rules for GET /orders (authentication, role).

PASSWORD = "seed-pass-1234"


@pytest.fixture
def seeded(client, db_session):
    seed.seed_users(db_session, PASSWORD)
    seed.seed_restaurants(db_session)
    return client


def auth(db_session, local_part: str) -> dict:
    user = db_session.scalar(select(User).where(User.email == f"{local_part}@masaischool.ac.in"))
    return {"Authorization": f"Bearer {create_access_token(user)}"}


def test_no_token_is_401(seeded):
    assert seeded.get("/orders").status_code == 401


@pytest.mark.parametrize("local_part", ["owner1", "sam", "priya"])
def test_only_customers_can_list_orders(seeded, db_session, local_part):
    response = seeded.get("/orders", headers=auth(db_session, local_part))

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "forbidden"


def test_role_is_checked_before_query_validation(seeded, db_session):
    response = seeded.get("/orders?page=0&status=NOPE", headers=auth(db_session, "owner1"))

    assert response.status_code == 403
