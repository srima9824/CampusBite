import json

import pytest

from app import seed
from app.models import Order, OrderItem, OrderStatus, Review, User
from tests.test_owner_orders_api import auth, place, stamp

PASSWORD = "seed-pass-1234"
ITEM_KEYS = {"rating", "comment", "created_at", "reviewer", "dishes"}
PAGE_KEYS = {"items", "total", "page", "page_size"}
SECRET_EMAIL = "zelda.quillfeather@secret-mail.example"
SECRET_SURNAME = "Quillfeather"
SECRET_ADDRESS = "Hostel 77 Zenith Tower Room 4242"
SECRET_NOTES = "ring the brass doorbell twice"


@pytest.fixture
def reviewed(client, db_session):
    seed.seed_users(db_session, PASSWORD)
    seed.seed_restaurants(db_session)
    customer = db_session.query(User).filter_by(email="maya@masaischool.ac.in").one()
    headers = auth(db_session, "maya")
    order_id = place(
        client,
        db_session,
        lines=2,
        delivery_address=SECRET_ADDRESS,
        notes=SECRET_NOTES,
    )
    stamp(db_session, order_id, status=OrderStatus.DELIVERED)
    posted = client.post(
        f"/orders/{order_id}/review",
        json={"rating": 5, "comment": "Lovely"},
        headers=headers,
    )
    assert posted.status_code == 201
    customer.name = f"Zelda {SECRET_SURNAME}"
    customer.email = SECRET_EMAIL
    db_session.commit()
    order = db_session.get(Order, order_id)
    return {
        "client": client,
        "dish": db_session.query(OrderItem).filter_by(order_id=order_id).first().menu_item_id,
        "order": order,
        "customer": customer,
    }


def paths(ctx) -> list[str]:
    return [
        f"/restaurants/{ctx['order'].restaurant_id}/reviews",
        f"/menu-items/{ctx['dish']}/reviews",
    ]


def test_each_item_has_exactly_the_public_keys(reviewed):
    for path in paths(reviewed):
        body = reviewed["client"].get(path).json()

        assert set(body) == PAGE_KEYS
        assert body["total"] == 1
        assert set(body["items"][0]) == ITEM_KEYS


def test_reviewer_is_first_name_and_last_initial(reviewed):
    for path in paths(reviewed):
        assert reviewed["client"].get(path).json()["items"][0]["reviewer"] == "Zelda Q."


def test_no_private_text_in_the_serialized_response(reviewed):
    secrets = [SECRET_EMAIL, SECRET_SURNAME, SECRET_ADDRESS, SECRET_NOTES, "secret-mail"]
    for path in paths(reviewed):
        response = reviewed["client"].get(path)

        text = response.text + json.dumps(response.json())
        for secret in secrets:
            assert secret not in text


def test_no_ids_or_prices_in_the_serialized_response(reviewed):
    order = reviewed["order"]
    for path in paths(reviewed):
        item = reviewed["client"].get(path).json()["items"][0]

        assert not {"id", "order_id", "customer_id", "restaurant_id", "email", "total"} & set(item)
        assert "total" not in item and "price" not in json.dumps(item).lower()
        assert str(order.total) not in {str(v) for v in item.values()}


def test_privacy_holds_with_a_token_too(reviewed, db_session):
    headers = auth(db_session, "sam")
    for path in paths(reviewed):
        response = reviewed["client"].get(path, headers=headers)

        assert set(response.json()["items"][0]) == ITEM_KEYS
        assert SECRET_EMAIL not in response.text
        assert SECRET_ADDRESS not in response.text


def test_stored_review_is_unchanged_by_reading(reviewed, db_session):
    for path in paths(reviewed):
        reviewed["client"].get(path)

    db_session.expire_all()
    assert db_session.query(Review).count() == 1
