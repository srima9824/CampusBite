import pytest
from sqlalchemy import event, select

from app import seed
from app.models import Order, OrderStatus, PaymentLedger, Role, User
from app.order_status import OWNER_NEXT_STATUS
from tests.test_owner_orders_api import ORDER_KEYS, advance, auth, listing, place, stamp

PASSWORD = "seed-pass-1234"


@pytest.fixture
def seeded(client, db_session):
    seed.seed_users(db_session, PASSWORD)
    seed.seed_restaurants(db_session)
    return client


def user_id(db_session, local_part: str) -> int:
    return db_session.scalar(select(User.id).where(User.email == f"{local_part}@masaischool.ac.in"))


def assign(client, db_session, order_id, partner_id, owner: str = "owner1"):
    return client.patch(
        f"/owner/orders/{order_id}/assign",
        json={"delivery_partner_id": partner_id},
        headers=auth(db_session, owner),
    )


def ready_order(client, db_session, **kwargs) -> int:
    order_id = place(client, db_session, **kwargs)
    stamp(db_session, order_id, status=OrderStatus.READY)
    return order_id


def reload(db_session, order_id) -> Order:
    db_session.expire_all()
    return db_session.get(Order, order_id)


def partners(client, db_session, query: str = "", who: str = "owner1"):
    return client.get(f"/owner/delivery-partners{query}", headers=auth(db_session, who))


# assigning


def test_assign_a_ready_order_sets_status_and_partner(seeded, db_session):
    order_id = ready_order(seeded, db_session)
    sam = user_id(db_session, "sam")

    response = assign(seeded, db_session, order_id, sam)

    body = response.json()
    assert response.status_code == 200
    assert set(body) == ORDER_KEYS
    assert body["status"] == "ASSIGNED"
    assert body["delivery_partner"] == {"id": sam, "name": "Sam Okafor"}
    assert "sam@" not in response.text
    order = reload(db_session, order_id)
    assert order.status is OrderStatus.ASSIGNED
    assert order.delivery_partner_id == sam


def test_assign_moves_updated_at_forward(seeded, db_session):
    order_id = ready_order(seeded, db_session)
    before = reload(db_session, order_id).updated_at

    assign(seeded, db_session, order_id, user_id(db_session, "sam"))

    assert reload(db_session, order_id).updated_at >= before


def test_detail_and_list_show_the_assigned_partner(seeded, db_session):
    order_id = ready_order(seeded, db_session)
    priya = user_id(db_session, "priya")
    assign(seeded, db_session, order_id, priya)

    detail = seeded.get(f"/owner/orders/{order_id}", headers=auth(db_session, "owner1")).json()
    listed = listing(seeded, db_session).json()["items"][0]

    expected = {"id": priya, "name": "Priya Nair"}
    assert detail["delivery_partner"] == expected
    assert listed["delivery_partner"] == expected


@pytest.mark.parametrize("start", [s for s in OrderStatus if s is not OrderStatus.READY])
def test_only_a_ready_order_can_be_assigned(seeded, db_session, start):
    order_id = place(seeded, db_session)
    stamp(db_session, order_id, status=start)
    before = reload(db_session, order_id).updated_at

    response = assign(seeded, db_session, order_id, user_id(db_session, "sam"))

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "invalid_transition"
    order = reload(db_session, order_id)
    assert order.status is start
    assert order.delivery_partner_id is None
    assert order.updated_at == before


@pytest.mark.parametrize(
    ("start", "message"),
    [
        (OrderStatus.ASSIGNED, "This order already has a delivery partner."),
        (OrderStatus.CANCELLED, "This order was cancelled."),
        (OrderStatus.DELIVERED, "This order was already delivered."),
        (OrderStatus.REFUNDED, "This order was refunded."),
        (OrderStatus.PLACED, "A delivery partner can only be assigned once the order is READY."),
        (OrderStatus.ACCEPTED, "A delivery partner can only be assigned once the order is READY."),
        (OrderStatus.PREPARING, "A delivery partner can only be assigned once the order is READY."),
    ],
)
def test_assign_blocked_messages(seeded, db_session, start, message):
    order_id = place(seeded, db_session)
    stamp(db_session, order_id, status=start)

    response = assign(seeded, db_session, order_id, user_id(db_session, "sam"))

    assert response.json()["detail"]["message"] == message


def test_a_second_assign_is_409_and_keeps_the_first_partner(seeded, db_session):
    order_id = ready_order(seeded, db_session)
    sam = user_id(db_session, "sam")
    assign(seeded, db_session, order_id, sam)

    response = assign(seeded, db_session, order_id, user_id(db_session, "priya"))

    assert response.status_code == 409
    assert response.json()["detail"]["message"] == "This order already has a delivery partner."
    order = reload(db_session, order_id)
    assert order.delivery_partner_id == sam
    assert order.status is OrderStatus.ASSIGNED


@pytest.mark.parametrize("local_part", ["maya", "owner1", "owner3", None])
def test_a_non_partner_is_422_and_the_order_is_unchanged(seeded, db_session, local_part):
    order_id = ready_order(seeded, db_session)
    partner_id = 9999 if local_part is None else user_id(db_session, local_part)

    response = assign(seeded, db_session, order_id, partner_id)

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "delivery_partner_not_found"
    order = reload(db_session, order_id)
    assert order.status is OrderStatus.READY
    assert order.delivery_partner_id is None


@pytest.mark.parametrize(
    "body",
    [
        {"delivery_partner_id": 0},
        {"delivery_partner_id": -1},
        {"delivery_partner_id": "sam"},
        {"delivery_partner_id": None},
        {"delivery_partner_id": 1.5},
        {},
        {"delivery_partner_id": 7, "extra": 1},
    ],
)
def test_a_bad_body_is_422_and_the_order_is_unchanged(seeded, db_session, body):
    order_id = ready_order(seeded, db_session)

    response = seeded.patch(
        f"/owner/orders/{order_id}/assign", json=body, headers=auth(db_session, "owner1")
    )

    assert response.status_code == 422
    order = reload(db_session, order_id)
    assert order.status is OrderStatus.READY
    assert order.delivery_partner_id is None


def test_assigning_an_unknown_order_is_404(seeded, db_session):
    response = assign(seeded, db_session, 9999, user_id(db_session, "sam"))

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "order_not_found"


def test_owner_status_endpoint_still_rejects_assigned(seeded, db_session):
    order_id = ready_order(seeded, db_session)

    response = advance(seeded, db_session, order_id, "ASSIGNED")

    assert response.status_code == 422
    assert reload(db_session, order_id).status is OrderStatus.READY


def test_owner_cannot_move_an_assigned_order_with_the_status_endpoint(seeded, db_session):
    order_id = ready_order(seeded, db_session)
    assign(seeded, db_session, order_id, user_id(db_session, "sam"))

    response = advance(seeded, db_session, order_id, "READY")

    assert response.status_code == 409
    assert OrderStatus.ASSIGNED not in OWNER_NEXT_STATUS.values()
    assert reload(db_session, order_id).status is OrderStatus.ASSIGNED


# full flow


def test_full_flow_from_placing_to_assigned(seeded, db_session):
    order_id = place(seeded, db_session)
    for step in ("ACCEPTED", "PREPARING", "READY"):
        assert advance(seeded, db_session, order_id, step).status_code == 200
    mine = auth(db_session, "maya")

    assigned = assign(seeded, db_session, order_id, user_id(db_session, "sam"))
    detail = seeded.get(f"/orders/{order_id}", headers=mine).json()
    listed = seeded.get("/orders?status=ASSIGNED", headers=mine).json()
    cancel = seeded.post(f"/orders/{order_id}/cancel", headers=mine)

    assert assigned.json()["status"] == "ASSIGNED"
    assert detail["status"] == "ASSIGNED"
    assert [o["id"] for o in listed["items"]] == [order_id]
    assert cancel.status_code == 409
    assert cancel.json()["detail"]["code"] == "invalid_transition"
    assert reload(db_session, order_id).status is OrderStatus.ASSIGNED


def test_assignment_leaves_the_payment_untouched(seeded, db_session):
    order_id = ready_order(seeded, db_session)
    ledger_before = [
        (r.amount, r.method, r.status)
        for r in db_session.scalars(select(PaymentLedger).where(PaymentLedger.order_id == order_id))
    ]
    order = reload(db_session, order_id)
    payment_before = (order.total, order.payment_status)

    assign(seeded, db_session, order_id, user_id(db_session, "sam"))

    ledger_after = [
        (r.amount, r.method, r.status)
        for r in db_session.scalars(select(PaymentLedger).where(PaymentLedger.order_id == order_id))
    ]
    order = reload(db_session, order_id)
    assert ledger_before
    assert ledger_after == ledger_before
    assert (order.total, order.payment_status) == payment_before


# delivery partner list


def test_partner_list_has_only_id_and_name_ordered_by_name(seeded, db_session):
    response = partners(seeded, db_session)

    body = response.json()
    assert response.status_code == 200
    assert body["items"] == [
        {"id": user_id(db_session, "jonah"), "name": "Jonah Reyes"},
        {"id": user_id(db_session, "priya"), "name": "Priya Nair"},
        {"id": user_id(db_session, "sam"), "name": "Sam Okafor"},
    ]
    assert (body["total"], body["page"], body["page_size"]) == (3, 1, 50)
    assert "@" not in response.text
    assert "password" not in response.text


def test_partner_list_breaks_name_ties_by_id(seeded, db_session):
    first = user_id(db_session, "sam")
    db_session.add(
        User(
            name="Sam Okafor",
            email="sam2@masaischool.ac.in",
            password_hash="x",
            role=Role.DELIVERY_PARTNER,
        )
    )
    db_session.commit()
    second = user_id(db_session, "sam2")

    items = partners(seeded, db_session).json()["items"]
    ids = [p["id"] for p in items if p["name"] == "Sam Okafor"]

    assert ids == [first, second]


def test_partner_list_paginates(seeded, db_session):
    body = partners(seeded, db_session, "?page=2&page_size=2").json()

    assert body["total"] == 3
    assert [p["name"] for p in body["items"]] == ["Sam Okafor"]
    assert (body["page"], body["page_size"]) == (2, 2)


@pytest.mark.parametrize("query", ["?page=0", "?page_size=0", "?page_size=51", "?page=x"])
def test_partner_list_rejects_bad_paging(seeded, db_session, query):
    assert partners(seeded, db_session, query).status_code == 422


# query count


@pytest.fixture
def statements(db_session):
    engine = db_session.get_bind()
    captured: list[str] = []

    def record(conn, cursor, statement, parameters, context, executemany):
        captured.append(statement)

    event.listen(engine, "before_cursor_execute", record)
    yield captured
    event.remove(engine, "before_cursor_execute", record)


def test_list_statement_count_is_constant_with_assigned_partners(seeded, db_session, statements):
    partner_ids = [user_id(db_session, n) for n in ("sam", "priya", "jonah")]

    def add_assigned(how_many: int) -> None:
        for n in range(how_many):
            order_id = ready_order(seeded, db_session, who="leo", lines=3)
            assert assign(seeded, db_session, order_id, partner_ids[n % 3]).status_code == 200

    def count() -> int:
        statements.clear()
        assert listing(seeded, db_session, "?page_size=50").status_code == 200
        return len(statements)

    add_assigned(2)
    small = count()
    add_assigned(18)
    large = count()

    items = listing(seeded, db_session, "?page_size=50").json()["items"]
    assert len(items) == 20
    assert all(o["delivery_partner"] for o in items)
    assert large == small
