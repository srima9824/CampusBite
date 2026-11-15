from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import event, select

from app import seed
from app.models import MenuItem, Order, OrderStatus, Restaurant, User
from app.order_status import OWNER_NEXT_STATUS
from app.security import create_access_token
from app.services.owner_orders import blocked_message

PASSWORD = "seed-pass-1234"
ORDER_KEYS = {
    "id",
    "status",
    "total",
    "delivery_address",
    "notes",
    "created_at",
    "updated_at",
    "items",
    "payment",
    "customer",
    "delivery_partner",
    "return_status",
    "return_reason",
    "return_requested_at",
}


@pytest.fixture
def seeded(client, db_session):
    seed.seed_users(db_session, PASSWORD)
    seed.seed_restaurants(db_session)
    return client


def auth(db_session, local_part: str) -> dict:
    user = db_session.scalar(select(User).where(User.email == f"{local_part}@masaischool.ac.in"))
    return {"Authorization": f"Bearer {create_access_token(user)}"}


def place(client, db_session, owner: str = "owner1", who: str = "maya", lines: int = 1, **extra):
    dishes = list(
        db_session.scalars(
            select(MenuItem)
            .join(Restaurant, Restaurant.id == MenuItem.restaurant_id)
            .join(User, User.id == Restaurant.owner_id)
            .where(
                User.email == f"{owner}@masaischool.ac.in",
                MenuItem.is_available.is_(True),
            )
            .order_by(MenuItem.id)
            .limit(lines)
        )
    )
    payload = {
        "items": [{"menu_item_id": d.id, "quantity": 2} for d in dishes],
        "delivery_address": "Hostel 4",
        **extra,
    }
    response = client.post("/orders", json=payload, headers=auth(db_session, who))
    assert response.status_code == 201
    return response.json()["id"]


def stamp(db_session, order_id: int, created_at: datetime | None = None, status=None) -> None:
    order = db_session.get(Order, order_id)
    if created_at is not None:
        order.created_at = created_at
    if status is not None:
        order.status = status
    db_session.commit()


def utc(text: str) -> datetime:
    return datetime.fromisoformat(text).replace(tzinfo=UTC)


def listing(client, db_session, query: str = "", owner: str = "owner1"):
    return client.get(f"/owner/orders{query}", headers=auth(db_session, owner))


def advance(client, db_session, order_id, status, owner: str = "owner1"):
    return client.patch(
        f"/owner/orders/{order_id}/status",
        json={"status": status},
        headers=auth(db_session, owner),
    )


# list


def test_list_shape_has_customer_name_only(seeded, db_session):
    order_id = place(seeded, db_session, notes="No onions")

    body = listing(seeded, db_session).json()

    order = body["items"][0]
    assert body["total"] == 1
    assert set(order) == ORDER_KEYS
    assert order["id"] == order_id
    assert order["customer"] == {"name": "Maya Patel"}
    assert order["delivery_partner"] is None
    assert order["notes"] == "No onions"
    assert order["delivery_address"] == "Hostel 4"
    assert set(order["payment"]) == {"method", "status"}
    assert order["items"]
    assert "maya@" not in listing(seeded, db_session).text


def test_list_is_scoped_to_the_owners_restaurant(seeded, db_session):
    mine = place(seeded, db_session, "owner1")
    place(seeded, db_session, "owner3")

    ids = [o["id"] for o in listing(seeded, db_session).json()["items"]]
    other = [o["id"] for o in listing(seeded, db_session, owner="owner3").json()["items"]]

    assert ids == [mine]
    assert mine not in other
    assert len(other) == 1


def test_list_is_newest_first_with_id_tiebreak(seeded, db_session):
    first = place(seeded, db_session)
    second = place(seeded, db_session)
    third = place(seeded, db_session)
    stamp(db_session, first, utc("2026-03-05T10:00:00"))
    stamp(db_session, second, utc("2026-03-01T10:00:00"))
    stamp(db_session, third, utc("2026-03-05T10:00:00"))

    ids = [o["id"] for o in listing(seeded, db_session).json()["items"]]

    assert ids == [third, first, second]


def test_list_paginates(seeded, db_session):
    ids = [place(seeded, db_session) for _ in range(3)]

    body = listing(seeded, db_session, "?page=2&page_size=2").json()

    assert body["total"] == 3
    assert body["page"] == 2
    assert body["page_size"] == 2
    assert [o["id"] for o in body["items"]] == [ids[0]]


def test_list_default_page_size_is_10(seeded, db_session):
    for _ in range(11):
        place(seeded, db_session)

    body = listing(seeded, db_session).json()

    assert body["page_size"] == 10
    assert len(body["items"]) == 10
    assert body["total"] == 11


@pytest.mark.parametrize("query", ["?page=0", "?page_size=0", "?page_size=51"])
def test_list_rejects_bad_paging(seeded, db_session, query):
    assert listing(seeded, db_session, query).status_code == 422


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("?status=PLACED", [0]),
        ("?status=CANCELLED", [1]),
        ("?status=PLACED,CANCELLED", [1, 0]),
        ("?status=READY", []),
    ],
)
def test_list_filters_by_status(seeded, db_session, query, expected):
    ids = [place(seeded, db_session), place(seeded, db_session)]
    stamp(db_session, ids[1], status=OrderStatus.CANCELLED)

    body = listing(seeded, db_session, query).json()

    assert [o["id"] for o in body["items"]] == [ids[i] for i in expected]
    assert body["total"] == len(expected)


def test_list_filters_by_india_day_inclusive(seeded, db_session):
    early = place(seeded, db_session)
    late = place(seeded, db_session)
    other = place(seeded, db_session)
    # 2026-03-05 18:29 UTC is 23:59 India time; 18:30 UTC is already the next India day.
    stamp(db_session, early, utc("2026-03-04T18:30:00"))
    stamp(db_session, late, utc("2026-03-05T18:29:00"))
    stamp(db_session, other, utc("2026-03-05T18:30:00"))

    body = listing(seeded, db_session, "?date_from=2026-03-05&date_to=2026-03-05").json()

    assert sorted(o["id"] for o in body["items"]) == sorted([early, late])


@pytest.mark.parametrize(
    ("query", "code"),
    [
        ("?status=NOPE", "invalid_status"),
        ("?status=PLACED,NOPE", "invalid_status"),
        ("?date_from=yesterday", "invalid_date"),
        ("?date_to=2026-13-40", "invalid_date"),
        ("?date_from=2026-03-06&date_to=2026-03-05", "invalid_date_range"),
    ],
)
def test_list_rejects_bad_filters(seeded, db_session, query, code):
    response = listing(seeded, db_session, query)

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == code


# detail


def test_detail_returns_the_same_shape(seeded, db_session):
    order_id = place(seeded, db_session, lines=2)

    response = seeded.get(f"/owner/orders/{order_id}", headers=auth(db_session, "owner1"))

    body = response.json()
    assert response.status_code == 200
    assert set(body) == ORDER_KEYS
    assert body["customer"] == {"name": "Maya Patel"}
    assert body["delivery_partner"] is None
    assert len(body["items"]) == 2
    assert "maya@" not in response.text


def test_detail_of_unknown_order_is_404(seeded, db_session):
    response = seeded.get("/owner/orders/9999", headers=auth(db_session, "owner1"))

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "order_not_found"


# status updates


@pytest.mark.parametrize(
    ("start", "target"),
    [(current, target) for current, target in OWNER_NEXT_STATUS.items()],
)
def test_owner_moves_an_order_one_step(seeded, db_session, start, target):
    order_id = place(seeded, db_session)
    stamp(db_session, order_id, status=start)
    db_session.get(Order, order_id).updated_at = datetime.now(UTC) - timedelta(days=1)
    db_session.commit()
    before = db_session.get(Order, order_id).updated_at

    response = advance(seeded, db_session, order_id, target.value)

    body = response.json()
    assert response.status_code == 200
    assert set(body) == ORDER_KEYS
    assert body["status"] == target.value
    assert body["customer"] == {"name": "Maya Patel"}
    assert body["delivery_partner"] is None
    db_session.expire_all()
    order = db_session.get(Order, order_id)
    assert order.status is target
    assert order.updated_at.replace(tzinfo=UTC) > before.replace(tzinfo=UTC)


def test_owner_walks_an_order_through_the_kitchen(seeded, db_session):
    order_id = place(seeded, db_session)

    statuses = [
        advance(seeded, db_session, order_id, s).json()["status"]
        for s in ("ACCEPTED", "PREPARING", "READY")
    ]

    assert statuses == ["ACCEPTED", "PREPARING", "READY"]


KITCHEN_TARGETS = [OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY]
BLOCKED_MOVES = [
    (start, target)
    for start in OrderStatus
    for target in KITCHEN_TARGETS
    if OWNER_NEXT_STATUS.get(start) is not target
]


@pytest.mark.parametrize(("start", "target"), BLOCKED_MOVES)
def test_every_other_move_is_409_and_changes_nothing(seeded, db_session, start, target):
    order_id = place(seeded, db_session)
    stamp(db_session, order_id, status=start)
    db_session.expire_all()
    before = db_session.get(Order, order_id).updated_at

    response = advance(seeded, db_session, order_id, target.value)

    assert response.status_code == 409
    detail = response.json()["detail"]
    assert detail["code"] == "invalid_transition"
    assert detail["message"] == blocked_message(start, target)
    db_session.expire_all()
    order = db_session.get(Order, order_id)
    assert order.status is start
    assert order.updated_at == before


@pytest.mark.parametrize(
    ("start", "message"),
    [
        (OrderStatus.CANCELLED, "This order was cancelled."),
        (OrderStatus.DELIVERED, "This order was already delivered."),
        (OrderStatus.REFUNDED, "This order was refunded."),
        (OrderStatus.PLACED, "An order that is PLACED cannot move to READY."),
    ],
)
def test_blocked_messages(seeded, db_session, start, message):
    order_id = place(seeded, db_session)
    stamp(db_session, order_id, status=start)

    response = advance(seeded, db_session, order_id, "READY")

    assert response.json()["detail"]["message"] == message


@pytest.mark.parametrize(
    "body",
    [
        {"status": "CANCELLED"},
        {"status": "DELIVERED"},
        {"status": "PLACED"},
        {"status": "accepted"},
        {"status": "NOPE"},
        {},
        {"status": "ACCEPTED", "extra": 1},
    ],
)
def test_bad_status_body_is_422(seeded, db_session, body):
    order_id = place(seeded, db_session)

    response = seeded.patch(
        f"/owner/orders/{order_id}/status", json=body, headers=auth(db_session, "owner1")
    )

    assert response.status_code == 422
    db_session.expire_all()
    assert db_session.get(Order, order_id).status is OrderStatus.PLACED


def test_unknown_order_status_update_is_404(seeded, db_session):
    response = advance(seeded, db_session, 9999, "ACCEPTED")

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "order_not_found"


# integration with the customer endpoints


def test_customer_sees_the_new_status(seeded, db_session):
    order_id = place(seeded, db_session)
    advance(seeded, db_session, order_id, "ACCEPTED")
    mine = auth(db_session, "maya")

    detail = seeded.get(f"/orders/{order_id}", headers=mine).json()
    listed = seeded.get("/orders?status=ACCEPTED", headers=mine).json()

    assert detail["status"] == "ACCEPTED"
    assert [o["id"] for o in listed["items"]] == [order_id]


def test_customer_cannot_cancel_after_owner_accepts(seeded, db_session):
    order_id = place(seeded, db_session)
    advance(seeded, db_session, order_id, "ACCEPTED")

    response = seeded.post(f"/orders/{order_id}/cancel", headers=auth(db_session, "maya"))

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "invalid_transition"


def test_owner_cannot_accept_a_customer_cancelled_order(seeded, db_session):
    order_id = place(seeded, db_session)
    cancelled = seeded.post(f"/orders/{order_id}/cancel", headers=auth(db_session, "maya"))
    assert cancelled.status_code == 200

    response = advance(seeded, db_session, order_id, "ACCEPTED")

    assert response.status_code == 409
    assert response.json()["detail"]["message"] == "This order was cancelled."


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


def test_list_statement_count_is_constant_as_orders_grow(seeded, db_session, statements):
    def count() -> int:
        statements.clear()
        response = listing(seeded, db_session, "?page_size=50")
        assert response.status_code == 200
        return len(statements)

    for _ in range(2):
        place(seeded, db_session, lines=3)
    small = count()
    for _ in range(18):
        place(seeded, db_session, who="leo", lines=3)
    large = count()

    assert len(listing(seeded, db_session, "?page_size=50").json()["items"]) == 20
    assert large == small
