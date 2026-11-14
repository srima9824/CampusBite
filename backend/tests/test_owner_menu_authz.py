import pytest
from sqlalchemy import select

from app import seed
from app.models import MenuItem, Restaurant, Role, User
from app.security import create_access_token, hash_password

# authz: access rules for the owner menu routes (authentication, role, ownership).

PASSWORD = "seed-pass-1234"
DISH = {
    "name": "Ghee Roast",
    "description": "Crisp",
    "category": "Dosa",
    "price": 120,
    "is_veg": True,
}

ROUTES = [
    ("GET", "/owner/menu", None),
    ("POST", "/owner/menu", DISH),
    ("PATCH", "/owner/menu/{id}", {"price": 99}),
    ("PATCH", "/owner/menu/{id}/availability", {"is_available": False}),
]


@pytest.fixture
def seeded(client, db_session):
    seed.seed_users(db_session, PASSWORD)
    seed.seed_restaurants(db_session)
    return client


def auth(db_session, local_part: str) -> dict:
    user = db_session.scalar(select(User).where(User.email == f"{local_part}@masaischool.ac.in"))
    return {"Authorization": f"Bearer {create_access_token(user)}"}


def first_dish_of(db_session, local_part: str) -> MenuItem:
    return db_session.scalar(
        select(MenuItem)
        .join(Restaurant, Restaurant.id == MenuItem.restaurant_id)
        .join(User, User.id == Restaurant.owner_id)
        .where(User.email == f"{local_part}@masaischool.ac.in")
        .order_by(MenuItem.id)
    )


def call(client, method, path, body, headers=None, item_id=1):
    return client.request(method, path.format(id=item_id), json=body, headers=headers or {})


@pytest.mark.parametrize(("method", "path", "body"), ROUTES)
def test_no_token_is_401(seeded, method, path, body):
    response = call(seeded, method, path, body)

    assert response.status_code == 401


@pytest.mark.parametrize("local_part", ["maya", "sam"])
@pytest.mark.parametrize(("method", "path", "body"), ROUTES)
def test_customer_and_delivery_partner_are_403(seeded, db_session, local_part, method, path, body):
    dish = first_dish_of(db_session, "owner1")

    response = call(seeded, method, path, body, auth(db_session, local_part), dish.id)

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "forbidden"
    db_session.expire_all()
    assert db_session.get(MenuItem, dish.id).price == dish.price


@pytest.mark.parametrize(
    ("path", "body"),
    [
        ("/owner/menu/{id}", {"price": 1}),
        ("/owner/menu/{id}/availability", {"is_available": False}),
    ],
)
def test_owner_cannot_change_another_owners_dish(seeded, db_session, path, body):
    other = first_dish_of(db_session, "owner3")
    before = (other.name, other.price, other.is_available)

    response = call(seeded, "PATCH", path, body, auth(db_session, "owner1"), other.id)

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "menu_item_not_found"
    db_session.expire_all()
    after = db_session.get(MenuItem, other.id)
    assert (after.name, after.price, after.is_available) == before


@pytest.mark.parametrize(
    ("path", "body"),
    [
        ("/owner/menu/{id}", {"price": 1}),
        ("/owner/menu/{id}/availability", {"is_available": False}),
    ],
)
def test_unknown_dish_is_404(seeded, db_session, path, body):
    response = call(seeded, "PATCH", path, body, auth(db_session, "owner1"), 99999)

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "menu_item_not_found"


@pytest.mark.parametrize(("method", "path", "body"), ROUTES)
def test_owner_without_restaurant_is_404(seeded, db_session, method, path, body):
    user = User(
        name="New Owner",
        email="newowner@masaischool.ac.in",
        password_hash=hash_password(PASSWORD),
        role=Role.RESTAURANT_OWNER,
    )
    db_session.add(user)
    db_session.commit()
    headers = {"Authorization": f"Bearer {create_access_token(user)}"}

    response = call(seeded, method, path, body, headers)

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "restaurant_not_found"


def test_restaurant_comes_from_token_not_request(seeded, db_session):
    other_restaurant = db_session.scalar(
        select(Restaurant)
        .join(User, User.id == Restaurant.owner_id)
        .where(User.email == "owner3@masaischool.ac.in")
    )

    by_query = seeded.get(
        "/owner/menu",
        params={"restaurant_id": other_restaurant.id},
        headers=auth(db_session, "owner1"),
    )
    by_body = seeded.post(
        "/owner/menu",
        json={**DISH, "restaurant_id": other_restaurant.id},
        headers=auth(db_session, "owner1"),
    )

    assert {i["restaurant_id"] for i in by_query.json()["items"]} != {other_restaurant.id}
    assert by_body.status_code == 422
    assert not db_session.scalars(
        select(MenuItem).where(
            MenuItem.restaurant_id == other_restaurant.id, MenuItem.name == DISH["name"]
        )
    ).all()
