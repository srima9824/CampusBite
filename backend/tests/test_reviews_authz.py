import pytest

from app import seed
from app.models import OrderStatus
from tests.test_owner_orders_api import auth, place, stamp

# authz: access rules for POST /orders/{order_id}/review (authentication, role, ownership).

PASSWORD = "seed-pass-1234"


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


def test_no_token_is_401(seeded, delivered_id):
    response = seeded.post(f"/orders/{delivered_id}/review", json={"rating": 5})

    assert response.status_code == 401


def test_garbage_token_is_401(seeded, delivered_id):
    response = seeded.post(
        f"/orders/{delivered_id}/review",
        json={"rating": 5},
        headers={"Authorization": "Bearer nope"},
    )

    assert response.status_code == 401


@pytest.mark.parametrize("local_part", ["owner1", "sam", "priya"])
def test_only_customers_can_review(seeded, db_session, delivered_id, local_part):
    response = seeded.post(
        f"/orders/{delivered_id}/review",
        json={"rating": 5},
        headers=auth(db_session, local_part),
    )

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "forbidden"


def test_role_is_checked_before_body_validation(seeded, db_session, delivered_id):
    response = seeded.post(
        f"/orders/{delivered_id}/review",
        json={"rating": 99},
        headers=auth(db_session, "owner1"),
    )

    assert response.status_code == 403


def test_another_customer_gets_404_not_403(seeded, db_session, delivered_id):
    response = seeded.post(
        f"/orders/{delivered_id}/review",
        json={"rating": 5},
        headers=auth(db_session, "leo"),
    )

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "order_not_found"
