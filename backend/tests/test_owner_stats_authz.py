import pytest

from app import seed
from app.models import Role, User
from app.security import hash_password
from tests.test_owner_orders_authz import auth

# authz: access rules for the owner statistics route (authentication, role, restaurant ownership).

PASSWORD = "seed-pass-1234"


@pytest.fixture
def seeded(client, db_session):
    seed.seed_users(db_session, PASSWORD)
    seed.seed_restaurants(db_session)
    return client


def test_no_token_is_401(seeded):
    response = seeded.get("/owner/stats")

    assert response.status_code == 401


@pytest.mark.parametrize("local_part", ["maya", "sam"])
def test_customer_and_delivery_partner_are_403(seeded, db_session, local_part):
    response = seeded.get("/owner/stats", headers=auth(db_session, local_part))

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

    response = seeded.get("/owner/stats", headers=auth(db_session, "newcomer"))

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "restaurant_not_found"
