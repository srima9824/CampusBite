import pytest
from sqlalchemy import select

from app import seed
from app.models import Order, OrderStatus, Restaurant, User
from app.security import create_access_token

# authz: access rules for the delivery partner order routes (authentication, role, assignment).

PASSWORD = "seed-pass-1234"
ROUTES = [
    ("GET", "/delivery/orders", None),
    ("GET", "/delivery/orders/{id}", None),
    ("PATCH", "/delivery/orders/{id}/status", {"status": "OUT_FOR_DELIVERY"}),
]
OWNER_ROUTES = [
    ("GET", "/owner/orders", None),
    ("GET", "/owner/orders/{id}", None),
    ("PATCH", "/owner/orders/{id}/status", {"status": "ACCEPTED"}),
    ("PATCH", "/owner/orders/{id}/assign", {"delivery_partner_id": 1}),
    ("GET", "/owner/delivery-partners", None),
]


@pytest.fixture
def seeded(client, db_session):
    seed.seed_users(db_session, PASSWORD)
    seed.seed_restaurants(db_session)
    return client


def user(db_session, local_part: str) -> User:
    return db_session.scalar(select(User).where(User.email == f"{local_part}@masaischool.ac.in"))


def auth(db_session, local_part: str) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user(db_session, local_part))}"}


def order_for(db_session, partner: str | None, status=OrderStatus.ASSIGNED) -> Order:
    restaurant = db_session.scalars(select(Restaurant).order_by(Restaurant.id)).first()
    order = Order(
        customer_id=user(db_session, "maya").id,
        restaurant_id=restaurant.id,
        status=status,
        total=100,
        delivery_address="Hostel 4",
        delivery_partner_id=user(db_session, partner).id if partner else None,
    )
    db_session.add(order)
    db_session.commit()
    return order


def call(client, method, path, body, headers=None, order_id=1):
    return client.request(method, path.format(id=order_id), json=body, headers=headers or {})


@pytest.mark.parametrize(("method", "path", "body"), ROUTES)
def test_no_token_is_401(seeded, method, path, body):
    assert call(seeded, method, path, body).status_code == 401


@pytest.mark.parametrize(("method", "path", "body"), ROUTES)
def test_a_bad_token_is_401(seeded, method, path, body):
    headers = {"Authorization": "Bearer not-a-token"}

    assert call(seeded, method, path, body, headers).status_code == 401


@pytest.mark.parametrize("local_part", ["maya", "owner1"])
@pytest.mark.parametrize(("method", "path", "body"), ROUTES)
def test_customer_and_owner_are_403(seeded, db_session, local_part, method, path, body):
    order = order_for(db_session, "sam")

    response = call(seeded, method, path, body, auth(db_session, local_part), order.id)

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "forbidden"
    db_session.expire_all()
    assert db_session.get(Order, order.id).status is OrderStatus.ASSIGNED


@pytest.mark.parametrize(("method", "path", "body"), OWNER_ROUTES)
def test_partner_cannot_use_owner_routes(seeded, db_session, method, path, body):
    order = order_for(db_session, "sam", OrderStatus.READY)

    response = call(seeded, method, path, body, auth(db_session, "sam"), order.id)

    assert response.status_code == 403
    db_session.expire_all()
    assert db_session.get(Order, order.id).status is OrderStatus.READY


@pytest.mark.parametrize("status", [OrderStatus.READY, OrderStatus.ASSIGNED])
@pytest.mark.parametrize(
    ("method", "path", "body"),
    [r for r in ROUTES if r[1] != "/delivery/orders"],
)
def test_partner_cannot_touch_an_order_not_assigned_to_them(
    seeded, db_session, status, method, path, body
):
    unassigned = order_for(db_session, None, status)
    theirs = order_for(db_session, "priya", status)

    for order in (unassigned, theirs):
        response = call(seeded, method, path, body, auth(db_session, "sam"), order.id)
        assert response.status_code == 404
        assert response.json()["detail"]["code"] == "order_not_found"
    db_session.expire_all()
    assert db_session.get(Order, unassigned.id).status is status
    assert db_session.get(Order, theirs.id).status is status


def test_lists_totals_and_details_never_leak_other_partners_orders(seeded, db_session):
    own = order_for(db_session, "sam")
    other = order_for(db_session, "priya")
    order_for(db_session, None, OrderStatus.READY)

    body = seeded.get("/delivery/orders", headers=auth(db_session, "sam")).json()
    peek = seeded.get(f"/delivery/orders/{other.id}", headers=auth(db_session, "sam"))

    assert [o["id"] for o in body["items"]] == [own.id]
    assert body["total"] == 1
    assert peek.status_code == 404
    assert str(other.id) not in [str(o["id"]) for o in body["items"]]
