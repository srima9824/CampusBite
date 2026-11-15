import pytest
from sqlalchemy import select

from app import seed
from app.models import Order, OrderStatus, Restaurant, Role, User
from app.security import create_access_token, hash_password

# authz: access rules for the owner order routes (authentication, role, restaurant ownership).

PASSWORD = "seed-pass-1234"
ROUTES = [
    ("GET", "/owner/orders", None),
    ("GET", "/owner/orders/{id}", None),
    ("PATCH", "/owner/orders/{id}/status", {"status": "ACCEPTED"}),
    ("PATCH", "/owner/orders/{id}/assign", {"delivery_partner_id": 1}),
    ("GET", "/owner/delivery-partners", None),
]
RESTAURANT_ROUTES = [route for route in ROUTES if route[1] != "/owner/delivery-partners"]


@pytest.fixture
def seeded(client, db_session):
    seed.seed_users(db_session, PASSWORD)
    seed.seed_restaurants(db_session)
    return client


def auth(db_session, local_part: str) -> dict:
    user = db_session.scalar(select(User).where(User.email == f"{local_part}@masaischool.ac.in"))
    return {"Authorization": f"Bearer {create_access_token(user)}"}


def order_at(db_session, owner_local_part: str, status=OrderStatus.PLACED) -> Order:
    restaurant = db_session.scalar(
        select(Restaurant)
        .join(User, User.id == Restaurant.owner_id)
        .where(User.email == f"{owner_local_part}@masaischool.ac.in")
    )
    customer = db_session.scalar(select(User).where(User.email == "maya@masaischool.ac.in"))
    order = Order(
        customer_id=customer.id,
        restaurant_id=restaurant.id,
        status=status,
        total=100,
        delivery_address="Hostel 4",
    )
    db_session.add(order)
    db_session.commit()
    return order


def call(client, method, path, body, headers=None, order_id=1):
    return client.request(method, path.format(id=order_id), json=body, headers=headers or {})


@pytest.mark.parametrize(("method", "path", "body"), ROUTES)
def test_no_token_is_401(seeded, method, path, body):
    response = call(seeded, method, path, body)

    assert response.status_code == 401


@pytest.mark.parametrize("local_part", ["maya", "sam"])
@pytest.mark.parametrize(("method", "path", "body"), ROUTES)
def test_customer_and_delivery_partner_are_403(seeded, db_session, local_part, method, path, body):
    order = order_at(db_session, "owner1")

    response = call(seeded, method, path, body, auth(db_session, local_part), order.id)

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "forbidden"
    db_session.expire_all()
    assert db_session.get(Order, order.id).status is OrderStatus.PLACED


@pytest.mark.parametrize(("method", "path", "body"), RESTAURANT_ROUTES)
def test_owner_without_restaurant_is_404(seeded, db_session, method, path, body):
    db_session.add(
        User(
            name="Newcomer",
            email="newcomer@masaischool.ac.in",
            password_hash=hash_password(PASSWORD),
            role=Role.RESTAURANT_OWNER,
        )
    )
    db_session.commit()

    response = call(seeded, method, path, body, auth(db_session, "newcomer"))

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "restaurant_not_found"


def test_owner_lists_never_contain_another_restaurants_orders(seeded, db_session):
    mine = order_at(db_session, "owner1")
    theirs = order_at(db_session, "owner3")

    body = seeded.get("/owner/orders", headers=auth(db_session, "owner1")).json()

    assert [o["id"] for o in body["items"]] == [mine.id]
    assert body["total"] == 1
    assert theirs.id not in [o["id"] for o in body["items"]]


@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        ("GET", "/owner/orders/{id}", None),
        ("PATCH", "/owner/orders/{id}/status", {"status": "ACCEPTED"}),
    ],
)
def test_owner_cannot_read_or_advance_another_restaurants_order(
    seeded, db_session, method, path, body
):
    theirs = order_at(db_session, "owner3")

    response = call(seeded, method, path, body, auth(db_session, "owner1"), theirs.id)

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "order_not_found"
    db_session.expire_all()
    assert db_session.get(Order, theirs.id).status is OrderStatus.PLACED


def test_owner_cannot_assign_on_another_restaurants_order(seeded, db_session):
    theirs = order_at(db_session, "owner3", OrderStatus.READY)
    sam = db_session.scalar(select(User.id).where(User.email == "sam@masaischool.ac.in"))

    response = call(
        seeded,
        "PATCH",
        "/owner/orders/{id}/assign",
        {"delivery_partner_id": sam},
        auth(db_session, "owner1"),
        theirs.id,
    )

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "order_not_found"
    db_session.expire_all()
    order = db_session.get(Order, theirs.id)
    assert order.status is OrderStatus.READY
    assert order.delivery_partner_id is None
