import pytest
from sqlalchemy import func, select

from app import seed
from app.models import Order, OrderStatus, Review
from tests.test_delivery_orders_api import move, user_id
from tests.test_owner_assign_api import assign
from tests.test_owner_orders_api import advance, auth, place, stamp

PASSWORD = "seed-pass-1234"
NOT_DELIVERED = "You can review an order once it has been delivered."
ALREADY_REVIEWED = "You have already reviewed this order."
REVIEW_KEYS = {"rating", "comment", "created_at"}
NOT_REVIEWABLE = [
    OrderStatus.PLACED,
    OrderStatus.ACCEPTED,
    OrderStatus.PREPARING,
    OrderStatus.READY,
    OrderStatus.ASSIGNED,
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.CANCELLED,
    OrderStatus.REFUNDED,
]


@pytest.fixture
def seeded(client, db_session):
    seed.seed_users(db_session, PASSWORD)
    seed.seed_restaurants(db_session)
    return client


def delivered(client, db_session, **kwargs) -> int:
    order_id = place(client, db_session, **kwargs)
    stamp(db_session, order_id, status=OrderStatus.DELIVERED)
    return order_id


def review(client, db_session, order_id, body, who: str = "maya"):
    return client.post(f"/orders/{order_id}/review", json=body, headers=auth(db_session, who))


def rows(db_session) -> list[Review]:
    db_session.expire_all()
    return list(db_session.scalars(select(Review).order_by(Review.id)))


def test_review_with_comment_returns_201_and_the_review(seeded, db_session):
    order_id = delivered(seeded, db_session)

    response = review(seeded, db_session, order_id, {"rating": 5, "comment": "Great food"})

    body = response.json()
    assert response.status_code == 201
    assert set(body) == REVIEW_KEYS
    assert body["rating"] == 5
    assert body["comment"] == "Great food"
    assert body["created_at"]


def test_review_without_comment_has_null_comment(seeded, db_session):
    order_id = delivered(seeded, db_session)

    response = review(seeded, db_session, order_id, {"rating": 3})

    assert response.status_code == 201
    assert response.json()["comment"] is None
    assert rows(db_session)[0].comment is None


def test_review_row_takes_restaurant_and_customer_from_the_order(seeded, db_session):
    order_id = delivered(seeded, db_session, owner="owner3")

    review(seeded, db_session, order_id, {"rating": 4})

    order = db_session.get(Order, order_id)
    (row,) = rows(db_session)
    assert row.order_id == order_id
    assert row.restaurant_id == order.restaurant_id
    assert row.customer_id == user_id(db_session, "maya")
    assert row.rating == 4


def test_review_after_the_full_delivery_flow(seeded, db_session):
    order_id = place(seeded, db_session)
    for status in ("ACCEPTED", "PREPARING", "READY"):
        assert advance(seeded, db_session, order_id, status).status_code == 200
    assert assign(seeded, db_session, order_id, user_id(db_session, "sam")).status_code == 200
    for status in ("OUT_FOR_DELIVERY", "DELIVERED"):
        assert move(seeded, db_session, order_id, status).status_code == 200

    response = review(seeded, db_session, order_id, {"rating": 5, "comment": "On time"})

    assert response.status_code == 201


@pytest.mark.parametrize("status", NOT_REVIEWABLE)
def test_undelivered_order_is_409_and_creates_no_row(seeded, db_session, status):
    order_id = place(seeded, db_session)
    stamp(db_session, order_id, status=status)

    response = review(seeded, db_session, order_id, {"rating": 5})

    assert response.status_code == 409
    assert response.json()["detail"] == {"code": "review_not_allowed", "message": NOT_DELIVERED}
    assert rows(db_session) == []


def test_second_review_is_409_and_first_is_unchanged(seeded, db_session):
    order_id = delivered(seeded, db_session)
    review(seeded, db_session, order_id, {"rating": 5, "comment": "First"})

    response = review(seeded, db_session, order_id, {"rating": 1, "comment": "Second"})

    assert response.status_code == 409
    assert response.json()["detail"] == {"code": "review_exists", "message": ALREADY_REVIEWED}
    (row,) = rows(db_session)
    assert (row.rating, row.comment) == (5, "First")


def test_reviewing_one_order_does_not_block_another(seeded, db_session):
    first = delivered(seeded, db_session)
    second = delivered(seeded, db_session)

    assert review(seeded, db_session, first, {"rating": 5}).status_code == 201
    assert review(seeded, db_session, second, {"rating": 2}).status_code == 201
    assert len(rows(db_session)) == 2


@pytest.mark.parametrize("order_id", [999, 0, -1])
def test_unknown_order_is_404(seeded, db_session, order_id):
    response = review(seeded, db_session, order_id, {"rating": 5})

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "order_not_found"


def test_another_customers_order_is_404_and_gets_no_review(seeded, db_session):
    order_id = delivered(seeded, db_session, who="maya")

    response = review(seeded, db_session, order_id, {"rating": 5}, who="leo")

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "order_not_found"
    assert rows(db_session) == []


def test_non_integer_order_id_is_422(seeded, db_session):
    assert review(seeded, db_session, "abc", {"rating": 5}).status_code == 422


@pytest.mark.parametrize("rating", [1, 2, 3, 4, 5])
def test_every_rating_from_1_to_5_is_accepted(seeded, db_session, rating):
    order_id = delivered(seeded, db_session)

    response = review(seeded, db_session, order_id, {"rating": rating})

    assert response.status_code == 201
    assert response.json()["rating"] == rating


@pytest.mark.parametrize(
    "body",
    [
        {"rating": 0},
        {"rating": 6},
        {"rating": -1},
        {"rating": 2.5},
        {"rating": None},
        {"rating": "five"},
        {"rating": [5]},
        {"comment": "no rating"},
        {},
    ],
    ids=["zero", "six", "negative", "fraction", "null", "word", "list", "missing", "empty"],
)
def test_invalid_rating_is_422_and_creates_no_row(seeded, db_session, body):
    order_id = delivered(seeded, db_session)

    response = review(seeded, db_session, order_id, body)

    assert response.status_code == 422
    assert rows(db_session) == []


@pytest.mark.parametrize("rating", ["5", "five", 5.0, True])
def test_rating_must_be_a_whole_number_not_text_or_float(seeded, db_session, rating):
    order_id = delivered(seeded, db_session)

    response = review(seeded, db_session, order_id, {"rating": rating})

    assert response.status_code == 422
    assert rows(db_session) == []


def test_comment_of_500_characters_is_accepted_and_501_is_not(seeded, db_session):
    ok = delivered(seeded, db_session)
    too_long = delivered(seeded, db_session)

    accepted = review(seeded, db_session, ok, {"rating": 5, "comment": "x" * 500})
    rejected = review(seeded, db_session, too_long, {"rating": 5, "comment": "x" * 501})

    assert accepted.status_code == 201
    assert len(accepted.json()["comment"]) == 500
    assert rejected.status_code == 422
    assert len(rows(db_session)) == 1


@pytest.mark.parametrize("comment", ["", " ", "   \n\t ", None])
def test_blank_comment_is_stored_as_null(seeded, db_session, comment):
    order_id = delivered(seeded, db_session)

    response = review(seeded, db_session, order_id, {"rating": 4, "comment": comment})

    assert response.status_code == 201
    assert response.json()["comment"] is None
    assert rows(db_session)[0].comment is None


def test_comment_is_trimmed(seeded, db_session):
    order_id = delivered(seeded, db_session)

    response = review(seeded, db_session, order_id, {"rating": 4, "comment": "  tasty  "})

    assert response.json()["comment"] == "tasty"


def test_non_string_comment_is_422(seeded, db_session):
    order_id = delivered(seeded, db_session)

    assert review(seeded, db_session, order_id, {"rating": 4, "comment": 12}).status_code == 422


@pytest.mark.parametrize("field", ["order_id", "customer_id", "restaurant_id", "created_at"])
def test_extra_fields_are_rejected(seeded, db_session, field):
    order_id = delivered(seeded, db_session)

    response = review(seeded, db_session, order_id, {"rating": 5, field: 1})

    assert response.status_code == 422
    assert rows(db_session) == []


def test_validation_failure_does_not_consume_the_one_review(seeded, db_session):
    order_id = delivered(seeded, db_session)
    review(seeded, db_session, order_id, {"rating": 9})

    assert review(seeded, db_session, order_id, {"rating": 5}).status_code == 201


def order_views(client, db_session, order_id):
    detail = client.get(f"/orders/{order_id}", headers=auth(db_session, "maya")).json()
    listed = client.get("/orders", headers=auth(db_session, "maya")).json()["items"]
    in_list = next(o for o in listed if o["id"] == order_id)
    return detail, in_list


def test_customer_order_views_show_review_null_then_the_review(seeded, db_session):
    order_id = delivered(seeded, db_session)

    before = order_views(seeded, db_session, order_id)
    review(seeded, db_session, order_id, {"rating": 4, "comment": "Good"})
    after = order_views(seeded, db_session, order_id)

    assert [v["review"] for v in before] == [None, None]
    for view in after:
        assert set(view["review"]) == REVIEW_KEYS
        assert view["review"]["rating"] == 4
        assert view["review"]["comment"] == "Good"


def test_undelivered_order_shows_review_null(seeded, db_session):
    order_id = place(seeded, db_session)

    detail, in_list = order_views(seeded, db_session, order_id)

    assert detail["review"] is None
    assert in_list["review"] is None


def test_place_and_cancel_responses_carry_review_null(seeded, db_session):
    placed = seeded.post(
        "/orders",
        json={"items": [{"menu_item_id": 1, "quantity": 1}], "delivery_address": "Hostel 4"},
        headers=auth(db_session, "maya"),
    )
    cancelled = seeded.post(
        f"/orders/{placed.json()['id']}/cancel", headers=auth(db_session, "maya")
    )

    assert placed.json()["review"] is None
    assert cancelled.json()["review"] is None


def test_review_is_only_visible_on_the_reviewers_own_orders(seeded, db_session):
    mine = delivered(seeded, db_session, who="maya")
    theirs = delivered(seeded, db_session, who="leo")
    review(seeded, db_session, mine, {"rating": 5})

    leo_list = seeded.get("/orders", headers=auth(db_session, "leo")).json()["items"]

    assert [(o["id"], o["review"]) for o in leo_list] == [(theirs, None)]


def test_owner_and_delivery_views_have_no_review_field(seeded, db_session):
    order_id = delivered(seeded, db_session)
    order = db_session.get(Order, order_id)
    order.delivery_partner_id = user_id(db_session, "sam")
    db_session.commit()
    review(seeded, db_session, order_id, {"rating": 5, "comment": "Nice"})

    owner_list = seeded.get("/owner/orders", headers=auth(db_session, "owner1"))
    owner_one = seeded.get(f"/owner/orders/{order_id}", headers=auth(db_session, "owner1"))
    partner_list = seeded.get("/delivery/orders", headers=auth(db_session, "sam"))
    partner_one = seeded.get(f"/delivery/orders/{order_id}", headers=auth(db_session, "sam"))

    for response in (owner_list, owner_one, partner_list, partner_one):
        assert response.status_code == 200
        assert "review" not in response.text
        assert "Nice" not in response.text


@pytest.mark.parametrize("method", ["put", "patch", "delete"])
@pytest.mark.parametrize("path", ["/orders/{id}/review", "/orders/{id}/review/1", "/reviews/1"])
def test_reviews_cannot_be_edited_or_deleted(seeded, db_session, method, path):
    order_id = delivered(seeded, db_session)
    review(seeded, db_session, order_id, {"rating": 5, "comment": "Keep"})

    response = seeded.request(
        method.upper(),
        path.format(id=order_id),
        json={"rating": 1},
        headers=auth(db_session, "maya"),
    )

    assert response.status_code in (404, 405)
    (row,) = rows(db_session)
    assert (row.rating, row.comment) == (5, "Keep")


def test_get_on_the_review_route_is_not_allowed(seeded, db_session):
    order_id = delivered(seeded, db_session)

    response = seeded.get(f"/orders/{order_id}/review", headers=auth(db_session, "maya"))

    assert response.status_code == 405


def test_only_one_review_row_per_order_in_the_database(seeded, db_session):
    order_id = delivered(seeded, db_session)
    review(seeded, db_session, order_id, {"rating": 5})
    review(seeded, db_session, order_id, {"rating": 2})

    count = db_session.scalar(select(func.count()).where(Review.order_id == order_id))

    assert count == 1
