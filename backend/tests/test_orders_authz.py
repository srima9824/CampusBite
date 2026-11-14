import pytest
from sqlalchemy import func, select

from app import seed
from app.models import MenuItem, Order, User
from app.security import create_access_token

# authz: access rules for the order routes (authentication, role, order ownership).

PASSWORD = "seed-pass-1234"


@pytest.fixture
def seeded(client, db_session):
    seed.seed_users(db_session, PASSWORD)
    seed.seed_restaurants(db_session)
    return client


def auth(db_session, local_part: str) -> dict:
    user = db_session.scalar(select(User).where(User.email == f"{local_part}@masaischool.ac.in"))
    return {"Authorization": f"Bearer {create_access_token(user)}"}


def order_body(db_session) -> dict:
    dish = db_session.scalar(select(MenuItem).order_by(MenuItem.id))
    return {"items": [{"menu_item_id": dish.id, "quantity": 1}], "delivery_address": "Hostel 4"}


def test_no_token_is_401_on_both_routes(seeded, db_session):
    post = seeded.post("/orders", json=order_body(db_session))
    get = seeded.get("/orders/1")

    assert post.status_code == 401
    assert get.status_code == 401
    assert db_session.scalar(select(func.count()).select_from(Order)) == 0


@pytest.mark.parametrize("local_part", ["owner1", "sam", "priya"])
def test_only_customers_can_use_order_routes(seeded, db_session, local_part):
    placed = seeded.post("/orders", json=order_body(db_session), headers=auth(db_session, "maya"))
    headers = auth(db_session, local_part)

    post = seeded.post("/orders", json=order_body(db_session), headers=headers)
    get = seeded.get(f"/orders/{placed.json()['id']}", headers=headers)

    assert post.status_code == get.status_code == 403
    assert post.json()["detail"]["code"] == get.json()["detail"]["code"] == "forbidden"
    assert db_session.scalar(select(func.count()).select_from(Order)) == 1


def test_forbidden_role_is_rejected_before_validation(seeded, db_session):
    response = seeded.post("/orders", json={}, headers=auth(db_session, "owner1"))

    assert response.status_code == 403


def test_other_customer_gets_same_404_as_missing_order(seeded, db_session):
    placed = seeded.post("/orders", json=order_body(db_session), headers=auth(db_session, "maya"))
    headers = auth(db_session, "leo")

    foreign = seeded.get(f"/orders/{placed.json()['id']}", headers=headers)
    missing = seeded.get("/orders/99999", headers=headers)

    assert foreign.status_code == missing.status_code == 404
    assert foreign.json() == missing.json()
    assert foreign.json()["detail"]["code"] == "order_not_found"


def test_owner_of_order_can_read_it(seeded, db_session):
    placed = seeded.post("/orders", json=order_body(db_session), headers=auth(db_session, "leo"))

    fetched = seeded.get(f"/orders/{placed.json()['id']}", headers=auth(db_session, "leo"))

    assert fetched.status_code == 200
    assert fetched.json() == placed.json()


def test_customer_comes_from_token_not_request(seeded, db_session):
    leo_id = db_session.scalar(select(User.id).where(User.email == "leo@masaischool.ac.in"))
    payload = {**order_body(db_session), "customer_id": leo_id}

    response = seeded.post("/orders", json=payload, headers=auth(db_session, "maya"))

    assert response.status_code == 422
    assert db_session.scalar(select(func.count()).select_from(Order)) == 0
