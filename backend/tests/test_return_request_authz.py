import pytest

from app import seed
from app.models import Order, OrderStatus
from tests.test_owner_orders_api import auth, place, stamp

# authz: access rules for POST /orders/{id}/return (authentication, role, order ownership).

PASSWORD = "seed-pass-1234"
BODY = {"reason": "The food arrived cold"}


@pytest.fixture
def seeded(client, db_session):
    seed.seed_users(db_session, PASSWORD)
    seed.seed_restaurants(db_session)
    return client


@pytest.fixture
def delivered_id(seeded, db_session) -> int:
    order_id = place(seeded, db_session)
    stamp(db_session, order_id, status=OrderStatus.DELIVERED)
    return order_id


def untouched(db_session, order_id: int) -> bool:
    db_session.expire_all()
    return db_session.get(Order, order_id).return_status is None


def test_no_token_is_401(seeded, db_session, delivered_id):
    response = seeded.post(f"/orders/{delivered_id}/return", json=BODY)

    assert response.status_code == 401
    assert untouched(db_session, delivered_id)


def test_bad_token_is_401(seeded, db_session, delivered_id):
    response = seeded.post(
        f"/orders/{delivered_id}/return", json=BODY, headers={"Authorization": "Bearer nope"}
    )

    assert response.status_code == 401
    assert untouched(db_session, delivered_id)


@pytest.mark.parametrize("local_part", ["owner1", "sam", "priya"])
def test_only_customers_can_ask_for_a_return(seeded, db_session, delivered_id, local_part):
    response = seeded.post(
        f"/orders/{delivered_id}/return", json=BODY, headers=auth(db_session, local_part)
    )

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "forbidden"
    assert untouched(db_session, delivered_id)


def test_role_is_checked_before_body_validation(seeded, db_session, delivered_id):
    response = seeded.post(
        f"/orders/{delivered_id}/return", json={"reason": ""}, headers=auth(db_session, "owner1")
    )

    assert response.status_code == 403


def test_another_customer_gets_the_same_404_as_a_missing_order(seeded, db_session, delivered_id):
    headers = auth(db_session, "leo")

    foreign = seeded.post(f"/orders/{delivered_id}/return", json=BODY, headers=headers)
    missing = seeded.post("/orders/99999/return", json=BODY, headers=headers)

    assert foreign.status_code == missing.status_code == 404
    assert foreign.json() == missing.json()
    assert foreign.json()["detail"]["code"] == "order_not_found"
    assert untouched(db_session, delivered_id)
