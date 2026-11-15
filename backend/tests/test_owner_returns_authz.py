import pytest
from sqlalchemy import select

from app import seed
from app.models import Order, OrderStatus, PaymentLedger, ReturnStatus, Role, User
from app.security import hash_password
from tests.test_owner_orders_authz import auth, call, order_at

# authz: access rules for the owner return routes (authentication, role, restaurant ownership).

PASSWORD = "seed-pass-1234"
ROUTES = [
    ("GET", "/owner/returns", None),
    ("PATCH", "/owner/orders/{id}/return", {"decision": "APPROVED"}),
]


@pytest.fixture
def seeded(client, db_session):
    seed.seed_users(db_session, PASSWORD)
    seed.seed_restaurants(db_session)
    return client


def with_return(db_session, owner: str) -> Order:
    order = order_at(db_session, owner, OrderStatus.DELIVERED)
    order.return_status = ReturnStatus.REQUESTED
    order.return_reason = "The food arrived cold"
    db_session.commit()
    return order


def untouched(db_session, order_id: int) -> bool:
    db_session.expire_all()
    order = db_session.get(Order, order_id)
    rows = db_session.scalars(select(PaymentLedger).where(PaymentLedger.order_id == order_id))
    return (
        order.status is OrderStatus.DELIVERED
        and order.return_status is ReturnStatus.REQUESTED
        and not list(rows)
    )


@pytest.mark.parametrize(("method", "path", "body"), ROUTES)
def test_no_token_is_401(seeded, method, path, body):
    response = call(seeded, method, path, body)

    assert response.status_code == 401


@pytest.mark.parametrize("local_part", ["maya", "sam"])
@pytest.mark.parametrize(("method", "path", "body"), ROUTES)
def test_customer_and_delivery_partner_are_403(seeded, db_session, local_part, method, path, body):
    order = with_return(db_session, "owner1")

    response = call(seeded, method, path, body, auth(db_session, local_part), order.id)

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "forbidden"
    assert untouched(db_session, order.id)


@pytest.mark.parametrize(("method", "path", "body"), ROUTES)
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


def test_owner_list_never_contains_another_restaurants_returns(seeded, db_session):
    mine = with_return(db_session, "owner1")
    theirs = with_return(db_session, "owner3")

    body = seeded.get("/owner/returns", headers=auth(db_session, "owner1")).json()

    assert [o["id"] for o in body["items"]] == [mine.id]
    assert body["total"] == 1
    assert theirs.id not in [o["id"] for o in body["items"]]


@pytest.mark.parametrize("decision", ["APPROVED", "REJECTED"])
def test_owner_cannot_decide_another_restaurants_return(seeded, db_session, decision):
    theirs = with_return(db_session, "owner3")

    response = call(
        seeded,
        "PATCH",
        "/owner/orders/{id}/return",
        {"decision": decision},
        auth(db_session, "owner1"),
        theirs.id,
    )

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "order_not_found"
    assert untouched(db_session, theirs.id)
