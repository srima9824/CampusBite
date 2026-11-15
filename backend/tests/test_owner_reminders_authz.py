import pytest
from sqlalchemy import select

from app import seed
from app.models import Role, User
from app.security import create_access_token, hash_password

# authz: access rules for GET /owner/reminders (authentication, role, restaurant ownership).

PASSWORD = "seed-pass-1234"
PATH = "/owner/reminders"


@pytest.fixture
def seeded(client, db_session):
    seed.seed_users(db_session, PASSWORD)
    seed.seed_restaurants(db_session)
    return client


def auth(db_session, local_part: str) -> dict:
    user = db_session.scalar(select(User).where(User.email == f"{local_part}@masaischool.ac.in"))
    return {"Authorization": f"Bearer {create_access_token(user)}"}


def test_no_token_is_401(seeded):
    assert seeded.get(PATH).status_code == 401


@pytest.mark.parametrize("local_part", ["maya", "sam"])
def test_customer_and_delivery_partner_are_403(seeded, db_session, local_part):
    response = seeded.get(PATH, headers=auth(db_session, local_part))

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "forbidden"


def test_owner_without_restaurant_is_404(seeded, db_session):
    db_session.add(
        User(
            name="Newcomer",
            email="newcomer@masaischool.ac.in",
            password_hash=hash_password(PASSWORD),
            role=Role.RESTAURANT_OWNER,
        )
    )
    db_session.commit()

    response = seeded.get(PATH, headers=auth(db_session, "newcomer"))

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "restaurant_not_found"


def test_owner_with_restaurant_is_200(seeded, db_session):
    assert seeded.get(PATH, headers=auth(db_session, "owner1")).status_code == 200
