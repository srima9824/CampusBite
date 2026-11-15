from datetime import UTC, datetime

import pytest
from pydantic import ValidationError
from sqlalchemy import event, select

from app import seed
from app.config import Settings, get_settings
from app.models import MenuItem, Order, OrderStatus, User
from app.security import create_access_token

PASSWORD = "seed-pass-1234"


@pytest.fixture
def seeded(client, db_session):
    seed.seed_users(db_session, PASSWORD)
    seed.seed_restaurants(db_session)
    return client


def auth(db_session, local_part: str = "maya") -> dict:
    user = db_session.scalar(select(User).where(User.email == f"{local_part}@masaischool.ac.in"))
    return {"Authorization": f"Bearer {create_access_token(user)}"}


def place(client, db_session, who: str = "maya", lines: int = 1) -> int:
    restaurant_id = db_session.scalar(select(MenuItem.restaurant_id).order_by(MenuItem.id))
    dishes = list(
        db_session.scalars(
            select(MenuItem)
            .where(MenuItem.restaurant_id == restaurant_id, MenuItem.is_available.is_(True))
            .order_by(MenuItem.id)
            .limit(lines)
        )
    )
    payload = {
        "items": [{"menu_item_id": d.id, "quantity": 1} for d in dishes],
        "delivery_address": "Hostel 4",
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


def listing(client, db_session, query: str = "", who: str = "maya"):
    return client.get(f"/orders{query}", headers=auth(db_session, who))


def ids(response) -> list[int]:
    return [item["id"] for item in response.json()["items"]]


def test_empty_list(seeded, db_session):
    response = listing(seeded, db_session)

    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0, "page": 1, "page_size": 10}


def test_returns_only_own_orders(seeded, db_session):
    mine = place(seeded, db_session, "maya")
    place(seeded, db_session, "leo")
    place(seeded, db_session, "leo")

    response = listing(seeded, db_session)

    assert ids(response) == [mine]
    assert response.json()["total"] == 1


def test_items_carry_lines_restaurant_and_payment(seeded, db_session):
    place(seeded, db_session, lines=2)

    item = listing(seeded, db_session).json()["items"][0]

    assert len(item["items"]) == 2
    assert item["restaurant"]["name"]
    assert item["payment"] == {"method": "mock", "status": "mock_paid"}


def test_newest_first(seeded, db_session):
    old, mid, new = (place(seeded, db_session) for _ in range(3))
    stamp(db_session, old, utc("2026-11-01 10:00"))
    stamp(db_session, mid, utc("2026-11-02 10:00"))
    stamp(db_session, new, utc("2026-11-03 10:00"))

    assert ids(listing(seeded, db_session)) == [new, mid, old]


def test_same_timestamp_ties_break_by_higher_id_first(seeded, db_session):
    first, second, third = (place(seeded, db_session) for _ in range(3))
    for order_id in (first, second, third):
        stamp(db_session, order_id, utc("2026-11-03 10:00"))

    assert ids(listing(seeded, db_session)) == [third, second, first]


@pytest.fixture
def mixed(seeded, db_session):
    placed = place(seeded, db_session)
    delivered = place(seeded, db_session)
    cancelled = place(seeded, db_session)
    stamp(db_session, delivered, status=OrderStatus.DELIVERED)
    stamp(db_session, cancelled, status=OrderStatus.CANCELLED)
    return {"PLACED": placed, "DELIVERED": delivered, "CANCELLED": cancelled}


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("?status=DELIVERED", ["DELIVERED"]),
        ("?status=DELIVERED,CANCELLED", ["CANCELLED", "DELIVERED"]),
        ("?status=%20DELIVERED%20,%20PLACED%20", ["DELIVERED", "PLACED"]),
        ("?status=REFUNDED", []),
        ("?status=", ["CANCELLED", "DELIVERED", "PLACED"]),
    ],
)
def test_status_filter(seeded, db_session, mixed, query, expected):
    response = listing(seeded, db_session, query)

    assert response.status_code == 200
    assert sorted(ids(response)) == sorted(mixed[name] for name in expected)
    assert response.json()["total"] == len(expected)


@pytest.mark.parametrize("query", ["?status=NOPE", "?status=DELIVERED,NOPE", "?status=delivered"])
def test_unknown_status_is_422(seeded, db_session, query):
    response = listing(seeded, db_session, query)

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "invalid_status"


@pytest.fixture
def dated(seeded, db_session):
    """Orders around the IST day boundary (IST = UTC+5:30)."""
    stamps = {
        "late_14": "2026-11-14 18:00",  # 2026-11-14 23:30 IST
        "early_15": "2026-11-14 19:00",  # 2026-11-15 00:30 IST
        "noon_15": "2026-11-15 06:30",  # 2026-11-15 12:00 IST
        "noon_16": "2026-11-16 06:30",
    }
    created = {}
    for name, text in stamps.items():
        created[name] = place(seeded, db_session)
        stamp(db_session, created[name], utc(text))
    return created


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("?date_from=2026-11-14&date_to=2026-11-14", ["late_14"]),
        ("?date_from=2026-11-15&date_to=2026-11-15", ["noon_15", "early_15"]),
        ("?date_from=2026-11-15", ["noon_16", "noon_15", "early_15"]),
        ("?date_to=2026-11-14", ["late_14"]),
        ("?date_to=2026-11-15", ["noon_15", "early_15", "late_14"]),
        ("?date_from=2026-11-14&date_to=2026-11-16", ["noon_16", "noon_15", "early_15", "late_14"]),
        ("?date_from=2026-11-17", []),
        ("?date_from=&date_to=", ["noon_16", "noon_15", "early_15", "late_14"]),
    ],
)
def test_date_filters_use_ist_calendar_days_inclusive(seeded, db_session, dated, query, expected):
    response = listing(seeded, db_session, query)

    assert response.status_code == 200
    assert ids(response) == [dated[name] for name in expected]
    assert response.json()["total"] == len(expected)


def test_app_timezone_setting_moves_the_boundary(seeded, db_session, dated, monkeypatch):
    monkeypatch.setenv("APP_TIMEZONE", "UTC")
    get_settings.cache_clear()

    response = listing(seeded, db_session, "?date_from=2026-11-14&date_to=2026-11-14")

    assert ids(response) == [dated["early_15"], dated["late_14"]]


def test_invalid_app_timezone_fails_settings_validation(monkeypatch):
    monkeypatch.setenv("APP_TIMEZONE", "Mars/Olympus")

    with pytest.raises(ValidationError, match="valid time zone"):
        Settings(_env_file=None)


@pytest.mark.parametrize("bad", ["15-11-2026", "2026-13-01", "abc", "2026-02-30"])
@pytest.mark.parametrize("param", ["date_from", "date_to"])
def test_bad_date_format_is_422(seeded, db_session, param, bad):
    response = listing(seeded, db_session, f"?{param}={bad}")

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "invalid_date"


def test_from_after_to_is_422(seeded, db_session):
    response = listing(seeded, db_session, "?date_from=2026-11-16&date_to=2026-11-15")

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "invalid_date_range"


def test_status_and_dates_combine(seeded, db_session):
    hit = place(seeded, db_session)
    wrong_status = place(seeded, db_session)
    wrong_day = place(seeded, db_session)
    stamp(db_session, hit, utc("2026-11-14 18:00"), OrderStatus.DELIVERED)
    stamp(db_session, wrong_status, utc("2026-11-14 18:00"), OrderStatus.PLACED)
    stamp(db_session, wrong_day, utc("2026-11-14 19:00"), OrderStatus.DELIVERED)

    response = listing(seeded, db_session, "?status=DELIVERED&date_to=2026-11-14")

    assert ids(response) == [hit]
    assert response.json()["total"] == 1


@pytest.fixture
def twenty_five(seeded, db_session):
    created = [place(seeded, db_session) for _ in range(25)]
    return list(reversed(created))  # newest first


def test_default_page_is_first_ten(seeded, db_session, twenty_five):
    body = listing(seeded, db_session).json()

    assert [i["id"] for i in body["items"]] == twenty_five[:10]
    assert (body["total"], body["page"], body["page_size"]) == (25, 1, 10)


def test_second_page_continues_without_overlap(seeded, db_session, twenty_five):
    body = listing(seeded, db_session, "?page=2&page_size=10").json()

    assert [i["id"] for i in body["items"]] == twenty_five[10:20]
    assert body["page"] == 2


def test_last_page_is_partial(seeded, db_session, twenty_five):
    response = listing(seeded, db_session, "?page=3&page_size=10")

    assert ids(response) == twenty_five[20:]
    assert response.json()["total"] == 25


def test_page_beyond_end_is_empty_with_total(seeded, db_session, twenty_five):
    body = listing(seeded, db_session, "?page=9&page_size=10").json()

    assert body["items"] == []
    assert body["total"] == 25


def test_page_size_is_honoured(seeded, db_session, twenty_five):
    response = listing(seeded, db_session, "?page_size=50")

    assert len(ids(response)) == 25


@pytest.mark.parametrize("query", ["?page=0", "?page_size=0", "?page_size=51", "?page=x"])
def test_bad_paging_is_422(seeded, db_session, query):
    assert listing(seeded, db_session, query).status_code == 422


def count_statements(client, db_session, orders: int) -> int:
    for _ in range(orders):
        place(client, db_session, lines=4)
    captured: list[str] = []
    engine = db_session.get_bind()

    def record(conn, cursor, statement, parameters, context, executemany):
        captured.append(statement)

    headers = auth(db_session)
    event.listen(engine, "before_cursor_execute", record)
    try:
        assert client.get("/orders?page_size=50", headers=headers).status_code == 200
    finally:
        event.remove(engine, "before_cursor_execute", record)
    return len(captured)


def test_statement_count_is_constant_in_number_of_orders(seeded, db_session):
    few = count_statements(seeded, db_session, 2)
    many = count_statements(seeded, db_session, 18)  # 20 orders in total

    assert few == many
    # one login lookup plus count, orders, restaurants, order lines and reviews
    assert many <= 6
