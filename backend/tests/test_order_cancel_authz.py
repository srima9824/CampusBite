import pytest
from sqlalchemy import select

from app import seed
from app.models import MenuItem, Order, OrderStatus, PaymentLedger, User
from app.security import create_access_token

# authz: access rules for POST /orders/{id}/cancel (authentication, role, order ownership).

PASSWORD = "seed-pass-1234"


@pytest.fixture
def seeded(client, db_session):
    seed.seed_users(db_session, PASSWORD)
    seed.seed_restaurants(db_session)
    return client


def auth(db_session, local_part: str) -> dict:
    user = db_session.scalar(select(User).where(User.email == f"{local_part}@masaischool.ac.in"))
    return {"Authorization": f"Bearer {create_access_token(user)}"}


def place(client, db_session, who: str = "maya") -> int:
    dish = db_session.scalar(select(MenuItem).order_by(MenuItem.id))
    payload = {"items": [{"menu_item_id": dish.id, "quantity": 1}], "delivery_address": "Hostel 4"}
    response = client.post("/orders", json=payload, headers=auth(db_session, who))
    assert response.status_code == 201
    return response.json()["id"]


def unchanged(db_session, order_id: int) -> bool:
    db_session.expire_all()
    order = db_session.get(Order, order_id)
    rows = list(db_session.scalars(select(PaymentLedger).where(PaymentLedger.order_id == order_id)))
    return order.status is OrderStatus.PLACED and len(rows) == 1


def test_no_token_is_401(seeded, db_session):
    order_id = place(seeded, db_session)

    response = seeded.post(f"/orders/{order_id}/cancel")

    assert response.status_code == 401
    assert unchanged(db_session, order_id)


@pytest.mark.parametrize("local_part", ["owner1", "priya"])
def test_only_customers_can_cancel(seeded, db_session, local_part):
    order_id = place(seeded, db_session)

    response = seeded.post(f"/orders/{order_id}/cancel", headers=auth(db_session, local_part))

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "forbidden"
    assert unchanged(db_session, order_id)


def test_other_customer_gets_same_404_as_missing_order(seeded, db_session):
    order_id = place(seeded, db_session, "maya")
    headers = auth(db_session, "leo")

    foreign = seeded.post(f"/orders/{order_id}/cancel", headers=headers)
    missing = seeded.post("/orders/99999/cancel", headers=headers)

    assert foreign.status_code == missing.status_code == 404
    assert foreign.json() == missing.json()
    assert foreign.json()["detail"]["code"] == "order_not_found"
    assert unchanged(db_session, order_id)
