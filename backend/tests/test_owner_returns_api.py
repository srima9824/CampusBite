from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, func, select

from app import seed
from app.main import app
from app.models import (
    Order,
    OrderStatus,
    PaymentLedger,
    PaymentStatus,
    ReturnStatus,
    Review,
)
from tests.test_delivery_orders_api import assigned, mine, move, user_id
from tests.test_delivery_orders_api import detail as delivery_detail
from tests.test_order_cancel_api import cancel
from tests.test_owner_assign_api import assign
from tests.test_owner_orders_api import ORDER_KEYS, advance, auth, utc
from tests.test_restaurant_ratings import by_id
from tests.test_return_request_api import RETURN_KEYS, ask, delivered, my_order, reload

PASSWORD = "seed-pass-1234"
NOT_PENDING = "This order has no return request waiting for a decision."
DECIDED = "This return request was already decided."
DECISIONS = ["APPROVED", "REJECTED"]


@pytest.fixture
def seeded(client, db_session):
    seed.seed_users(db_session, PASSWORD)
    seed.seed_restaurants(db_session)
    return client


def requested(client, db_session, owner: str = "owner1", at: str | None = None, who="maya") -> int:
    order_id = delivered(client, db_session, owner=owner, who=who)
    assert (
        ask(client, db_session, order_id, {"reason": "The food arrived cold"}, who).status_code
        == 201
    )
    if at is not None:
        db_session.get(Order, order_id).return_requested_at = utc(at)
        db_session.commit()
    return order_id


def decide(client, db_session, order_id, decision, owner: str = "owner1"):
    return client.patch(
        f"/owner/orders/{order_id}/return",
        json={"decision": decision},
        headers=auth(db_session, owner),
    )


def returns(client, db_session, query: str = "", owner: str = "owner1"):
    return client.get(f"/owner/returns{query}", headers=auth(db_session, owner))


def ids(response) -> list[int]:
    return [o["id"] for o in response.json()["items"]]


def ledger_rows(db_session, order_id) -> list[PaymentLedger]:
    db_session.expire_all()
    return list(
        db_session.scalars(
            select(PaymentLedger)
            .where(PaymentLedger.order_id == order_id)
            .order_by(PaymentLedger.id)
        )
    )


def snapshot(db_session, order_id):
    order = reload(db_session, order_id)
    rows = [(r.status, r.amount, r.method) for r in ledger_rows(db_session, order_id)]
    return order.status, order.payment_status, order.return_status, order.updated_at, rows


# list


def test_list_is_empty_without_returns(seeded, db_session):
    delivered(seeded, db_session)

    response = returns(seeded, db_session)

    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0, "page": 1, "page_size": 10}


def test_list_shape_matches_owner_orders_without_email(seeded, db_session):
    order_id = requested(seeded, db_session)

    response = returns(seeded, db_session)

    item = response.json()["items"][0]
    assert set(item) == ORDER_KEYS
    assert item["id"] == order_id
    assert item["customer"] == {"name": "Maya Patel"}
    assert item["return_status"] == "REQUESTED"
    assert item["return_reason"] == "The food arrived cold"
    assert item["return_requested_at"]
    assert item["payment"] == {"method": "mock", "status": "mock_paid"}
    assert "maya@" not in response.text


def test_list_only_has_orders_with_a_return(seeded, db_session):
    plain = delivered(seeded, db_session)
    with_return = requested(seeded, db_session)

    response = returns(seeded, db_session)

    assert ids(response) == [with_return]
    assert plain not in ids(response)
    assert response.json()["total"] == 1


def test_list_is_scoped_to_the_owners_restaurant(seeded, db_session):
    mine_id = requested(seeded, db_session, "owner1")
    theirs = requested(seeded, db_session, "owner3")

    assert ids(returns(seeded, db_session)) == [mine_id]
    assert ids(returns(seeded, db_session, owner="owner3")) == [theirs]


def test_list_is_newest_request_first_with_id_tiebreak(seeded, db_session):
    oldest = requested(seeded, db_session, at="2026-03-01T10:00:00")
    newest = requested(seeded, db_session, at="2026-03-05T10:00:00")
    tie_a = requested(seeded, db_session, at="2026-03-03T10:00:00")
    tie_b = requested(seeded, db_session, at="2026-03-03T10:00:00")

    assert ids(returns(seeded, db_session)) == [newest, tie_b, tie_a, oldest]


@pytest.fixture
def mixed(seeded, db_session):
    first = requested(seeded, db_session, at="2026-03-01T10:00:00")
    second = requested(seeded, db_session, at="2026-03-02T10:00:00")
    third = requested(seeded, db_session, at="2026-03-03T10:00:00")
    assert decide(seeded, db_session, first, "APPROVED").status_code == 200
    assert decide(seeded, db_session, second, "REJECTED").status_code == 200
    return {"APPROVED": first, "REJECTED": second, "REQUESTED": third}


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("", ["REQUESTED", "REJECTED", "APPROVED"]),
        ("?return_status=", ["REQUESTED", "REJECTED", "APPROVED"]),
        ("?return_status=REQUESTED", ["REQUESTED"]),
        ("?return_status=APPROVED", ["APPROVED"]),
        ("?return_status=REJECTED", ["REJECTED"]),
        ("?return_status=APPROVED,REJECTED", ["REJECTED", "APPROVED"]),
        ("?return_status=REQUESTED, APPROVED", ["REQUESTED", "APPROVED"]),
    ],
)
def test_list_filters_by_return_status(seeded, db_session, mixed, query, expected):
    response = returns(seeded, db_session, query)

    assert response.status_code == 200
    assert ids(response) == [mixed[s] for s in expected]
    assert response.json()["total"] == len(expected)


@pytest.mark.parametrize(
    "query",
    [
        "?return_status=requested",
        "?return_status=DELIVERED",
        "?return_status=APPROVED,nope",
        "?return_status=APPROVED,",
    ],
)
def test_list_rejects_unknown_return_status(seeded, db_session, query):
    response = returns(seeded, db_session, query)

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "invalid_return_status"


def test_list_paginates_with_total(seeded, db_session):
    made = [requested(seeded, db_session, at=f"2026-03-0{n}T10:00:00") for n in range(1, 6)]
    newest_first = list(reversed(made))

    first = returns(seeded, db_session, "?page=1&page_size=2").json()
    last = returns(seeded, db_session, "?page=3&page_size=2").json()
    beyond = returns(seeded, db_session, "?page=4&page_size=2").json()

    assert [o["id"] for o in first["items"]] == newest_first[:2]
    assert [o["id"] for o in last["items"]] == newest_first[4:]
    assert first["total"] == last["total"] == beyond["total"] == 5
    assert beyond["items"] == []
    assert (first["page"], first["page_size"]) == (1, 2)


@pytest.mark.parametrize("query", ["?page=0", "?page_size=0", "?page_size=51", "?page=x"])
def test_list_rejects_bad_paging(seeded, db_session, query):
    assert returns(seeded, db_session, query).status_code == 422


def test_list_page_size_default_is_10_and_max_is_50(seeded, db_session):
    for _ in range(12):
        requested(seeded, db_session)

    default = returns(seeded, db_session).json()
    biggest = returns(seeded, db_session, "?page_size=50").json()

    assert len(default["items"]) == 10
    assert default["page_size"] == 10
    assert len(biggest["items"]) == 12


# approve


def test_approve_refunds_the_order_and_adds_one_ledger_row(seeded, db_session):
    order_id = requested(seeded, db_session)
    stamp_order = reload(db_session, order_id)
    total = stamp_order.total
    stamp_order.updated_at = stamp_order.updated_at - timedelta(days=1)
    db_session.commit()
    before = snapshot(db_session, order_id)

    response = decide(seeded, db_session, order_id, "APPROVED")

    body = response.json()
    order = reload(db_session, order_id)
    rows = ledger_rows(db_session, order_id)
    assert response.status_code == 200
    assert set(body) == ORDER_KEYS
    assert body["status"] == "REFUNDED"
    assert body["payment"] == {"method": "mock", "status": "refunded"}
    assert body["return_status"] == "APPROVED"
    assert body["customer"] == {"name": "Maya Patel"}
    assert order.status is OrderStatus.REFUNDED
    assert order.payment_status is PaymentStatus.REFUNDED
    assert order.return_status is ReturnStatus.APPROVED
    assert order.updated_at > before[3]
    assert [r.status for r in rows] == [PaymentStatus.MOCK_PAID, PaymentStatus.REFUNDED]
    assert [r.amount for r in rows] == [total, total]
    assert {r.method for r in rows} == {"mock"}
    assert len(before[4]) == 1


def test_approved_order_appears_in_the_list_as_approved(seeded, db_session):
    order_id = requested(seeded, db_session)
    decide(seeded, db_session, order_id, "APPROVED")

    item = returns(seeded, db_session, "?return_status=APPROVED").json()["items"][0]

    assert item["id"] == order_id
    assert item["status"] == "REFUNDED"
    assert item["payment"]["status"] == "refunded"


# reject


def test_reject_keeps_the_order_delivered_and_paid(seeded, db_session):
    order_id = requested(seeded, db_session)
    before = snapshot(db_session, order_id)

    response = decide(seeded, db_session, order_id, "REJECTED")

    body = response.json()
    order = reload(db_session, order_id)
    assert response.status_code == 200
    assert body["status"] == "DELIVERED"
    assert body["payment"] == {"method": "mock", "status": "mock_paid"}
    assert body["return_status"] == "REJECTED"
    assert order.status is OrderStatus.DELIVERED
    assert order.payment_status is PaymentStatus.MOCK_PAID
    assert order.return_status is ReturnStatus.REJECTED
    assert order.return_reason == "The food arrived cold"
    assert [(r.status, r.amount) for r in ledger_rows(db_session, order_id)] == [
        (PaymentStatus.MOCK_PAID, order.total)
    ]
    assert len(before[4]) == 1


# deciding twice


@pytest.mark.parametrize("second", DECISIONS)
@pytest.mark.parametrize("first", DECISIONS)
def test_a_decided_return_cannot_be_decided_again(seeded, db_session, first, second):
    order_id = requested(seeded, db_session)
    assert decide(seeded, db_session, order_id, first).status_code == 200
    after_first = snapshot(db_session, order_id)

    response = decide(seeded, db_session, order_id, second)

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "return_not_pending"
    assert response.json()["detail"]["message"] == DECIDED
    assert snapshot(db_session, order_id) == after_first
    expected_rows = 2 if first == "APPROVED" else 1
    assert len(ledger_rows(db_session, order_id)) == expected_rows


@pytest.mark.parametrize("decision", DECISIONS)
def test_an_order_without_a_return_is_409(seeded, db_session, decision):
    order_id = delivered(seeded, db_session)
    before = snapshot(db_session, order_id)

    response = decide(seeded, db_session, order_id, decision)

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "return_not_pending"
    assert response.json()["detail"]["message"] == NOT_PENDING
    assert snapshot(db_session, order_id) == before


@pytest.mark.parametrize(
    "body",
    [
        {"decision": "approved"},
        {"decision": "rejected"},
        {"decision": "REQUESTED"},
        {"decision": "REFUNDED"},
        {"decision": ""},
        {"decision": None},
        {"decision": True},
        {},
        {"decision": "APPROVED", "status": "REFUNDED"},
        {"decision": "APPROVED", "amount": 1},
        {"status": "APPROVED"},
    ],
)
def test_a_bad_body_is_422_and_changes_nothing(seeded, db_session, body):
    order_id = requested(seeded, db_session)
    before = snapshot(db_session, order_id)

    response = seeded.patch(
        f"/owner/orders/{order_id}/return", json=body, headers=auth(db_session, "owner1")
    )

    assert response.status_code == 422
    assert snapshot(db_session, order_id) == before


def test_another_restaurants_or_unknown_order_is_404_and_unchanged(seeded, db_session):
    theirs = requested(seeded, db_session, "owner3")
    before = snapshot(db_session, theirs)

    cross = decide(seeded, db_session, theirs, "APPROVED")
    unknown = decide(seeded, db_session, 999999, "APPROVED")

    assert cross.status_code == unknown.status_code == 404
    assert cross.json()["detail"]["code"] == "order_not_found"
    assert unknown.json()["detail"]["code"] == "order_not_found"
    assert snapshot(db_session, theirs) == before


def test_non_integer_order_id_is_422(seeded, db_session):
    response = seeded.patch(
        "/owner/orders/abc/return",
        json={"decision": "APPROVED"},
        headers=auth(db_session, "owner1"),
    )

    assert response.status_code == 422


# what the customer sees afterwards


def test_customer_sees_the_refund_after_approval(seeded, db_session):
    order_id = requested(seeded, db_session)
    decide(seeded, db_session, order_id, "APPROVED")

    body = my_order(seeded, db_session, order_id)

    assert body["status"] == "REFUNDED"
    assert body["payment"]["status"] == "refunded"
    assert body["return_status"] == "APPROVED"


def test_customer_sees_the_rejection_and_order_stays_delivered(seeded, db_session):
    order_id = requested(seeded, db_session)
    decide(seeded, db_session, order_id, "REJECTED")

    body = my_order(seeded, db_session, order_id)

    assert body["status"] == "DELIVERED"
    assert body["payment"]["status"] == "mock_paid"
    assert body["return_status"] == "REJECTED"


@pytest.mark.parametrize("decision", DECISIONS)
def test_customer_cannot_cancel_or_ask_again_after_a_decision(seeded, db_session, decision):
    order_id = requested(seeded, db_session)
    decide(seeded, db_session, order_id, decision)
    after = snapshot(db_session, order_id)

    cancelled = cancel(seeded, db_session, order_id)
    again = ask(seeded, db_session, order_id, {"reason": "Please refund me again"})

    assert cancelled.status_code == 409
    assert again.status_code == 409
    if decision == "REJECTED":
        assert again.json()["detail"]["code"] == "return_exists"
    assert snapshot(db_session, order_id) == after


def test_owner_cannot_move_a_refunded_order(seeded, db_session):
    order_id = requested(seeded, db_session)
    decide(seeded, db_session, order_id, "APPROVED")
    after = snapshot(db_session, order_id)
    sam = user_id(db_session, "sam")

    statuses = [
        advance(seeded, db_session, order_id, s) for s in ("ACCEPTED", "PREPARING", "READY")
    ]
    assigning = assign(seeded, db_session, order_id, sam)

    assert [r.status_code for r in statuses] == [409, 409, 409]
    assert assigning.status_code == 409
    assert snapshot(db_session, order_id) == after


def test_delivery_partner_cannot_move_a_refunded_order(seeded, db_session):
    order_id = assigned(seeded, db_session, status=OrderStatus.DELIVERED)
    assert ask(seeded, db_session, order_id, {"reason": "The food arrived cold"}).status_code == 201
    decide(seeded, db_session, order_id, "APPROVED")
    after = snapshot(db_session, order_id)

    attempts = [move(seeded, db_session, order_id, s) for s in ("OUT_FOR_DELIVERY", "DELIVERED")]

    assert [r.status_code for r in attempts] == [409, 409]
    assert snapshot(db_session, order_id) == after


@pytest.mark.parametrize("decision", DECISIONS)
def test_delivery_partner_views_never_show_return_fields(seeded, db_session, decision):
    order_id = assigned(seeded, db_session, status=OrderStatus.DELIVERED)
    ask(seeded, db_session, order_id, {"reason": "The food arrived cold"})
    decide(seeded, db_session, order_id, decision)

    listed = mine(seeded, db_session).json()["items"][0]
    one = delivery_detail(seeded, db_session, order_id).json()

    assert listed["id"] == order_id
    assert not RETURN_KEYS & set(listed)
    assert not RETURN_KEYS & set(one)


@pytest.mark.parametrize("decision", DECISIONS)
def test_decisions_do_not_change_posted_reviews_or_ratings(seeded, db_session, decision):
    order_id = requested(seeded, db_session)
    posted = seeded.post(
        f"/orders/{order_id}/review",
        json={"rating": 4, "comment": "Tasty"},
        headers=auth(db_session, "maya"),
    )
    assert posted.status_code == 201
    restaurant_id = db_session.get(Order, order_id).restaurant_id
    before = by_id(seeded)[restaurant_id]

    decide(seeded, db_session, order_id, decision)

    after = by_id(seeded)[restaurant_id]
    db_session.expire_all()
    assert after == before
    assert db_session.scalar(select(func.count()).select_from(Review)) == 1
    assert db_session.scalar(select(Review.rating)) == 4


# atomicity


def test_failed_ledger_insert_rolls_the_approval_back(seeded, db_session, monkeypatch):
    order_id = requested(seeded, db_session)
    before = snapshot(db_session, order_id)

    def broken_ledger(**_):
        raise RuntimeError("ledger down")

    monkeypatch.setattr("app.services.owner_returns.PaymentLedger", broken_ledger)
    response = TestClient(app, raise_server_exceptions=False).patch(
        f"/owner/orders/{order_id}/return",
        json={"decision": "APPROVED"},
        headers=auth(db_session, "owner1"),
    )
    monkeypatch.undo()
    db_session.rollback()

    assert response.status_code == 500
    assert snapshot(db_session, order_id) == before
    assert before[:3] == (OrderStatus.DELIVERED, PaymentStatus.MOCK_PAID, ReturnStatus.REQUESTED)
    assert len(before[4]) == 1


def test_failed_commit_rolls_the_approval_back(seeded, db_session, monkeypatch):
    order_id = requested(seeded, db_session)
    before = snapshot(db_session, order_id)
    headers = auth(db_session, "owner1")

    def broken_commit():
        raise RuntimeError("commit failed")

    monkeypatch.setattr(db_session, "commit", broken_commit)
    response = TestClient(app, raise_server_exceptions=False).patch(
        f"/owner/orders/{order_id}/return", json={"decision": "APPROVED"}, headers=headers
    )
    monkeypatch.undo()
    db_session.rollback()

    assert response.status_code == 500
    assert snapshot(db_session, order_id) == before
    assert before[:3] == (OrderStatus.DELIVERED, PaymentStatus.MOCK_PAID, ReturnStatus.REQUESTED)
    assert len(before[4]) == 1


# query count


def test_list_statement_count_is_constant(seeded, db_session):
    engine = db_session.get_bind()
    captured: list[str] = []

    def record(conn, cursor, statement, parameters, context, executemany):
        captured.append(statement)

    def count() -> int:
        db_session.expire_all()
        captured.clear()
        event.listen(engine, "before_cursor_execute", record)
        try:
            assert returns(seeded, db_session, "?page_size=50").status_code == 200
        finally:
            event.remove(engine, "before_cursor_execute", record)
        return len(captured)

    for _ in range(2):
        requested(seeded, db_session)
    few = count()
    for _ in range(18):
        requested(seeded, db_session)
    many = count()

    assert len(ids(returns(seeded, db_session, "?page_size=50"))) == 20
    assert few == many
