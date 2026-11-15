from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app import seed
from app.models import MenuItem, Order, OrderItem, OrderStatus, Review
from tests.test_owner_orders_api import auth, place, stamp

PASSWORD = "seed-pass-1234"
DOSA_DASH, BURGER_BARN = 1, 2
ITEM_KEYS = {"rating", "comment", "created_at", "reviewer", "dishes"}
PAGE_KEYS = {"items", "total", "page", "page_size"}
T0 = datetime(2026, 1, 1, 12, 0, tzinfo=UTC)


@pytest.fixture
def seeded(client, db_session):
    seed.seed_users(db_session, PASSWORD)
    seed.seed_restaurants(db_session)
    return client


def add_review(
    client,
    db_session,
    owner: str = "owner1",
    lines: int = 1,
    rating: int = 5,
    comment: str | None = None,
    created_at: datetime | None = None,
) -> Review:
    order_id = place(client, db_session, owner=owner, lines=lines)
    stamp(db_session, order_id, status=OrderStatus.DELIVERED)
    return insert_review(db_session, order_id, rating, comment, created_at)


def insert_review(db_session, order_id, rating=5, comment=None, created_at=None) -> Review:
    order = db_session.get(Order, order_id)
    row = Review(
        order_id=order_id,
        customer_id=order.customer_id,
        restaurant_id=order.restaurant_id,
        rating=rating,
        comment=comment,
    )
    if created_at is not None:
        row.created_at = created_at
    db_session.add(row)
    db_session.commit()
    return row


def restaurant_reviews(client, restaurant_id: int = DOSA_DASH, **params):
    return client.get(f"/restaurants/{restaurant_id}/reviews", params=params)


def dish_reviews(client, menu_item_id: int, **params):
    return client.get(f"/menu-items/{menu_item_id}/reviews", params=params)


def dish_ids(db_session, order_id: int) -> list[int]:
    return list(
        db_session.scalars(
            select(OrderItem.menu_item_id)
            .where(OrderItem.order_id == order_id)
            .order_by(OrderItem.id)
        )
    )


def test_restaurant_without_reviews_returns_empty_page(seeded):
    response = restaurant_reviews(seeded)

    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0, "page": 1, "page_size": 10}


def test_dish_without_reviews_returns_empty_page(seeded):
    response = dish_reviews(seeded, 1)

    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0, "page": 1, "page_size": 10}


def test_response_shape_for_restaurant_and_dish(seeded, db_session):
    row = add_review(seeded, db_session, rating=4, comment="Tasty")
    dish = dish_ids(db_session, row.order_id)[0]

    for response in (restaurant_reviews(seeded), dish_reviews(seeded, dish)):
        body = response.json()
        assert response.status_code == 200
        assert set(body) == PAGE_KEYS
        assert body["total"] == 1
        item = body["items"][0]
        assert set(item) == ITEM_KEYS
        assert item["rating"] == 4
        assert item["comment"] == "Tasty"
        assert item["reviewer"] == "Maya P."
        assert item["created_at"]


def test_dishes_are_snapshot_names_in_item_order(seeded, db_session):
    row = add_review(seeded, db_session, lines=3)
    expected = list(
        db_session.scalars(
            select(OrderItem.name).where(OrderItem.order_id == row.order_id).order_by(OrderItem.id)
        )
    )

    item = restaurant_reviews(seeded).json()["items"][0]

    assert len(expected) == 3
    assert item["dishes"] == expected


def test_blank_comment_is_null(seeded, db_session):
    order_id = place(seeded, db_session)
    stamp(db_session, order_id, status=OrderStatus.DELIVERED)
    posted = seeded.post(
        f"/orders/{order_id}/review",
        json={"rating": 3, "comment": "   "},
        headers=auth(db_session, "maya"),
    )

    item = restaurant_reviews(seeded).json()["items"][0]

    assert posted.status_code == 201
    assert item["comment"] is None


def test_review_appears_right_after_the_customer_posts_it(seeded, db_session):
    order_id = place(seeded, db_session, owner="owner3")
    stamp(db_session, order_id, status=OrderStatus.DELIVERED)
    before = restaurant_reviews(seeded, BURGER_BARN).json()["total"]

    posted = seeded.post(
        f"/orders/{order_id}/review",
        json={"rating": 2, "comment": "Cold fries"},
        headers=auth(db_session, "maya"),
    )
    body = restaurant_reviews(seeded, BURGER_BARN).json()

    assert posted.status_code == 201
    assert before == 0
    assert body["total"] == 1
    assert (body["items"][0]["rating"], body["items"][0]["comment"]) == (2, "Cold fries")


@pytest.mark.parametrize(
    ("params", "expected_totals", "expected_len"),
    [
        ({}, 25, 10),
        ({"page": 2}, 25, 10),
        ({"page": 3}, 25, 5),
        ({"page": 4}, 25, 0),
        ({"page": 99}, 25, 0),
        ({"page_size": 1}, 25, 1),
        ({"page_size": 1, "page": 25}, 25, 1),
        ({"page_size": 1, "page": 26}, 25, 0),
        ({"page_size": 50}, 25, 25),
    ],
)
def test_pagination_slices_and_keeps_total(
    seeded, db_session, params, expected_totals, expected_len
):
    for n in range(25):
        add_review(seeded, db_session, created_at=T0 + timedelta(minutes=n))

    body = restaurant_reviews(seeded, **params).json()

    assert body["total"] == expected_totals
    assert len(body["items"]) == expected_len
    assert body["page"] == params.get("page", 1)
    assert body["page_size"] == params.get("page_size", 10)


def test_pages_do_not_overlap_and_cover_everything(seeded, db_session):
    for n in range(5):
        add_review(seeded, db_session, comment=f"c{n}", created_at=T0 + timedelta(minutes=n))

    seen = []
    for page in (1, 2, 3):
        seen += [
            i["comment"] for i in restaurant_reviews(seeded, page=page, page_size=2).json()["items"]
        ]

    assert seen == ["c4", "c3", "c2", "c1", "c0"]


def test_newest_first_regardless_of_insert_order(seeded, db_session):
    add_review(seeded, db_session, comment="middle", created_at=T0 + timedelta(hours=1))
    add_review(seeded, db_session, comment="newest", created_at=T0 + timedelta(hours=2))
    add_review(seeded, db_session, comment="oldest", created_at=T0)

    comments = [i["comment"] for i in restaurant_reviews(seeded).json()["items"]]

    assert comments == ["newest", "middle", "oldest"]


def test_equal_timestamps_break_ties_by_id_descending(seeded, db_session):
    for n in range(4):
        add_review(seeded, db_session, comment=f"tie{n}", created_at=T0)

    comments = [i["comment"] for i in restaurant_reviews(seeded).json()["items"]]
    paged = [
        restaurant_reviews(seeded, page=p, page_size=2).json()["items"][k]["comment"]
        for p in (1, 2)
        for k in (0, 1)
    ]

    assert comments == ["tie3", "tie2", "tie1", "tie0"]
    assert paged == comments


@pytest.mark.parametrize("stars", [1, 2, 3, 4, 5])
def test_rating_filter_returns_only_matching_stars(seeded, db_session, stars):
    for rating in (1, 2, 3, 4, 5, 5, 3):
        add_review(seeded, db_session, rating=rating)

    body = restaurant_reviews(seeded, rating=stars).json()

    assert body["total"] == [1, 1, 2, 1, 2][stars - 1]
    assert {i["rating"] for i in body["items"]} == {stars}


def test_rating_filter_with_no_match_is_empty(seeded, db_session):
    add_review(seeded, db_session, rating=5)

    body = restaurant_reviews(seeded, rating=1).json()

    assert body["items"] == [] and body["total"] == 0


def test_rating_filter_combines_with_pagination(seeded, db_session):
    for n in range(7):
        add_review(
            seeded,
            db_session,
            rating=4 if n % 2 == 0 else 2,
            comment=f"c{n}",
            created_at=T0 + timedelta(minutes=n),
        )

    first = restaurant_reviews(seeded, rating=4, page_size=3).json()
    second = restaurant_reviews(seeded, rating=4, page_size=3, page=2).json()

    assert first["total"] == second["total"] == 4
    assert [i["comment"] for i in first["items"]] == ["c6", "c4", "c2"]
    assert [i["comment"] for i in second["items"]] == ["c0"]


def test_rating_filter_applies_to_dish_reviews(seeded, db_session):
    good = add_review(seeded, db_session, rating=5)
    add_review(seeded, db_session, rating=1)
    dish = dish_ids(db_session, good.order_id)[0]

    body = dish_reviews(seeded, dish, rating=5).json()

    assert body["total"] == 1
    assert body["items"][0]["rating"] == 5


@pytest.mark.parametrize(
    "params",
    [
        {"rating": 0},
        {"rating": 6},
        {"rating": -1},
        {"rating": "abc"},
        {"page": 0},
        {"page": "x"},
        {"page_size": 0},
        {"page_size": 51},
        {"page_size": "x"},
    ],
)
@pytest.mark.parametrize("path", ["/restaurants/1/reviews", "/menu-items/1/reviews"])
def test_invalid_query_values_are_422(seeded, path, params):
    assert seeded.get(path, params=params).status_code == 422


def test_unknown_restaurant_is_404(seeded):
    response = restaurant_reviews(seeded, 9999)

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "restaurant_not_found"


def test_unknown_dish_is_404(seeded):
    response = dish_reviews(seeded, 9999)

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "menu_item_not_found"


def test_restaurant_reviews_never_leak_across_restaurants(seeded, db_session):
    add_review(seeded, db_session, owner="owner1", comment="dosa")
    add_review(seeded, db_session, owner="owner3", comment="burger")
    add_review(seeded, db_session, owner="owner3", comment="burger2")

    dosa = restaurant_reviews(seeded, DOSA_DASH).json()
    burger = restaurant_reviews(seeded, BURGER_BARN).json()

    assert [i["comment"] for i in dosa["items"]] == ["dosa"]
    assert sorted(i["comment"] for i in burger["items"]) == ["burger", "burger2"]
    assert dosa["total"] == 1 and burger["total"] == 2


def test_dish_reviews_include_only_orders_containing_the_dish(seeded, db_session):
    two_dishes = add_review(seeded, db_session, lines=2, comment="both")
    one_dish = add_review(seeded, db_session, lines=1, comment="first only")
    first, second = dish_ids(db_session, two_dishes.order_id)
    assert dish_ids(db_session, one_dish.order_id) == [first]

    under_first = dish_reviews(seeded, first).json()
    under_second = dish_reviews(seeded, second).json()

    assert sorted(i["comment"] for i in under_first["items"]) == ["both", "first only"]
    assert [i["comment"] for i in under_second["items"]] == ["both"]
    assert under_second["total"] == 1


def test_dish_reviews_from_other_restaurant_do_not_show(seeded, db_session):
    other = add_review(seeded, db_session, owner="owner3")
    own = add_review(seeded, db_session, owner="owner1")
    other_dish = dish_ids(db_session, other.order_id)[0]
    own_dish = dish_ids(db_session, own.order_id)[0]

    assert dish_reviews(seeded, own_dish).json()["total"] == 1
    assert dish_reviews(seeded, other_dish).json()["total"] == 1
    assert own_dish != other_dish


def test_dish_reviews_paginate(seeded, db_session):
    for n in range(3):
        row = add_review(seeded, db_session, comment=f"c{n}", created_at=T0 + timedelta(minutes=n))
    dish = dish_ids(db_session, row.order_id)[0]

    body = dish_reviews(seeded, dish, page_size=2, page=2).json()

    assert body["total"] == 3
    assert [i["comment"] for i in body["items"]] == ["c0"]


def test_unavailable_dish_still_shows_in_reviews_and_dish_route(seeded, db_session):
    row = add_review(seeded, db_session, lines=1)
    dish_id = dish_ids(db_session, row.order_id)[0]
    dish = db_session.get(MenuItem, dish_id)
    dish.is_available = False
    db_session.commit()

    from_restaurant = restaurant_reviews(seeded).json()["items"][0]
    from_dish = dish_reviews(seeded, dish_id).json()

    assert from_restaurant["dishes"] == [dish.name]
    assert from_dish["total"] == 1


def test_renamed_dish_keeps_snapshot_name(seeded, db_session):
    row = add_review(seeded, db_session, lines=1)
    dish_id = dish_ids(db_session, row.order_id)[0]
    dish = db_session.get(MenuItem, dish_id)
    original = dish.name
    dish.name = "Totally Renamed Special"
    db_session.commit()

    item = dish_reviews(seeded, dish_id).json()["items"][0]

    assert item["dishes"] == [original]
    assert "Totally Renamed Special" not in str(item)


def test_routes_need_no_token(seeded, db_session):
    row = add_review(seeded, db_session)
    dish = dish_ids(db_session, row.order_id)[0]

    assert restaurant_reviews(seeded).status_code == 200
    assert dish_reviews(seeded, dish).status_code == 200


def test_valid_token_gives_the_same_answer(seeded, db_session):
    row = add_review(seeded, db_session)
    dish = dish_ids(db_session, row.order_id)[0]
    headers = auth(db_session, "sam")

    anonymous = restaurant_reviews(seeded).json()
    with_token = seeded.get(f"/restaurants/{DOSA_DASH}/reviews", headers=headers)
    dish_with_token = seeded.get(f"/menu-items/{dish}/reviews", headers=headers)

    assert with_token.status_code == 200 and dish_with_token.status_code == 200
    assert with_token.json() == anonymous


def test_invalid_token_is_ignored_on_public_routes(seeded, db_session):
    add_review(seeded, db_session)
    headers = {"Authorization": "Bearer not-a-real-token"}

    response = seeded.get(f"/restaurants/{DOSA_DASH}/reviews", headers=headers)

    assert response.status_code == 200
    assert response.json()["total"] == 1
