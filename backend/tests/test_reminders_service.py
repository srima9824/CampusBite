from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app import seed
from app.models import AdminReminderLog, Order, OrderStatus, Restaurant, User
from app.services import reminders as service
from app.services.reminders import create_due_reminders

PASSWORD = "seed-pass-1234"
NOW = datetime(2026, 11, 15, 12, 0, tzinfo=UTC)
STALE = 15
WATCHED = [OrderStatus.PLACED, OrderStatus.ACCEPTED]
UNWATCHED = [s for s in OrderStatus if s not in WATCHED]


@pytest.fixture
def seeded(db_session):
    seed.seed_users(db_session, PASSWORD)
    seed.seed_restaurants(db_session)
    return db_session


def add_order(db, owner: str = "owner1", status=OrderStatus.PLACED, age_minutes: float = 30):
    restaurant = db.scalar(
        select(Restaurant)
        .join(User, User.id == Restaurant.owner_id)
        .where(User.email == f"{owner}@masaischool.ac.in")
    )
    customer = db.scalar(select(User).where(User.email == "maya@masaischool.ac.in"))
    order = Order(
        customer_id=customer.id,
        restaurant_id=restaurant.id,
        status=status,
        total=100,
        delivery_address="Hostel 4",
    )
    db.add(order)
    db.commit()
    set_age(db, order.id, age_minutes)
    return order


def set_age(db, order_id: int, age_minutes: float) -> None:
    order = db.get(Order, order_id)
    order.updated_at = NOW - timedelta(minutes=age_minutes)
    db.commit()


def reminders(db) -> list[AdminReminderLog]:
    db.expire_all()
    return list(db.scalars(select(AdminReminderLog).order_by(AdminReminderLog.id)))


@pytest.mark.parametrize("status", WATCHED)
def test_stale_watched_order_gets_one_reminder(seeded, status):
    order = add_order(seeded, status=status)

    created = create_due_reminders(seeded, NOW, STALE)

    rows = reminders(seeded)
    assert created == 1
    assert [(r.order_id, r.restaurant_id, r.order_status) for r in rows] == [
        (order.id, order.restaurant_id, status)
    ]
    assert rows[0].created_at is not None


@pytest.mark.parametrize("status", UNWATCHED)
def test_other_statuses_never_get_reminders(seeded, status):
    add_order(seeded, status=status, age_minutes=600)

    created = create_due_reminders(seeded, NOW, STALE)

    assert created == 0
    assert reminders(seeded) == []


def test_all_nine_statuses_are_covered():
    assert len(WATCHED) + len(UNWATCHED) == len(OrderStatus) == 9


@pytest.mark.parametrize(
    ("age_minutes", "expected"),
    [(0, 0), (5, 0), (14.9, 0), (15, 0), (15.01, 1), (16, 1), (600, 1)],
)
def test_boundary_exactly_at_threshold_is_not_stale(seeded, age_minutes, expected):
    add_order(seeded, age_minutes=age_minutes)

    assert create_due_reminders(seeded, NOW, STALE) == expected


def test_threshold_follows_the_stale_minutes_argument(seeded):
    add_order(seeded, age_minutes=20)

    assert create_due_reminders(seeded, NOW, 30) == 0
    assert create_due_reminders(seeded, NOW, 10) == 1


def test_second_call_creates_nothing(seeded):
    add_order(seeded)

    first = create_due_reminders(seeded, NOW, STALE)
    second = create_due_reminders(seeded, NOW + timedelta(minutes=5), STALE)

    assert (first, second) == (1, 0)
    assert len(reminders(seeded)) == 1


def test_order_that_moves_on_and_goes_stale_again_gets_one_more(seeded):
    order = add_order(seeded, status=OrderStatus.PLACED)
    assert create_due_reminders(seeded, NOW, STALE) == 1

    order.status = OrderStatus.ACCEPTED
    seeded.commit()
    set_age(seeded, order.id, 40)
    second = create_due_reminders(seeded, NOW, STALE)
    third = create_due_reminders(seeded, NOW, STALE)

    assert (second, third) == (1, 0)
    assert [r.order_status for r in reminders(seeded)] == [
        OrderStatus.PLACED,
        OrderStatus.ACCEPTED,
    ]


def test_order_that_moved_to_accepted_recently_is_not_reminded(seeded):
    order = add_order(seeded, status=OrderStatus.PLACED)
    create_due_reminders(seeded, NOW, STALE)
    order.status = OrderStatus.ACCEPTED
    seeded.commit()
    set_age(seeded, order.id, 2)

    assert create_due_reminders(seeded, NOW, STALE) == 0


def test_reminders_are_created_for_all_restaurants(seeded):
    a = add_order(seeded, "owner1")
    b = add_order(seeded, "owner3", status=OrderStatus.ACCEPTED)
    add_order(seeded, "owner1", age_minutes=1)

    created = create_due_reminders(seeded, NOW, STALE)

    rows = reminders(seeded)
    assert created == 2
    assert {(r.order_id, r.restaurant_id) for r in rows} == {
        (a.id, a.restaurant_id),
        (b.id, b.restaurant_id),
    }
    assert a.restaurant_id != b.restaurant_id


def test_due_orders_query_lists_only_unreminded_stale_watched_orders(seeded):
    due = add_order(seeded)
    add_order(seeded, age_minutes=1)
    add_order(seeded, status=OrderStatus.READY)
    done = add_order(seeded)
    seeded.add(
        AdminReminderLog(
            order_id=done.id, restaurant_id=done.restaurant_id, order_status=done.status
        )
    )
    seeded.commit()

    ids = [o.id for o in seeded.scalars(service.due_orders_query(NOW, STALE))]

    assert ids == [due.id]


def test_concurrent_duplicate_returns_zero_and_leaves_consistent_db(seeded, monkeypatch):
    order = add_order(seeded)
    original = service.due_orders_query

    def query_then_race(now, stale_minutes):
        query = original(now, stale_minutes)
        # another worker commits its reminder after we read but before we commit
        rival = seeded.get_bind().connect()
        rival.exec_driver_sql(
            "INSERT INTO admin_reminder_logs (order_id, restaurant_id, order_status, created_at) "
            f"VALUES ({order.id}, {order.restaurant_id}, 'PLACED', CURRENT_TIMESTAMP)"
        )
        rival.commit()
        rival.close()
        return query

    monkeypatch.setattr(service, "due_orders_query", query_then_race)

    created = create_due_reminders(seeded, NOW, STALE)

    rows = reminders(seeded)
    assert created == 0
    assert len(rows) == 1
    assert seeded.scalar(select(Order.id).where(Order.id == order.id)) == order.id
    monkeypatch.undo()
    assert create_due_reminders(seeded, NOW, STALE) == 0


def test_integrity_error_is_rolled_back_not_raised(seeded, monkeypatch):
    add_order(seeded)

    def boom():
        raise IntegrityError("stmt", {}, Exception("dup"))

    monkeypatch.setattr(seeded, "commit", boom)

    assert create_due_reminders(seeded, NOW, STALE) == 0
