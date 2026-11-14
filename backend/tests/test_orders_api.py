import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, func, select

from app import seed
from app.main import app
from app.models import MenuItem, Order, OrderItem, PaymentLedger, Restaurant, User
from app.security import create_access_token

PASSWORD = "seed-pass-1234"
ADDRESS = "Hostel 4, Room 12"


@pytest.fixture
def seeded(client, db_session):
    seed.seed_users(db_session, PASSWORD)
    seed.seed_restaurants(db_session)
    return client


def auth(db_session, local_part: str = "maya") -> dict:
    user = db_session.scalar(select(User).where(User.email == f"{local_part}@masaischool.ac.in"))
    return {"Authorization": f"Bearer {create_access_token(user)}"}


def dishes_of(db_session, restaurant_name: str) -> list[MenuItem]:
    return list(
        db_session.scalars(
            select(MenuItem)
            .join(Restaurant, Restaurant.id == MenuItem.restaurant_id)
            .where(Restaurant.name == restaurant_name, MenuItem.is_available.is_(True))
            .order_by(MenuItem.id)
        )
    )


def body(lines: list[tuple[int, int]], **extra) -> dict:
    return {
        "items": [{"menu_item_id": i, "quantity": q} for i, q in lines],
        "delivery_address": ADDRESS,
        **extra,
    }


def place(client, db_session, payload, who: str = "maya"):
    return client.post("/orders", json=payload, headers=auth(db_session, who))


def row_counts(db_session) -> tuple[int, int, int]:
    db_session.expire_all()
    return tuple(
        db_session.scalar(select(func.count()).select_from(model))
        for model in (Order, OrderItem, PaymentLedger)
    )


def test_place_order_returns_priced_snapshot(seeded, db_session):
    first, second = dishes_of(db_session, "Dosa Dash")[:2]

    response = place(
        seeded,
        db_session,
        body([(first.id, 2), (second.id, 3)], delivery_address=f"  {ADDRESS}  ", notes="   "),
    )

    data = response.json()
    expected_total = first.price * 2 + second.price * 3
    assert response.status_code == 201
    assert data["status"] == "PLACED"
    assert data["payment"] == {"method": "mock", "status": "mock_paid"}
    assert data["total"] == expected_total
    assert data["delivery_address"] == ADDRESS
    assert data["notes"] is None
    assert data["restaurant"] == {"id": first.restaurant_id, "name": "Dosa Dash"}
    assert data["created_at"] and data["updated_at"]
    assert data["items"] == [
        {
            "menu_item_id": first.id,
            "name": first.name,
            "unit_price": first.price,
            "quantity": 2,
            "line_total": first.price * 2,
        },
        {
            "menu_item_id": second.id,
            "name": second.name,
            "unit_price": second.price,
            "quantity": 3,
            "line_total": second.price * 3,
        },
    ]


def test_place_order_keeps_notes(seeded, db_session):
    dish = dishes_of(db_session, "Dosa Dash")[0]

    response = place(seeded, db_session, body([(dish.id, 1)], notes="  less spicy "))

    assert response.json()["notes"] == "less spicy"


def test_place_order_writes_one_order_its_items_and_one_ledger_row(seeded, db_session):
    first, second = dishes_of(db_session, "Chai & Chill")[:2]

    data = place(seeded, db_session, body([(first.id, 1), (second.id, 4)])).json()

    assert row_counts(db_session) == (1, 2, 1)
    ledger = db_session.scalar(select(PaymentLedger))
    assert ledger.order_id == data["id"]
    assert ledger.amount == data["total"] == first.price + second.price * 4
    assert ledger.method == "mock"
    assert ledger.status.value == "mock_paid"
    assert db_session.get(Order, data["id"]).customer_id == db_session.scalar(
        select(User.id).where(User.email == "maya@masaischool.ac.in")
    )


@pytest.mark.parametrize(
    "extra",
    [
        {"total": 1},
        {"price": 1},
        {"unit_price": 1},
        {"status": "DELIVERED"},
        {"payment_status": "refunded"},
        {"restaurant_id": 2},
    ],
    ids=lambda e: next(iter(e)),
)
def test_client_cannot_send_money_or_state_fields(seeded, db_session, extra):
    dish = dishes_of(db_session, "Dosa Dash")[0]

    response = place(seeded, db_session, body([(dish.id, 1)], **extra))

    assert response.status_code == 422
    assert response.json()["detail"][0]["type"] == "extra_forbidden"
    assert row_counts(db_session) == (0, 0, 0)


def test_line_level_extra_fields_are_rejected(seeded, db_session):
    dish = dishes_of(db_session, "Dosa Dash")[0]
    payload = body([(dish.id, 1)])
    payload["items"][0]["unit_price"] = 1

    response = place(seeded, db_session, payload)

    assert response.status_code == 422
    assert row_counts(db_session) == (0, 0, 0)


def test_later_price_change_does_not_alter_existing_order(seeded, db_session):
    dish = dishes_of(db_session, "Dosa Dash")[0]
    old_price = dish.price
    placed = place(seeded, db_session, body([(dish.id, 2)])).json()

    patch = seeded.patch(
        f"/owner/menu/{dish.id}",
        json={"price": old_price + 500},
        headers=auth(db_session, "owner1"),
    )
    fetched = seeded.get(f"/orders/{placed['id']}", headers=auth(db_session))

    assert patch.status_code == 200
    assert fetched.json() == placed
    assert fetched.json()["items"][0]["unit_price"] == old_price
    assert fetched.json()["total"] == old_price * 2


@pytest.mark.parametrize(
    "payload_fn",
    [
        lambda d: {"items": [], "delivery_address": ADDRESS},
        lambda d: body([(d[0], 1)] * 2),
        lambda d: body([(d[0], 0)]),
        lambda d: body([(d[0], 21)]),
        lambda d: body([(d[0], -1)]),
        lambda d: {
            "items": [{"menu_item_id": d[0], "quantity": "two"}],
            "delivery_address": ADDRESS,
        },
        lambda d: {"items": [{"menu_item_id": d[0], "quantity": 1.5}], "delivery_address": ADDRESS},
        lambda d: body([(0, 1)]),
        lambda d: body([(-3, 1)]),
        lambda d: {"items": [{"menu_item_id": "abc", "quantity": 1}], "delivery_address": ADDRESS},
        lambda d: {"items": [{"quantity": 1}], "delivery_address": ADDRESS},
        lambda d: {"items": [{"menu_item_id": d[0], "quantity": 1}]},
        lambda d: body([(d[0], 1)], delivery_address="abcd"),
        lambda d: body([(d[0], 1)], delivery_address="    "),
        lambda d: body([(d[0], 1)], delivery_address="a" * 201),
        lambda d: body([(d[0], 1)], notes="n" * 201),
        lambda d: [],
    ],
    ids=[
        "empty_items",
        "duplicate_dish",
        "quantity_zero",
        "quantity_21",
        "quantity_negative",
        "quantity_string",
        "quantity_float",
        "dish_id_zero",
        "dish_id_negative",
        "dish_id_string",
        "dish_id_missing",
        "address_missing",
        "address_4_chars",
        "address_blank",
        "address_201_chars",
        "notes_201_chars",
        "body_not_object",
    ],
)
def test_invalid_orders_are_422_and_create_nothing(seeded, db_session, payload_fn):
    dish_ids = [d.id for d in dishes_of(db_session, "Dosa Dash")]

    response = place(seeded, db_session, payload_fn(dish_ids))

    assert response.status_code == 422
    assert row_counts(db_session) == (0, 0, 0)


def test_duplicate_dish_message_is_explained(seeded, db_session):
    dish = dishes_of(db_session, "Dosa Dash")[0]

    response = place(seeded, db_session, body([(dish.id, 1), (dish.id, 2)]))

    assert "Each dish can appear once" in response.json()["detail"][0]["msg"]


def test_more_than_30_lines_is_422(seeded, db_session):
    dish = dishes_of(db_session, "Dosa Dash")[0]
    payload = {
        "items": [{"menu_item_id": dish.id + n, "quantity": 1} for n in range(31)],
        "delivery_address": ADDRESS,
    }

    response = place(seeded, db_session, payload)

    assert response.status_code == 422
    assert row_counts(db_session) == (0, 0, 0)


@pytest.mark.parametrize("quantity", [1, 20])
@pytest.mark.parametrize("address", ["a" * 5, "a" * 200])
def test_boundary_values_are_accepted(seeded, db_session, quantity, address):
    dish = dishes_of(db_session, "Dosa Dash")[0]

    response = place(
        seeded,
        db_session,
        body([(dish.id, quantity)], delivery_address=address, notes="n" * 200),
    )

    assert response.status_code == 201
    assert response.json()["total"] == dish.price * quantity


def test_unknown_dish_is_422(seeded, db_session):
    response = place(seeded, db_session, body([(99999, 1)]))

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "menu_item_not_found"
    assert row_counts(db_session) == (0, 0, 0)


def test_one_unknown_dish_among_valid_ones_is_422(seeded, db_session):
    dish = dishes_of(db_session, "Dosa Dash")[0]

    response = place(seeded, db_session, body([(dish.id, 1), (99999, 1)]))

    assert response.json()["detail"]["code"] == "menu_item_not_found"
    assert row_counts(db_session) == (0, 0, 0)


def test_dishes_from_two_restaurants_are_422(seeded, db_session):
    dosa = dishes_of(db_session, "Dosa Dash")[0]
    burger = dishes_of(db_session, "Burger Barn")[0]

    response = place(seeded, db_session, body([(dosa.id, 1), (burger.id, 1)]))

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "mixed_restaurants"
    assert row_counts(db_session) == (0, 0, 0)


def test_unavailable_dish_is_409_and_creates_nothing(seeded, db_session):
    available, unavailable = dishes_of(db_session, "Dosa Dash")[:2]
    unavailable.is_available = False
    db_session.commit()

    response = place(seeded, db_session, body([(available.id, 1), (unavailable.id, 1)]))

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "item_unavailable"
    assert unavailable.name in response.json()["detail"]["message"]
    assert row_counts(db_session) == (0, 0, 0)


def test_closed_restaurant_is_409_and_creates_nothing(seeded, db_session):
    dish = dishes_of(db_session, "Dosa Dash")[0]
    db_session.get(Restaurant, dish.restaurant_id).is_open = False
    db_session.commit()

    response = place(seeded, db_session, body([(dish.id, 1)]))

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "restaurant_closed"
    assert row_counts(db_session) == (0, 0, 0)


def test_failure_after_order_flush_leaves_no_rows(seeded, db_session, monkeypatch):
    dish = dishes_of(db_session, "Dosa Dash")[0]

    def broken_ledger(**_):
        raise RuntimeError("ledger down")

    monkeypatch.setattr("app.services.orders.PaymentLedger", broken_ledger)
    headers = auth(db_session)

    response = TestClient(app, raise_server_exceptions=False).post(
        "/orders", json=body([(dish.id, 1)]), headers=headers
    )
    db_session.rollback()  # the real get_db closes (rolls back) its session on error

    assert response.status_code == 500
    assert row_counts(db_session) == (0, 0, 0)


def test_failure_at_commit_leaves_no_rows(seeded, db_session, monkeypatch):
    dish = dishes_of(db_session, "Dosa Dash")[0]
    headers = auth(db_session)

    def broken_commit():
        raise RuntimeError("commit failed")

    monkeypatch.setattr(db_session, "commit", broken_commit)
    response = TestClient(app, raise_server_exceptions=False).post(
        "/orders", json=body([(dish.id, 1)]), headers=headers
    )
    monkeypatch.undo()
    db_session.rollback()

    assert response.status_code == 500
    assert row_counts(db_session) == (0, 0, 0)


def test_get_order_matches_post_response(seeded, db_session):
    dish = dishes_of(db_session, "Burger Barn")[0]
    placed = place(seeded, db_session, body([(dish.id, 2)]))

    fetched = seeded.get(f"/orders/{placed.json()['id']}", headers=auth(db_session))

    assert fetched.status_code == 200
    assert fetched.json() == placed.json()


@pytest.mark.parametrize("path", ["/orders/0", "/orders/99999", "/orders/-1"])
def test_get_unknown_order_is_404(seeded, db_session, path):
    response = seeded.get(path, headers=auth(db_session))

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "order_not_found"


@pytest.mark.parametrize("path", ["/orders/abc", "/orders/1.5"])
def test_get_non_integer_id_is_422(seeded, db_session, path):
    response = seeded.get(path, headers=auth(db_session))

    assert response.status_code == 422


def test_get_order_statement_count_is_constant_in_line_count(seeded, db_session):
    dishes = dishes_of(db_session, "Dosa Dash")[:8]
    assert len(dishes) == 8
    extras = [
        MenuItem(
            restaurant_id=dishes[0].restaurant_id,
            name=f"Extra {n}",
            description="d",
            category="Extras",
            price=33 + n,
            is_veg=True,
        )
        for n in range(2)
    ]
    db_session.add_all(extras)
    db_session.commit()
    ten = [*dishes, *extras]
    one_id = place(seeded, db_session, body([(ten[0].id, 1)])).json()["id"]
    ten_id = place(seeded, db_session, body([(d.id, 1) for d in ten])).json()["id"]
    headers = auth(db_session)
    engine = db_session.get_bind()
    captured: list[str] = []

    def record(conn, cursor, statement, parameters, context, executemany):
        captured.append(statement)

    def count(order_id: int) -> int:
        captured.clear()
        response = seeded.get(f"/orders/{order_id}", headers=headers)
        assert response.status_code == 200
        return len(captured)

    event.listen(engine, "before_cursor_execute", record)
    try:
        one = count(one_id)
        many = count(ten_id)
    finally:
        event.remove(engine, "before_cursor_execute", record)

    assert len(seeded.get(f"/orders/{ten_id}", headers=headers).json()["items"]) == 10
    assert one == many
