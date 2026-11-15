import pytest
from sqlalchemy import select

from app import seed
from app.models import Order, OrderStatus, PaymentLedger, ReturnStatus
from tests.test_delivery_orders_api import assigned, mine, move, user_id
from tests.test_delivery_orders_api import detail as delivery_detail
from tests.test_order_cancel_api import cancel
from tests.test_owner_assign_api import assign
from tests.test_owner_orders_api import advance, auth, listing, place, stamp
from tests.test_restaurant_ratings import by_id

PASSWORD = "seed-pass-1234"
NOT_DELIVERED = "You can ask for a return once the order has been delivered."
ALREADY_REQUESTED = "You have already asked for a return for this order."
RETURN_KEYS = {"return_status", "return_reason", "return_requested_at"}
NOT_RETURNABLE = [
    OrderStatus.PLACED,
    OrderStatus.ACCEPTED,
    OrderStatus.PREPARING,
    OrderStatus.READY,
    OrderStatus.ASSIGNED,
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.CANCELLED,
    OrderStatus.REFUNDED,
]
REASON = "The food arrived cold"


@pytest.fixture
def seeded(client, db_session):
    seed.seed_users(db_session, PASSWORD)
    seed.seed_restaurants(db_session)
    return client


def delivered(client, db_session, **kwargs) -> int:
    order_id = place(client, db_session, **kwargs)
    stamp(db_session, order_id, status=OrderStatus.DELIVERED)
    return order_id


def ask(client, db_session, order_id, body, who: str = "maya"):
    return client.post(f"/orders/{order_id}/return", json=body, headers=auth(db_session, who))


def reload(db_session, order_id) -> Order:
    db_session.expire_all()
    return db_session.get(Order, order_id)


def ledger(db_session, order_id) -> list[tuple]:
    rows = db_session.scalars(select(PaymentLedger).where(PaymentLedger.order_id == order_id))
    return [(r.amount, r.method, r.status) for r in rows]


def my_order(client, db_session, order_id, who: str = "maya") -> dict:
    return client.get(f"/orders/{order_id}", headers=auth(db_session, who)).json()


def owner_order(client, db_session, order_id, owner: str = "owner1"):
    return client.get(f"/owner/orders/{order_id}", headers=auth(db_session, owner))


# request


def test_return_request_returns_201_with_the_order_and_return_fields(seeded, db_session):
    order_id = delivered(seeded, db_session)
    paid = ledger(db_session, order_id)

    response = ask(seeded, db_session, order_id, {"reason": REASON})

    body = response.json()
    assert response.status_code == 201
    assert body["id"] == order_id
    assert body["status"] == "DELIVERED"
    assert body["payment"] == {"method": "mock", "status": "mock_paid"}
    assert body["return_status"] == "REQUESTED"
    assert body["return_reason"] == REASON
    assert body["return_requested_at"]
    assert len(paid) == 1
    assert ledger(db_session, order_id) == paid


def test_return_request_is_stored_on_the_order(seeded, db_session):
    order_id = delivered(seeded, db_session)

    ask(seeded, db_session, order_id, {"reason": REASON})

    order = reload(db_session, order_id)
    assert order.return_status is ReturnStatus.REQUESTED
    assert order.return_reason == REASON
    assert order.return_requested_at is not None
    assert order.status is OrderStatus.DELIVERED


def test_return_after_the_full_delivery_flow(seeded, db_session):
    order_id = place(seeded, db_session)
    for status in ("ACCEPTED", "PREPARING", "READY"):
        assert advance(seeded, db_session, order_id, status).status_code == 200
    assert assign(seeded, db_session, order_id, user_id(db_session, "sam")).status_code == 200
    for status in ("OUT_FOR_DELIVERY", "DELIVERED"):
        assert move(seeded, db_session, order_id, status).status_code == 200

    response = ask(seeded, db_session, order_id, {"reason": REASON})

    assert response.status_code == 201


# reason validation


@pytest.mark.parametrize("length", [5, 300])
def test_reason_boundaries_are_accepted(seeded, db_session, length):
    order_id = delivered(seeded, db_session)

    response = ask(seeded, db_session, order_id, {"reason": "x" * length})

    assert response.status_code == 201
    assert len(response.json()["return_reason"]) == length


@pytest.mark.parametrize("length", [4, 301])
def test_reason_outside_the_boundaries_is_422_and_changes_nothing(seeded, db_session, length):
    order_id = delivered(seeded, db_session)

    response = ask(seeded, db_session, order_id, {"reason": "x" * length})

    assert response.status_code == 422
    assert reload(db_session, order_id).return_status is None


@pytest.mark.parametrize(
    "body",
    [
        {"reason": ""},
        {"reason": "     "},
        {"reason": "  \n\t  "},
        {"reason": "  ab  "},
        {"reason": None},
        {"reason": 12345},
        {"reason": ["too cold"]},
        {"reason": True},
        {},
        {"reason": REASON, "return_status": "APPROVED"},
        {"reason": REASON, "status": "REFUNDED"},
    ],
    ids=[
        "empty",
        "spaces",
        "whitespace",
        "short-after-trim",
        "null",
        "number",
        "list",
        "bool",
        "missing",
        "extra-return-status",
        "extra-status",
    ],
)
def test_invalid_body_is_422_and_changes_nothing(seeded, db_session, body):
    order_id = delivered(seeded, db_session)

    response = ask(seeded, db_session, order_id, body)

    assert response.status_code == 422
    order = reload(db_session, order_id)
    assert order.return_status is None
    assert order.return_reason is None
    assert order.return_requested_at is None


def test_reason_is_trimmed_and_length_counts_the_trimmed_text(seeded, db_session):
    order_id = delivered(seeded, db_session)

    response = ask(seeded, db_session, order_id, {"reason": "   " + "x" * 300 + "  \n"})

    assert response.status_code == 201
    assert response.json()["return_reason"] == "x" * 300
    assert reload(db_session, order_id).return_reason == "x" * 300


def test_non_integer_order_id_is_422(seeded, db_session):
    assert ask(seeded, db_session, "abc", {"reason": REASON}).status_code == 422


# status rules


@pytest.mark.parametrize("status", NOT_RETURNABLE)
def test_undelivered_order_is_409_and_unchanged(seeded, db_session, status):
    order_id = place(seeded, db_session)
    stamp(db_session, order_id, status=status)
    before = reload(db_session, order_id).updated_at

    response = ask(seeded, db_session, order_id, {"reason": REASON})

    assert response.status_code == 409
    assert response.json()["detail"] == {"code": "return_not_allowed", "message": NOT_DELIVERED}
    order = reload(db_session, order_id)
    assert order.status is status
    assert order.return_status is None
    assert order.return_reason is None
    assert order.return_requested_at is None
    assert order.updated_at == before


def test_second_request_is_409_and_the_first_is_unchanged(seeded, db_session):
    order_id = delivered(seeded, db_session)
    first = ask(seeded, db_session, order_id, {"reason": "First reason"}).json()

    response = ask(seeded, db_session, order_id, {"reason": "Second reason"})

    assert response.status_code == 409
    assert response.json()["detail"] == {"code": "return_exists", "message": ALREADY_REQUESTED}
    order = reload(db_session, order_id)
    assert order.return_reason == "First reason"
    assert order.return_status is ReturnStatus.REQUESTED
    assert my_order(seeded, db_session, order_id)["return_requested_at"] == (
        first["return_requested_at"]
    )


def test_requesting_a_return_for_one_order_does_not_block_another(seeded, db_session):
    first = delivered(seeded, db_session)
    second = delivered(seeded, db_session)

    assert ask(seeded, db_session, first, {"reason": REASON}).status_code == 201
    assert ask(seeded, db_session, second, {"reason": REASON}).status_code == 201


@pytest.mark.parametrize("order_id", [999, 0, -1])
def test_unknown_order_is_404(seeded, db_session, order_id):
    response = ask(seeded, db_session, order_id, {"reason": REASON})

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "order_not_found"


# the order views


def test_customer_views_show_null_return_fields_before_a_request(seeded, db_session):
    order_id = delivered(seeded, db_session)

    one = my_order(seeded, db_session, order_id)
    listed = seeded.get("/orders", headers=auth(db_session, "maya")).json()["items"][0]

    for body in (one, listed):
        assert {k: body[k] for k in RETURN_KEYS} == dict.fromkeys(RETURN_KEYS)


def test_customer_views_show_the_return_after_a_request(seeded, db_session):
    order_id = delivered(seeded, db_session)
    created = ask(seeded, db_session, order_id, {"reason": f"  {REASON} "}).json()

    one = my_order(seeded, db_session, order_id)
    listed = seeded.get("/orders", headers=auth(db_session, "maya")).json()["items"][0]

    for body in (one, listed):
        assert body["return_status"] == "REQUESTED"
        assert body["return_reason"] == REASON
        assert body["return_requested_at"] == created["return_requested_at"]


def test_owner_views_show_null_return_fields_before_a_request(seeded, db_session):
    order_id = delivered(seeded, db_session)

    one = owner_order(seeded, db_session, order_id).json()
    listed = listing(seeded, db_session).json()["items"][0]

    for body in (one, listed):
        assert {k: body[k] for k in RETURN_KEYS} == dict.fromkeys(RETURN_KEYS)


def test_owner_sees_the_return_for_their_restaurants_order(seeded, db_session):
    order_id = delivered(seeded, db_session)
    created = ask(seeded, db_session, order_id, {"reason": REASON}).json()

    one = owner_order(seeded, db_session, order_id).json()
    listed = listing(seeded, db_session).json()["items"][0]

    for body in (one, listed):
        assert body["return_status"] == "REQUESTED"
        assert body["return_reason"] == REASON
        assert body["return_requested_at"] == created["return_requested_at"]
        assert body["status"] == "DELIVERED"


def test_another_owner_cannot_see_the_returned_order(seeded, db_session):
    order_id = delivered(seeded, db_session)
    ask(seeded, db_session, order_id, {"reason": REASON})

    response = owner_order(seeded, db_session, order_id, "owner3")
    other = listing(seeded, db_session, owner="owner3").json()

    assert response.status_code == 404
    assert other["items"] == []
    assert REASON not in response.text


def test_delivery_partner_views_do_not_contain_return_fields(seeded, db_session):
    order_id = assigned(seeded, db_session, status=OrderStatus.DELIVERED)
    ask(seeded, db_session, order_id, {"reason": REASON})

    one = delivery_detail(seeded, db_session, order_id)
    listed = mine(seeded, db_session, "?status=DELIVERED")

    assert one.status_code == listed.status_code == 200
    assert RETURN_KEYS.isdisjoint(one.json())
    assert order_id in [o["id"] for o in listed.json()["items"]]
    assert RETURN_KEYS.isdisjoint(listed.json()["items"][0])
    assert REASON not in one.text + listed.text


# interplay


def test_cancel_after_delivery_is_still_409_and_keeps_the_return(seeded, db_session):
    order_id = delivered(seeded, db_session)
    ask(seeded, db_session, order_id, {"reason": REASON})

    response = cancel(seeded, db_session, order_id)

    assert response.status_code == 409
    order = reload(db_session, order_id)
    assert order.status is OrderStatus.DELIVERED
    assert order.return_status is ReturnStatus.REQUESTED
    assert len(ledger(db_session, order_id)) == 1


def test_return_request_leaves_the_review_and_average_rating_alone(seeded, db_session):
    order_id = delivered(seeded, db_session)
    headers = auth(db_session, "maya")
    restaurant_id = db_session.get(Order, order_id).restaurant_id
    seeded.post(f"/orders/{order_id}/review", json={"rating": 4, "comment": "Ok"}, headers=headers)
    before = by_id(seeded)[restaurant_id]

    ask(seeded, db_session, order_id, {"reason": REASON})

    after = by_id(seeded)[restaurant_id]
    assert (after["average_rating"], after["review_count"]) == (4.0, 1)
    assert after == before
    again = seeded.post(f"/orders/{order_id}/review", json={"rating": 1}, headers=headers)
    assert again.status_code == 409
    assert again.json()["detail"]["code"] == "review_exists"


def test_a_review_can_still_be_left_after_a_return_request(seeded, db_session):
    order_id = delivered(seeded, db_session)
    ask(seeded, db_session, order_id, {"reason": REASON})

    response = seeded.post(
        f"/orders/{order_id}/review", json={"rating": 2}, headers=auth(db_session, "maya")
    )

    assert response.status_code == 201


@pytest.mark.parametrize("target", ["ACCEPTED", "READY", "CANCELLED"])
def test_owner_cannot_move_a_returned_delivered_order(seeded, db_session, target):
    order_id = delivered(seeded, db_session)
    ask(seeded, db_session, order_id, {"reason": REASON})

    response = advance(seeded, db_session, order_id, target)

    assert response.status_code in (409, 422)
    assert reload(db_session, order_id).status is OrderStatus.DELIVERED


def test_owner_cannot_assign_a_returned_delivered_order(seeded, db_session):
    order_id = delivered(seeded, db_session)
    ask(seeded, db_session, order_id, {"reason": REASON})

    response = assign(seeded, db_session, order_id, user_id(db_session, "sam"))

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "invalid_transition"
    order = reload(db_session, order_id)
    assert order.status is OrderStatus.DELIVERED
    assert order.delivery_partner_id is None
