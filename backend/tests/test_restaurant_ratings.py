import pytest
from sqlalchemy import event

from app import seed
from app.models import OrderStatus
from tests.test_owner_orders_api import auth, place, stamp

PASSWORD = "seed-pass-1234"
OWNERS = {1: "owner1", 2: "owner3", 3: "owner5", 4: "owner7"}
DOSA_DASH, BURGER_BARN = 1, 2


@pytest.fixture
def seeded(client, db_session):
    seed.seed_users(db_session, PASSWORD)
    seed.seed_restaurants(db_session)
    return client


def rate(client, db_session, restaurant_id: int, ratings: list[int]) -> None:
    for rating in ratings:
        order_id = place(client, db_session, owner=OWNERS[restaurant_id])
        stamp(db_session, order_id, status=OrderStatus.DELIVERED)
        response = client.post(
            f"/orders/{order_id}/review",
            json={"rating": rating},
            headers=auth(db_session, "maya"),
        )
        assert response.status_code == 201


def by_id(client) -> dict:
    return {i["id"]: i for i in client.get("/restaurants").json()["items"]}


def test_restaurant_without_reviews_has_null_average_and_zero_count(seeded):
    listed = by_id(seeded)[DOSA_DASH]
    detail = seeded.get(f"/restaurants/{DOSA_DASH}").json()

    for body in (listed, detail):
        assert body["average_rating"] is None
        assert body["review_count"] == 0


def test_average_is_rounded_to_one_decimal(seeded, db_session):
    rate(seeded, db_session, DOSA_DASH, [5, 4, 4])

    listed = by_id(seeded)[DOSA_DASH]
    detail = seeded.get(f"/restaurants/{DOSA_DASH}").json()

    for body in (listed, detail):
        assert body["average_rating"] == 4.3
        assert body["review_count"] == 3


def test_single_review_is_its_own_average(seeded, db_session):
    rate(seeded, db_session, DOSA_DASH, [2])

    body = seeded.get(f"/restaurants/{DOSA_DASH}").json()

    assert body["average_rating"] == 2.0
    assert body["review_count"] == 1


def test_reviews_only_count_toward_their_own_restaurant(seeded, db_session):
    rate(seeded, db_session, DOSA_DASH, [5, 5])
    rate(seeded, db_session, BURGER_BARN, [1])

    restaurants = by_id(seeded)

    assert (restaurants[DOSA_DASH]["average_rating"], restaurants[DOSA_DASH]["review_count"]) == (
        5.0,
        2,
    )
    assert (
        restaurants[BURGER_BARN]["average_rating"],
        restaurants[BURGER_BARN]["review_count"],
    ) == (1.0, 1)
    for other in (3, 4):
        assert restaurants[other]["average_rating"] is None
        assert restaurants[other]["review_count"] == 0


def test_ratings_are_public_without_a_token(seeded, db_session):
    rate(seeded, db_session, DOSA_DASH, [4])

    listed = seeded.get("/restaurants")
    detail = seeded.get(f"/restaurants/{DOSA_DASH}")

    assert "authorization" not in {k.lower() for k in seeded.headers}
    assert listed.status_code == detail.status_code == 200
    assert detail.json()["average_rating"] == 4.0


def test_a_new_review_updates_the_average(seeded, db_session):
    rate(seeded, db_session, DOSA_DASH, [5])
    before = seeded.get(f"/restaurants/{DOSA_DASH}").json()

    rate(seeded, db_session, DOSA_DASH, [3])
    after = seeded.get(f"/restaurants/{DOSA_DASH}").json()

    assert (before["average_rating"], before["review_count"]) == (5.0, 1)
    assert (after["average_rating"], after["review_count"]) == (4.0, 2)


def test_search_still_works_and_carries_ratings(seeded, db_session):
    rate(seeded, db_session, DOSA_DASH, [5])
    rate(seeded, db_session, BURGER_BARN, [3])

    body = seeded.get("/restaurants", params={"q": "burger"}).json()

    assert body["total"] == 1
    assert [(i["name"], i["average_rating"], i["review_count"]) for i in body["items"]] == [
        ("Burger Barn", 3.0, 1)
    ]


def test_search_with_no_match_and_pagination_keep_working(seeded, db_session):
    rate(seeded, db_session, DOSA_DASH, [5])

    empty = seeded.get("/restaurants", params={"q": "zzz-unknown"}).json()
    first = seeded.get("/restaurants", params={"page_size": 3}).json()
    second = seeded.get("/restaurants", params={"page_size": 3, "page": 2}).json()

    assert empty["items"] == [] and empty["total"] == 0
    assert [i["name"] for i in first["items"]] == ["Dosa Dash", "Burger Barn", "Taco Tuesday"]
    assert first["items"][0]["average_rating"] == 5.0
    assert [i["name"] for i in second["items"]] == ["Chai & Chill"]
    assert second["items"][0]["average_rating"] is None
    assert first["total"] == second["total"] == 4


def test_rating_does_not_reorder_the_list(seeded, db_session):
    rate(seeded, db_session, 4, [5])
    rate(seeded, db_session, DOSA_DASH, [1])

    names = [i["name"] for i in seeded.get("/restaurants").json()["items"]]

    assert names == ["Dosa Dash", "Burger Barn", "Taco Tuesday", "Chai & Chill"]


def list_statement_count(client, db_session) -> int:
    engine = db_session.get_bind()
    captured: list[str] = []

    def record(conn, cursor, statement, parameters, context, executemany):
        captured.append(statement)

    event.listen(engine, "before_cursor_execute", record)
    try:
        assert client.get("/restaurants").status_code == 200
    finally:
        event.remove(engine, "before_cursor_execute", record)
    return len(captured)


def test_average_is_computed_in_sql_with_constant_statement_count(seeded, db_session):
    rate(seeded, db_session, DOSA_DASH, [5, 4, 4, 3])
    few = list_statement_count(seeded, db_session)

    rate(seeded, db_session, DOSA_DASH, [5, 5, 5, 5, 5, 5, 5, 5])
    rate(seeded, db_session, BURGER_BARN, [2, 3, 4, 5])
    many = list_statement_count(seeded, db_session)

    assert few == many
    assert many <= 2
