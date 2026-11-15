from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import event

from app import seed
from app.models import AdminReminderLog, Order, OrderStatus
from app.services.reminders import create_due_reminders
from tests.test_order_cancel_api import cancel
from tests.test_owner_orders_api import advance, auth, place
from tests.test_query_count import statements  # noqa: F401

PASSWORD = "seed-pass-1234"
ITEM_KEYS = {"id", "order_id", "order_status", "created_at", "minutes_waiting"}
STALE = 15


@pytest.fixture
def seeded(client, db_session):
    seed.seed_users(db_session, PASSWORD)
    seed.seed_restaurants(db_session)
    return client


def now() -> datetime:
    return datetime.now(UTC)


def age(db_session, order_id: int, minutes: float) -> None:
    order = db_session.get(Order, order_id)
    order.updated_at = now() - timedelta(minutes=minutes)
    db_session.commit()


def run_check(db_session) -> int:
    return create_due_reminders(db_session, now(), STALE)


def stale_order(client, db_session, owner="owner1", minutes=30) -> int:
    order_id = place(client, db_session, owner)
    age(db_session, order_id, minutes)
    return order_id


def listing(client, db_session, query: str = "", owner: str = "owner1"):
    return client.get(f"/owner/reminders{query}", headers=auth(db_session, owner))


def test_empty_list(seeded, db_session):
    response = listing(seeded, db_session)

    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0, "page": 1, "page_size": 10}


def test_shows_reminder_after_the_service_runs(seeded, db_session):
    order_id = stale_order(seeded, db_session)
    assert listing(seeded, db_session).json()["total"] == 0

    assert run_check(db_session) == 1

    body = listing(seeded, db_session).json()
    assert body["total"] == 1
    item = body["items"][0]
    assert item["order_id"] == order_id
    assert item["order_status"] == "PLACED"


def test_item_has_exactly_the_documented_keys_and_no_customer_data(seeded, db_session):
    stale_order(seeded, db_session)
    run_check(db_session)

    response = listing(seeded, db_session)

    assert set(response.json()["items"][0]) == ITEM_KEYS
    assert "Hostel 4" not in response.text
    assert "Maya" not in response.text
    assert "maya@" not in response.text


def test_disappears_when_owner_accepts_and_new_one_appears_when_stale_again(seeded, db_session):
    order_id = stale_order(seeded, db_session)
    run_check(db_session)

    assert advance(seeded, db_session, order_id, "ACCEPTED").status_code == 200

    assert listing(seeded, db_session).json()["total"] == 0
    assert run_check(db_session) == 0
    age(db_session, order_id, 25)
    assert run_check(db_session) == 1
    items = listing(seeded, db_session).json()["items"]
    assert [(i["order_id"], i["order_status"]) for i in items] == [(order_id, "ACCEPTED")]
    assert db_session.query(AdminReminderLog).count() == 2


def test_disappears_when_customer_cancels(seeded, db_session):
    order_id = stale_order(seeded, db_session)
    run_check(db_session)
    assert listing(seeded, db_session).json()["total"] == 1

    assert cancel(seeded, db_session, order_id).status_code == 200

    assert listing(seeded, db_session).json()["total"] == 0
    assert db_session.query(AdminReminderLog).count() == 1


def test_newest_first_with_id_tiebreak(seeded, db_session):
    ids = [stale_order(seeded, db_session) for _ in range(3)]
    run_check(db_session)
    rows = {r.order_id: r for r in db_session.query(AdminReminderLog)}
    same = datetime(2026, 3, 5, 10, 0, tzinfo=UTC)
    rows[ids[0]].created_at = same
    rows[ids[1]].created_at = datetime(2026, 3, 1, 10, 0, tzinfo=UTC)
    rows[ids[2]].created_at = same
    db_session.commit()

    got = [i["order_id"] for i in listing(seeded, db_session).json()["items"]]

    assert got == [ids[2], ids[0], ids[1]]


def test_pagination_pages_and_beyond_end(seeded, db_session):
    ids = [stale_order(seeded, db_session) for _ in range(3)]
    run_check(db_session)

    page1 = listing(seeded, db_session, "?page=1&page_size=2").json()
    page2 = listing(seeded, db_session, "?page=2&page_size=2").json()
    beyond = listing(seeded, db_session, "?page=9&page_size=2").json()

    assert page1["total"] == page2["total"] == beyond["total"] == 3
    assert len(page1["items"]) == 2
    assert [i["order_id"] for i in page2["items"]] == [ids[0]]
    assert (page2["page"], page2["page_size"]) == (2, 2)
    assert beyond["items"] == []
    got = [i["order_id"] for i in page1["items"] + page2["items"]]
    assert sorted(got) == sorted(ids)


def test_page_size_50_is_allowed(seeded, db_session):
    assert listing(seeded, db_session, "?page_size=50").status_code == 200


@pytest.mark.parametrize("query", ["?page_size=51", "?page_size=0", "?page=0", "?page=-1"])
def test_bad_paging_is_422(seeded, db_session, query):
    assert listing(seeded, db_session, query).status_code == 422


def test_minutes_waiting_is_whole_minutes_since_last_update(seeded, db_session):
    order_id = stale_order(seeded, db_session, minutes=20)
    run_check(db_session)

    waited = listing(seeded, db_session).json()["items"][0]["minutes_waiting"]

    assert order_id
    assert abs(waited - 20) <= 1
    assert isinstance(waited, int)


def test_minutes_waiting_is_never_negative(seeded, db_session):
    order_id = stale_order(seeded, db_session)
    run_check(db_session)
    order = db_session.get(Order, order_id)
    order.updated_at = now() + timedelta(minutes=5)
    db_session.commit()

    assert listing(seeded, db_session).json()["items"][0]["minutes_waiting"] == 0


def test_owner_never_sees_another_owners_reminders(seeded, db_session):
    mine = stale_order(seeded, db_session, "owner1")
    theirs = [stale_order(seeded, db_session, "owner3") for _ in range(2)]
    run_check(db_session)

    a = listing(seeded, db_session, owner="owner1").json()
    b = listing(seeded, db_session, owner="owner3").json()

    assert [i["order_id"] for i in a["items"]] == [mine]
    assert a["total"] == 1
    assert sorted(i["order_id"] for i in b["items"]) == sorted(theirs)
    assert b["total"] == 2


def test_status_check_ignores_non_watched_order_with_old_reminder(seeded, db_session):
    order_id = stale_order(seeded, db_session)
    run_check(db_session)
    for status in ("ACCEPTED", "PREPARING"):
        assert advance(seeded, db_session, order_id, status).status_code == 200

    assert listing(seeded, db_session).json()["total"] == 0
    assert db_session.get(Order, order_id).status is OrderStatus.PREPARING


def data_count(captured: list[str]) -> int:
    # the login lookup of the token's user is not reminder data
    return len([s for s in captured if "FROM users" not in s])


def test_statement_count_is_constant_as_reminders_grow(seeded, db_session, statements):  # noqa: F811
    for _ in range(2):
        stale_order(seeded, db_session)
    run_check(db_session)
    headers = auth(db_session, "owner1")
    small_total = seeded.get("/owner/reminders", headers=headers).json()["total"]
    statements.clear()
    seeded.get("/owner/reminders", headers=headers)
    small = data_count(statements)

    for _ in range(18):
        stale_order(seeded, db_session)
    run_check(db_session)
    large_total = seeded.get("/owner/reminders", headers=headers).json()["total"]
    statements.clear()
    seeded.get("/owner/reminders?page_size=50", headers=headers)
    large = data_count(statements)

    assert (small_total, large_total) == (2, 20)
    assert small == large
    assert large <= 3  # restaurant lookup + count + select


def test_listing_does_not_write(seeded, db_session):
    stale_order(seeded, db_session)
    run_check(db_session)
    writes: list[str] = []
    engine = db_session.get_bind()

    def record(conn, cursor, statement, *args):
        if not statement.lstrip().upper().startswith(("SELECT", "BEGIN", "ROLLBACK", "COMMIT")):
            writes.append(statement)

    event.listen(engine, "before_cursor_execute", record)
    try:
        listing(seeded, db_session)
    finally:
        event.remove(engine, "before_cursor_execute", record)

    assert writes == []
