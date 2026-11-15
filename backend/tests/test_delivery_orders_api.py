import pytest
from sqlalchemy import event, select

from app import seed
from app.models import Order, OrderStatus, PaymentLedger, User
from tests.test_owner_orders_api import advance, auth, place, stamp, utc

PASSWORD = "seed-pass-1234"
ORDER_KEYS = {
    "id",
    "status",
    "delivery_address",
    "notes",
    "created_at",
    "updated_at",
    "restaurant",
    "customer",
    "items",
}
ITEM_KEYS = {"menu_item_id", "name", "unit_price", "quantity", "line_total"}
FORBIDDEN_KEYS = {"total", "payment", "delivery_partner", "customer_id", "email"}


@pytest.fixture
def seeded(client, db_session):
    seed.seed_users(db_session, PASSWORD)
    seed.seed_restaurants(db_session)
    return client


def user_id(db_session, local_part: str) -> int:
    return db_session.scalar(select(User.id).where(User.email == f"{local_part}@masaischool.ac.in"))


def assigned(
    client, db_session, partner: str = "sam", status=OrderStatus.ASSIGNED, **kwargs
) -> int:
    order_id = place(client, db_session, **kwargs)
    order = db_session.get(Order, order_id)
    order.delivery_partner_id = user_id(db_session, partner)
    order.status = status
    db_session.commit()
    return order_id


def reload(db_session, order_id) -> Order:
    db_session.expire_all()
    return db_session.get(Order, order_id)


def mine(client, db_session, query: str = "", who: str = "sam"):
    return client.get(f"/delivery/orders{query}", headers=auth(db_session, who))


def detail(client, db_session, order_id, who: str = "sam"):
    return client.get(f"/delivery/orders/{order_id}", headers=auth(db_session, who))


def move(client, db_session, order_id, status, who: str = "sam"):
    return client.patch(
        f"/delivery/orders/{order_id}/status",
        json={"status": status},
        headers=auth(db_session, who),
    )


def ids(response) -> list[int]:
    return [o["id"] for o in response.json()["items"]]


def ledger(db_session, order_id) -> list:
    return [
        (r.amount, r.method, r.status)
        for r in db_session.scalars(select(PaymentLedger).where(PaymentLedger.order_id == order_id))
    ]


# list


def test_list_shape_has_no_customer_email_total_or_payment(seeded, db_session):
    order_id = assigned(seeded, db_session, lines=2, notes="Call me")

    response = mine(seeded, db_session)

    body = response.json()
    order = body["items"][0]
    assert response.status_code == 200
    assert (body["total"], body["page"], body["page_size"]) == (1, 1, 10)
    assert set(order) == ORDER_KEYS
    assert order["id"] == order_id
    assert order["status"] == "ASSIGNED"
    assert order["customer"] == {"name": "Maya Patel"}
    assert set(order["restaurant"]) == {"id", "name"}
    assert order["delivery_address"] == "Hostel 4"
    assert order["notes"] == "Call me"
    assert len(order["items"]) == 2
    assert all(set(i) == ITEM_KEYS for i in order["items"])
    assert FORBIDDEN_KEYS.isdisjoint(order)
    assert "maya@" not in response.text


def test_list_has_only_the_callers_orders(seeded, db_session):
    own = assigned(seeded, db_session, "sam")
    other = assigned(seeded, db_session, "priya")
    place(seeded, db_session)

    sam = mine(seeded, db_session, who="sam").json()
    priya = mine(seeded, db_session, who="priya").json()
    jonah = mine(seeded, db_session, who="jonah").json()

    assert [o["id"] for o in sam["items"]] == [own]
    assert sam["total"] == 1
    assert [o["id"] for o in priya["items"]] == [other]
    assert jonah["items"] == []
    assert jonah["total"] == 0


def test_list_is_newest_first_with_id_tiebreak(seeded, db_session):
    first = assigned(seeded, db_session)
    second = assigned(seeded, db_session)
    third = assigned(seeded, db_session)
    stamp(db_session, first, utc("2026-03-05T10:00:00"))
    stamp(db_session, second, utc("2026-03-01T10:00:00"))
    stamp(db_session, third, utc("2026-03-05T10:00:00"))

    assert ids(mine(seeded, db_session)) == [third, first, second]


def test_list_paginates(seeded, db_session):
    created = [assigned(seeded, db_session) for _ in range(3)]

    body = mine(seeded, db_session, "?page=2&page_size=2").json()

    assert body["total"] == 3
    assert (body["page"], body["page_size"]) == (2, 2)
    assert [o["id"] for o in body["items"]] == [created[0]]


def test_list_default_page_size_is_10_and_max_is_50(seeded, db_session):
    for _ in range(11):
        assigned(seeded, db_session)

    default = mine(seeded, db_session).json()
    biggest = mine(seeded, db_session, "?page_size=50").json()

    assert default["page_size"] == 10
    assert len(default["items"]) == 10
    assert default["total"] == 11
    assert len(biggest["items"]) == 11


def test_page_past_the_end_is_empty(seeded, db_session):
    assigned(seeded, db_session)

    body = mine(seeded, db_session, "?page=5").json()

    assert body["items"] == []
    assert body["total"] == 1


@pytest.mark.parametrize("query", ["?page=0", "?page_size=0", "?page_size=51", "?page=x"])
def test_list_rejects_bad_paging(seeded, db_session, query):
    assert mine(seeded, db_session, query).status_code == 422


@pytest.fixture
def mixed(seeded, db_session):
    """One order per delivery status for sam, oldest first, plus one for priya."""
    by_status = {
        status: assigned(seeded, db_session, status=status)
        for status in (
            OrderStatus.ASSIGNED,
            OrderStatus.OUT_FOR_DELIVERY,
            OrderStatus.DELIVERED,
        )
    }
    assigned(seeded, db_session, "priya", status=OrderStatus.DELIVERED)
    return by_status


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("?status=ASSIGNED", [OrderStatus.ASSIGNED]),
        ("?status=DELIVERED", [OrderStatus.DELIVERED]),
        (
            "?status=ASSIGNED,OUT_FOR_DELIVERY",
            [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.ASSIGNED],
        ),
        ("?status=READY", []),
        ("", [OrderStatus.DELIVERED, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.ASSIGNED]),
    ],
)
def test_list_filters_by_status(seeded, db_session, mixed, query, expected):
    body = mine(seeded, db_session, query).json()

    assert [o["id"] for o in body["items"]] == [mixed[s] for s in expected]
    assert body["total"] == len(expected)


def test_current_deliveries_and_history_split_cleanly(seeded, db_session, mixed):
    current = mine(seeded, db_session, "?status=ASSIGNED,OUT_FOR_DELIVERY").json()
    history = mine(seeded, db_session, "?status=DELIVERED").json()

    assert {o["status"] for o in current["items"]} == {"ASSIGNED", "OUT_FOR_DELIVERY"}
    assert [o["status"] for o in history["items"]] == ["DELIVERED"]
    assert history["total"] == 1


def test_list_filters_by_india_day_inclusive(seeded, db_session):
    early = assigned(seeded, db_session)
    late = assigned(seeded, db_session)
    other = assigned(seeded, db_session)
    # 18:29 UTC is 23:59 India time; 18:30 UTC is already the next India day.
    stamp(db_session, early, utc("2026-03-04T18:30:00"))
    stamp(db_session, late, utc("2026-03-05T18:29:00"))
    stamp(db_session, other, utc("2026-03-05T18:30:00"))

    both = mine(seeded, db_session, "?date_from=2026-03-05&date_to=2026-03-05")
    from_only = mine(seeded, db_session, "?date_from=2026-03-06")
    to_only = mine(seeded, db_session, "?date_to=2026-03-05")

    assert sorted(ids(both)) == sorted([early, late])
    assert ids(from_only) == [other]
    assert sorted(ids(to_only)) == sorted([early, late])


def test_status_and_date_filters_combine(seeded, db_session):
    delivered_in = assigned(seeded, db_session, status=OrderStatus.DELIVERED)
    delivered_out = assigned(seeded, db_session, status=OrderStatus.DELIVERED)
    active_in = assigned(seeded, db_session)
    stamp(db_session, delivered_in, utc("2026-03-05T10:00:00"))
    stamp(db_session, delivered_out, utc("2026-04-05T10:00:00"))
    stamp(db_session, active_in, utc("2026-03-05T11:00:00"))

    body = mine(seeded, db_session, "?status=DELIVERED&date_from=2026-03-01&date_to=2026-03-31")

    assert ids(body) == [delivered_in]


@pytest.mark.parametrize(
    ("query", "code"),
    [
        ("?status=NOPE", "invalid_status"),
        ("?status=ASSIGNED,NOPE", "invalid_status"),
        ("?date_from=yesterday", "invalid_date"),
        ("?date_to=2026-13-40", "invalid_date"),
        ("?date_from=2026-03-06&date_to=2026-03-05", "invalid_date_range"),
    ],
)
def test_list_rejects_bad_filters(seeded, db_session, query, code):
    response = mine(seeded, db_session, query)

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == code


# detail


def test_detail_returns_the_same_shape(seeded, db_session):
    order_id = assigned(seeded, db_session, lines=2)

    response = detail(seeded, db_session, order_id)

    body = response.json()
    listed = mine(seeded, db_session).json()["items"][0]
    assert response.status_code == 200
    assert set(body) == ORDER_KEYS
    assert body == listed
    assert FORBIDDEN_KEYS.isdisjoint(body)
    assert "maya@" not in response.text


def test_detail_item_lines_add_up(seeded, db_session):
    order_id = assigned(seeded, db_session, lines=2)

    items = detail(seeded, db_session, order_id).json()["items"]

    assert len(items) == 2
    assert all(i["quantity"] == 2 for i in items)
    assert all(float(i["line_total"]) == float(i["unit_price"]) * i["quantity"] for i in items)


@pytest.mark.parametrize("status", [s for s in OrderStatus if s is not OrderStatus.ASSIGNED])
def test_detail_is_available_in_any_status_once_assigned(seeded, db_session, status):
    order_id = assigned(seeded, db_session, status=status)

    body = detail(seeded, db_session, order_id).json()

    assert body["status"] == status.value


def test_detail_of_unassigned_or_unknown_order_is_404(seeded, db_session):
    unassigned = place(seeded, db_session)

    for order_id in (unassigned, 9999):
        response = detail(seeded, db_session, order_id)
        assert response.status_code == 404
        assert response.json()["detail"]["code"] == "order_not_found"


def test_detail_of_another_partners_order_is_404(seeded, db_session):
    order_id = assigned(seeded, db_session, "priya")

    response = detail(seeded, db_session, order_id, who="sam")

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "order_not_found"


# status updates


def test_assigned_to_out_for_delivery_then_delivered(seeded, db_session):
    order_id = assigned(seeded, db_session)

    first = move(seeded, db_session, order_id, "OUT_FOR_DELIVERY")
    assert reload(db_session, order_id).status is OrderStatus.OUT_FOR_DELIVERY
    second = move(seeded, db_session, order_id, "DELIVERED")

    assert first.status_code == 200
    assert first.json()["status"] == "OUT_FOR_DELIVERY"
    assert set(first.json()) == ORDER_KEYS
    assert second.status_code == 200
    assert second.json()["status"] == "DELIVERED"
    assert reload(db_session, order_id).status is OrderStatus.DELIVERED


def test_a_move_bumps_updated_at(seeded, db_session):
    order_id = assigned(seeded, db_session)
    before = reload(db_session, order_id).updated_at

    response = move(seeded, db_session, order_id, "OUT_FOR_DELIVERY")

    assert reload(db_session, order_id).updated_at > before
    assert response.json()["updated_at"] != before.isoformat()


ALLOWED_MOVES = {("ASSIGNED", "OUT_FOR_DELIVERY"), ("OUT_FOR_DELIVERY", "DELIVERED")}
BLOCKED_MOVES = [
    (current, target)
    for current in OrderStatus
    for target in ("OUT_FOR_DELIVERY", "DELIVERED")
    if (current.value, target) not in ALLOWED_MOVES
]


@pytest.mark.parametrize(("current", "target"), BLOCKED_MOVES)
def test_every_other_move_is_409_and_changes_nothing(seeded, db_session, current, target):
    order_id = assigned(seeded, db_session, status=current)
    before = reload(db_session, order_id).updated_at

    response = move(seeded, db_session, order_id, target)

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "invalid_transition"
    order = reload(db_session, order_id)
    assert order.status is current
    assert order.updated_at == before


@pytest.mark.parametrize(
    ("current", "target", "message"),
    [
        (OrderStatus.DELIVERED, "DELIVERED", "This order was already delivered."),
        (OrderStatus.DELIVERED, "OUT_FOR_DELIVERY", "This order was already delivered."),
        (OrderStatus.CANCELLED, "DELIVERED", "This order was cancelled."),
        (OrderStatus.REFUNDED, "OUT_FOR_DELIVERY", "This order was refunded."),
        (
            OrderStatus.ASSIGNED,
            "DELIVERED",
            "An order that is ASSIGNED cannot move to DELIVERED.",
        ),
        (
            OrderStatus.OUT_FOR_DELIVERY,
            "OUT_FOR_DELIVERY",
            "An order that is OUT_FOR_DELIVERY cannot move to OUT_FOR_DELIVERY.",
        ),
        (
            OrderStatus.READY,
            "OUT_FOR_DELIVERY",
            "An order that is READY cannot move to OUT_FOR_DELIVERY.",
        ),
    ],
)
def test_blocked_messages(seeded, db_session, current, target, message):
    order_id = assigned(seeded, db_session, status=current)

    response = move(seeded, db_session, order_id, target)

    assert response.status_code == 409
    assert response.json()["detail"]["message"] == message


@pytest.mark.parametrize(
    "body",
    [
        {"status": "ASSIGNED"},
        {"status": "READY"},
        {"status": "CANCELLED"},
        {"status": "PLACED"},
        {"status": "REFUNDED"},
        {"status": "out_for_delivery"},
        {"status": "delivered"},
        {"status": "NOPE"},
        {"status": None},
        {},
        {"status": "DELIVERED", "extra": 1},
    ],
)
def test_a_bad_body_is_422_and_the_order_is_unchanged(seeded, db_session, body):
    order_id = assigned(seeded, db_session)

    response = seeded.patch(
        f"/delivery/orders/{order_id}/status", json=body, headers=auth(db_session, "sam")
    )

    assert response.status_code == 422
    assert reload(db_session, order_id).status is OrderStatus.ASSIGNED


def test_moving_an_unknown_order_is_404(seeded, db_session):
    response = move(seeded, db_session, 9999, "OUT_FOR_DELIVERY")

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "order_not_found"


def test_moving_another_partners_order_is_404_and_unchanged(seeded, db_session):
    order_id = assigned(seeded, db_session, "priya")

    response = move(seeded, db_session, order_id, "OUT_FOR_DELIVERY", who="sam")

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "order_not_found"
    assert reload(db_session, order_id).status is OrderStatus.ASSIGNED


# full flow


def test_full_flow_from_placing_to_delivered(seeded, db_session):
    order_id = place(seeded, db_session)
    mine_headers = auth(db_session, "maya")
    owner = auth(db_session, "owner1")
    sam = user_id(db_session, "sam")

    def everyone_sees(status: str) -> None:
        customer = seeded.get(f"/orders/{order_id}", headers=mine_headers).json()
        owners = seeded.get(f"/owner/orders/{order_id}", headers=owner).json()
        listed = seeded.get(f"/orders?status={status}", headers=mine_headers).json()
        assert customer["status"] == status
        assert owners["status"] == status
        assert [o["id"] for o in listed["items"]] == [order_id]

    for step in ("ACCEPTED", "PREPARING", "READY"):
        assert advance(seeded, db_session, order_id, step).status_code == 200
        everyone_sees(step)
    assert mine(seeded, db_session).json()["items"] == []
    assert detail(seeded, db_session, order_id).status_code == 404

    ledger_before = ledger(db_session, order_id)
    before = reload(db_session, order_id)
    payment_before = (before.total, before.payment_status)

    assign = seeded.patch(
        f"/owner/orders/{order_id}/assign", json={"delivery_partner_id": sam}, headers=owner
    )
    assert assign.status_code == 200
    everyone_sees("ASSIGNED")
    assert ids(mine(seeded, db_session, "?status=ASSIGNED,OUT_FOR_DELIVERY")) == [order_id]
    assert detail(seeded, db_session, order_id).json()["status"] == "ASSIGNED"

    assert move(seeded, db_session, order_id, "OUT_FOR_DELIVERY").status_code == 200
    everyone_sees("OUT_FOR_DELIVERY")
    assert ids(mine(seeded, db_session, "?status=ASSIGNED,OUT_FOR_DELIVERY")) == [order_id]

    assert move(seeded, db_session, order_id, "DELIVERED").status_code == 200
    everyone_sees("DELIVERED")
    assert mine(seeded, db_session, "?status=ASSIGNED,OUT_FOR_DELIVERY").json()["items"] == []
    assert ids(mine(seeded, db_session, "?status=DELIVERED")) == [order_id]

    order = reload(db_session, order_id)
    assert ledger(db_session, order_id) == ledger_before
    assert ledger_before
    assert (order.total, order.payment_status) == payment_before


def test_a_delivered_order_is_final(seeded, db_session):
    order_id = assigned(seeded, db_session, status=OrderStatus.OUT_FOR_DELIVERY)
    move(seeded, db_session, order_id, "DELIVERED")
    mine_headers = auth(db_session, "maya")
    owner = auth(db_session, "owner1")
    sam = user_id(db_session, "sam")

    again = move(seeded, db_session, order_id, "DELIVERED")
    back = move(seeded, db_session, order_id, "OUT_FOR_DELIVERY")
    cancel = seeded.post(f"/orders/{order_id}/cancel", headers=mine_headers)
    reassign = seeded.patch(
        f"/owner/orders/{order_id}/assign", json={"delivery_partner_id": sam}, headers=owner
    )
    owner_move = advance(seeded, db_session, order_id, "READY")

    assert again.status_code == 409
    assert again.json()["detail"]["message"] == "This order was already delivered."
    assert back.status_code == 409
    assert cancel.status_code == 409
    assert reassign.status_code == 409
    assert owner_move.status_code == 409
    assert reload(db_session, order_id).status is OrderStatus.DELIVERED


def test_delivery_steps_leave_the_payment_untouched(seeded, db_session):
    order_id = assigned(seeded, db_session)
    ledger_before = ledger(db_session, order_id)
    order = reload(db_session, order_id)
    payment_before = (order.total, order.payment_status)

    move(seeded, db_session, order_id, "OUT_FOR_DELIVERY")
    move(seeded, db_session, order_id, "DELIVERED")

    order = reload(db_session, order_id)
    assert ledger_before
    assert ledger(db_session, order_id) == ledger_before
    assert (order.total, order.payment_status) == payment_before


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


def test_list_statement_count_is_constant(seeded, db_session, statements):
    def add_assigned(how_many: int) -> None:
        for _ in range(how_many):
            assigned(seeded, db_session, who="leo", lines=3)

    def count() -> int:
        statements.clear()
        assert mine(seeded, db_session, "?page_size=50").status_code == 200
        return len(statements)

    add_assigned(2)
    small = count()
    add_assigned(18)
    large = count()

    body = mine(seeded, db_session, "?page_size=50").json()
    assert len(body["items"]) == 20
    assert all(len(o["items"]) == 3 for o in body["items"])
    assert large == small
