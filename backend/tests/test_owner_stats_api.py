from datetime import UTC, datetime

import pytest
from sqlalchemy import event, select

from app import seed
from app.config import get_settings
from app.models import (
    MenuItem,
    Order,
    OrderStatus,
    PaymentStatus,
    Restaurant,
    Review,
    User,
)
from app.services import owner_stats
from tests.test_order_cancel_api import cancel
from tests.test_owner_orders_api import auth, place, stamp, utc
from tests.test_owner_returns_api import decide, requested
from tests.test_query_count import add_menu_items

PASSWORD = "seed-pass-1234"
STATS_KEYS = {
    "total_orders",
    "revenue",
    "orders_today",
    "by_status",
    "top_dishes",
    "average_rating",
    "review_count",
}
DISH_KEYS = {"menu_item_id", "name", "quantity"}
ALL_STATUSES = {status.name for status in OrderStatus}


@pytest.fixture
def seeded(client, db_session):
    seed.seed_users(db_session, PASSWORD)
    seed.seed_restaurants(db_session)
    return client


def stats(client, db_session, owner: str = "owner1") -> dict:
    response = client.get("/owner/stats", headers=auth(db_session, owner))
    assert response.status_code == 200
    return response.json()


def order_of(client, db_session, lines, owner: str = "owner1", who: str = "maya") -> int:
    payload = {
        "items": [{"menu_item_id": i, "quantity": q} for i, q in lines],
        "delivery_address": "Hostel 4",
    }
    response = client.post("/orders", json=payload, headers=auth(db_session, who))
    assert response.status_code == 201
    return response.json()["id"]


def menu_ids(db_session, owner: str = "owner1") -> list[int]:
    return list(
        db_session.scalars(
            select(MenuItem.id)
            .join(Restaurant, Restaurant.id == MenuItem.restaurant_id)
            .join(User, User.id == Restaurant.owner_id)
            .where(User.email == f"{owner}@masaischool.ac.in", MenuItem.is_available.is_(True))
            .order_by(MenuItem.id)
        )
    )


def total_of(db_session, order_id: int) -> int:
    db_session.expire_all()
    return db_session.get(Order, order_id).total


def review_row(db_session, order_id: int, rating: int) -> None:
    order = db_session.get(Order, order_id)
    db_session.add(
        Review(
            order_id=order_id,
            customer_id=order.customer_id,
            restaurant_id=order.restaurant_id,
            rating=rating,
        )
    )
    db_session.commit()


class FrozenClock(datetime):
    now_utc = datetime(2026, 11, 15, 4, 30, tzinfo=UTC)

    @classmethod
    def now(cls, tz=None):
        return cls.now_utc.astimezone(tz)


@pytest.fixture
def frozen(monkeypatch):
    monkeypatch.setattr(owner_stats, "datetime", FrozenClock)


# empty and shape


def test_empty_restaurant_has_zeros_and_all_nine_statuses(seeded, db_session):
    body = stats(seeded, db_session)

    assert set(body) == STATS_KEYS
    assert body["total_orders"] == 0
    assert body["revenue"] == 0
    assert body["orders_today"] == 0
    assert body["top_dishes"] == []
    assert body["average_rating"] is None
    assert body["review_count"] == 0
    assert len(ALL_STATUSES) == 9
    assert body["by_status"] == {name: 0 for name in ALL_STATUSES}


# totals and revenue


def test_total_orders_and_revenue_after_several_orders(seeded, db_session):
    ids = [place(seeded, db_session, lines=n) for n in (1, 2, 3)]

    body = stats(seeded, db_session)

    assert body["total_orders"] == 3
    assert body["revenue"] == sum(total_of(db_session, i) for i in ids)
    assert body["revenue"] > 0
    assert body["orders_today"] == 3
    assert body["by_status"]["PLACED"] == 3


def test_cancelled_order_leaves_revenue_and_dishes_but_still_counts(seeded, db_session):
    kept = place(seeded, db_session, lines=1)
    gone = place(seeded, db_session, lines=2)
    assert cancel(seeded, db_session, gone).status_code == 200

    body = stats(seeded, db_session)

    assert body["total_orders"] == 2
    assert body["revenue"] == total_of(db_session, kept)
    assert body["by_status"]["CANCELLED"] == 1
    assert body["by_status"]["PLACED"] == 1
    assert sum(d["quantity"] for d in body["top_dishes"]) == 2


def test_approved_return_is_refunded_and_excluded_from_revenue(seeded, db_session):
    kept = place(seeded, db_session)
    stamp(db_session, kept, status=OrderStatus.DELIVERED)
    returned = requested(seeded, db_session)
    assert decide(seeded, db_session, returned, "APPROVED").status_code == 200

    body = stats(seeded, db_session)

    assert body["total_orders"] == 2
    assert body["revenue"] == total_of(db_session, kept)
    assert body["by_status"]["REFUNDED"] == 1
    assert body["by_status"]["DELIVERED"] == 1
    assert sum(d["quantity"] for d in body["top_dishes"]) == 2


def test_rejected_return_keeps_revenue(seeded, db_session):
    order_id = requested(seeded, db_session)
    assert decide(seeded, db_session, order_id, "REJECTED").status_code == 200

    body = stats(seeded, db_session)

    assert body["revenue"] == total_of(db_session, order_id)
    assert body["by_status"]["DELIVERED"] == 1
    assert body["by_status"]["REFUNDED"] == 0
    assert sum(d["quantity"] for d in body["top_dishes"]) == 2


def test_delivered_orders_keep_revenue(seeded, db_session):
    order_id = place(seeded, db_session)
    stamp(db_session, order_id, status=OrderStatus.DELIVERED)

    body = stats(seeded, db_session)

    assert body["revenue"] == total_of(db_session, order_id)
    assert body["by_status"]["DELIVERED"] == 1


# by_status


def test_by_status_counts_match_orders_set_to_each_status(seeded, db_session):
    expected = {}
    for position, status in enumerate(OrderStatus, start=1):
        for _ in range(position):
            stamp(db_session, place(seeded, db_session), status=status)
        expected[status.name] = position

    body = stats(seeded, db_session)

    assert body["by_status"] == expected
    assert body["total_orders"] == sum(expected.values())


# top dishes


def test_top_dishes_is_capped_at_five_and_ordered(seeded, db_session):
    add_menu_items(db_session, 1, 6)
    ids = menu_ids(db_session)
    assert len(ids) >= 7
    for dish, quantity in zip(ids[:7], (1, 7, 3, 3, 9, 2, 5), strict=True):
        order_of(seeded, db_session, [(dish, quantity)])

    top = stats(seeded, db_session)["top_dishes"]

    assert len(top) == 5
    assert [d["quantity"] for d in top] == [9, 7, 5, 3, 3]
    assert set(top[0]) == DISH_KEYS
    assert [d["menu_item_id"] for d in top][:3] == [ids[4], ids[1], ids[6]]
    assert [d["name"] for d in top[3:]] == sorted(d["name"] for d in top[3:])


def test_top_dishes_ties_break_by_name_ascending(seeded, db_session):
    ids = menu_ids(db_session)[:3]
    for dish in reversed(ids):
        order_of(seeded, db_session, [(dish, 2)])

    top = stats(seeded, db_session)["top_dishes"]

    names = [d["name"] for d in top]
    assert [d["quantity"] for d in top] == [2, 2, 2]
    assert names == sorted(names)


def test_top_dishes_sums_quantities_across_orders_and_lines(seeded, db_session):
    first, second = menu_ids(db_session)[:2]
    order_of(seeded, db_session, [(first, 3), (second, 1)])
    order_of(seeded, db_session, [(first, 2)])
    order_of(seeded, db_session, [(second, 4)])

    top = stats(seeded, db_session)["top_dishes"]

    assert {d["menu_item_id"]: d["quantity"] for d in top} == {first: 5, second: 5}


def test_top_dishes_use_the_snapshot_name_after_a_rename_or_reprice(seeded, db_session):
    dish_id = menu_ids(db_session)[0]
    order_id = order_of(seeded, db_session, [(dish_id, 2)])
    original = db_session.get(MenuItem, dish_id).name
    revenue = total_of(db_session, order_id)
    item = db_session.get(MenuItem, dish_id)
    item.name = "Renamed Special"
    item.price += 50
    db_session.commit()

    body = stats(seeded, db_session)

    assert body["top_dishes"] == [{"menu_item_id": dish_id, "name": original, "quantity": 2}]
    assert body["revenue"] == revenue


# orders today


@pytest.mark.parametrize(
    ("created_at", "counted"),
    [
        ("2026-11-14T18:29:59", False),  # 23:59:59 IST the day before
        ("2026-11-14T18:30:00", True),  # 00:00 IST, start is inclusive
        ("2026-11-15T04:30:00", True),
        ("2026-11-15T18:29:59", True),  # 23:59:59 IST
        ("2026-11-15T18:30:00", False),  # next IST midnight, end is exclusive
    ],
)
def test_orders_today_boundaries_in_kolkata(seeded, db_session, frozen, created_at, counted):
    order_id = place(seeded, db_session)
    stamp(db_session, order_id, created_at=utc(created_at))

    body = stats(seeded, db_session)

    assert body["orders_today"] == (1 if counted else 0)
    assert body["total_orders"] == 1


@pytest.mark.parametrize(
    ("created_at", "counted"),
    [
        ("2026-11-14T23:59:59", False),
        ("2026-11-14T18:30:00", False),  # inside the IST day, outside the UTC day
        ("2026-11-15T00:00:00", True),
        ("2026-11-15T23:59:59", True),
        ("2026-11-16T00:00:00", False),
    ],
)
def test_orders_today_boundaries_follow_app_timezone(
    seeded, db_session, frozen, monkeypatch, created_at, counted
):
    monkeypatch.setenv("APP_TIMEZONE", "UTC")
    get_settings.cache_clear()
    order_id = place(seeded, db_session)
    stamp(db_session, order_id, created_at=utc(created_at))

    body = stats(seeded, db_session)

    assert body["orders_today"] == (1 if counted else 0)


# ratings


def test_average_rating_rounds_to_one_decimal(seeded, db_session):
    for rating in (5, 4, 4):
        review_row(db_session, place(seeded, db_session), rating)

    body = stats(seeded, db_session)

    assert body["average_rating"] == 4.3
    assert body["review_count"] == 3


def test_ratings_ignore_other_restaurants_reviews(seeded, db_session):
    review_row(db_session, place(seeded, db_session, owner="owner1"), 2)
    review_row(db_session, place(seeded, db_session, owner="owner3"), 5)

    body = stats(seeded, db_session)

    assert body["average_rating"] == 2.0
    assert body["review_count"] == 1


# isolation


def test_owner_never_sees_another_restaurants_numbers(seeded, db_session):
    mine = place(seeded, db_session, owner="owner1")
    theirs = place(seeded, db_session, owner="owner3", lines=3)
    stamp(db_session, theirs, status=OrderStatus.DELIVERED)
    review_row(db_session, theirs, 5)

    a = stats(seeded, db_session, "owner1")
    b = stats(seeded, db_session, "owner3")

    assert a["total_orders"] == 1
    assert a["revenue"] == total_of(db_session, mine)
    assert a["by_status"]["DELIVERED"] == 0
    assert a["review_count"] == 0
    assert b["total_orders"] == 1
    assert b["revenue"] == total_of(db_session, theirs)
    assert b["review_count"] == 1
    assert {d["menu_item_id"] for d in a["top_dishes"]}.isdisjoint(
        {d["menu_item_id"] for d in b["top_dishes"]}
    )


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


def stats_statements(client, db_session, statements) -> int:
    headers = auth(db_session, "owner1")
    statements.clear()
    assert client.get("/owner/stats", headers=headers).status_code == 200
    return len(statements)


def test_statement_count_is_constant_as_orders_grow(seeded, db_session, statements):
    ids = menu_ids(db_session)[:4]
    for _ in range(2):
        order_of(seeded, db_session, [(i, 2) for i in ids])
    small = stats_statements(seeded, db_session, statements)

    for _ in range(28):
        order_id = order_of(seeded, db_session, [(i, 3) for i in ids])
        review_row(db_session, order_id, 4)
    large = stats_statements(seeded, db_session, statements)

    assert small == large
    assert large <= 6


def test_refunded_payment_is_left_out_of_revenue_and_dishes(seeded, db_session):
    order_id = place(seeded, db_session)
    db_session.get(Order, order_id).payment_status = PaymentStatus.REFUNDED
    db_session.commit()

    body = stats(seeded, db_session)

    assert body["revenue"] == 0
    assert body["total_orders"] == 1
    assert body["top_dishes"] == []
