import pytest
from sqlalchemy import event, select

from app import seed
from app.models import MenuItem, Restaurant, User
from app.security import create_access_token

PASSWORD = "seed-pass-1234"
DISH = {
    "name": "Ghee Roast",
    "description": "Crisp",
    "category": "Dosa",
    "price": 120,
    "is_veg": True,
}


@pytest.fixture
def seeded(client, db_session):
    seed.seed_users(db_session, PASSWORD)
    seed.seed_restaurants(db_session)
    return client


def auth(db_session, local_part: str) -> dict:
    user = db_session.scalar(select(User).where(User.email == f"{local_part}@masaischool.ac.in"))
    return {"Authorization": f"Bearer {create_access_token(user)}"}


def restaurant_of(db_session, local_part: str) -> Restaurant:
    return db_session.scalar(
        select(Restaurant)
        .join(User, User.id == Restaurant.owner_id)
        .where(User.email == f"{local_part}@masaischool.ac.in")
    )


def add(client, db_session, body=None, owner="owner1"):
    return client.post("/owner/menu", json=body or DISH, headers=auth(db_session, owner))


def public_menu(client, restaurant_id: int) -> dict:
    items = client.get(f"/restaurants/{restaurant_id}/menu", params={"page_size": 50}).json()[
        "items"
    ]
    return {item["id"]: item for item in items}


def test_owner_adds_dish_to_own_restaurant_available_and_public(seeded, db_session):
    restaurant = restaurant_of(db_session, "owner1")

    response = add(seeded, db_session)

    assert response.status_code == 201
    body = response.json()
    assert body["restaurant_id"] == restaurant.id
    assert body["is_available"] is True
    assert body["name"] == "Ghee Roast"
    assert public_menu(seeded, restaurant.id)[body["id"]]["price"] == 120


def test_create_trims_name_and_defaults_description(seeded, db_session):
    body = {"name": "  Plain Dosa  ", "category": "Dosa", "price": 50, "is_veg": True}

    response = add(seeded, db_session, body)

    assert response.status_code == 201
    assert response.json()["name"] == "Plain Dosa"
    assert response.json()["description"] == ""


@pytest.mark.parametrize(
    "extra",
    [{"restaurant_id": 2}, {"is_available": False}, {"id": 99}, {"surprise": 1}],
)
def test_create_rejects_extra_fields(seeded, db_session, extra):
    response = add(seeded, db_session, {**DISH, **extra})

    assert response.status_code == 422
    assert db_session.scalar(select(MenuItem).where(MenuItem.name == DISH["name"])) is None


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("name", ""),
        ("name", "   "),
        ("name", "x" * 81),
        ("price", 0),
        ("price", -5),
        ("price", 100_001),
        ("price", "abc"),
        ("price", 10.5),
        ("category", ""),
        ("description", "d" * 301),
        ("is_veg", "maybe"),
    ],
)
def test_create_validation_errors(seeded, db_session, field, value):
    response = add(seeded, db_session, {**DISH, field: value})

    assert response.status_code == 422


@pytest.mark.parametrize("missing", ["name", "category", "price", "is_veg"])
def test_create_requires_fields(seeded, db_session, missing):
    body = {k: v for k, v in DISH.items() if k != missing}

    assert add(seeded, db_session, body).status_code == 422


def test_create_boundary_values_accepted(seeded, db_session):
    body = {**DISH, "name": "x" * 80, "price": 100_000, "description": "d" * 300}

    assert add(seeded, db_session, body).status_code == 201
    assert add(seeded, db_session, {**DISH, "price": 1}).status_code == 201


def test_duplicate_name_on_create_is_409(seeded, db_session):
    add(seeded, db_session)

    response = add(seeded, db_session)

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "dish_name_taken"
    count = db_session.scalars(select(MenuItem).where(MenuItem.name == "Ghee Roast")).all()
    assert len(count) == 1


def test_duplicate_name_on_rename_is_409_and_unchanged(seeded, db_session):
    first = add(seeded, db_session).json()
    second = add(seeded, db_session, {**DISH, "name": "Other"}).json()

    response = seeded.patch(
        f"/owner/menu/{second['id']}",
        json={"name": first["name"]},
        headers=auth(db_session, "owner1"),
    )

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "dish_name_taken"
    db_session.expire_all()
    assert db_session.get(MenuItem, second["id"]).name == "Other"


def test_rename_to_own_current_name_is_fine(seeded, db_session):
    dish = add(seeded, db_session).json()

    response = seeded.patch(
        f"/owner/menu/{dish['id']}", json={"name": dish["name"], "price": 130},
        headers=auth(db_session, "owner1"),
    )  # fmt: skip

    assert response.status_code == 200


def test_same_name_in_another_restaurant_is_allowed(seeded, db_session):
    assert add(seeded, db_session, owner="owner1").status_code == 201
    assert add(seeded, db_session, owner="owner3").status_code == 201


def test_partial_edit_changes_only_sent_fields(seeded, db_session):
    dish = add(seeded, db_session).json()

    response = seeded.patch(
        f"/owner/menu/{dish['id']}", json={"price": 150}, headers=auth(db_session, "owner1")
    )

    assert response.status_code == 200
    assert response.json() == {**dish, "price": 150}


def test_edit_is_reflected_in_public_menu(seeded, db_session):
    dish = add(seeded, db_session).json()

    seeded.patch(
        f"/owner/menu/{dish['id']}",
        json={"name": "Renamed", "price": 99, "is_veg": False, "category": "Special"},
        headers=auth(db_session, "owner1"),
    )

    shown = public_menu(seeded, dish["restaurant_id"])[dish["id"]]
    assert (shown["name"], shown["price"], shown["is_veg"], shown["category"]) == (
        "Renamed", 99, False, "Special",
    )  # fmt: skip


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"name": None},
        {"price": None},
        {"is_veg": None},
        {"description": None},
        {"price": 0},
        {"restaurant_id": 2},
        {"is_available": False},
    ],
)
def test_edit_rejects_invalid_bodies(seeded, db_session, body):
    dish = add(seeded, db_session).json()

    response = seeded.patch(
        f"/owner/menu/{dish['id']}", json=body, headers=auth(db_session, "owner1")
    )

    assert response.status_code == 422
    db_session.expire_all()
    assert db_session.get(MenuItem, dish["id"]).price == 120


def test_availability_toggle_reflected_in_owner_and_public_menu(seeded, db_session):
    dish = add(seeded, db_session).json()
    headers = auth(db_session, "owner1")
    path = f"/owner/menu/{dish['id']}/availability"

    off = seeded.patch(path, json={"is_available": False}, headers=headers)

    assert off.status_code == 200
    assert off.json()["is_available"] is False
    own = {i["id"]: i for i in seeded.get("/owner/menu", headers=headers).json()["items"]}
    assert own[dish["id"]]["is_available"] is False
    assert public_menu(seeded, dish["restaurant_id"])[dish["id"]]["is_available"] is False

    on = seeded.patch(path, json={"is_available": True}, headers=headers)

    assert on.json()["is_available"] is True
    assert public_menu(seeded, dish["restaurant_id"])[dish["id"]]["is_available"] is True


@pytest.mark.parametrize(
    "body", [{}, {"is_available": None}, {"is_available": "maybe"}, {"is_available": True, "x": 1}]
)
def test_availability_rejects_invalid_bodies(seeded, db_session, body):
    dish = add(seeded, db_session).json()

    response = seeded.patch(
        f"/owner/menu/{dish['id']}/availability", json=body, headers=auth(db_session, "owner1")
    )

    assert response.status_code == 422


def test_owner_list_has_only_own_dishes_including_unavailable(seeded, db_session):
    restaurant = restaurant_of(db_session, "owner1")
    expected = set(
        db_session.scalars(select(MenuItem.id).where(MenuItem.restaurant_id == restaurant.id))
    )
    unavailable = set(
        db_session.scalars(
            select(MenuItem.id).where(
                MenuItem.restaurant_id == restaurant.id, MenuItem.is_available.is_(False)
            )
        )
    )

    body = seeded.get("/owner/menu", headers=auth(db_session, "owner1")).json()

    assert {i["id"] for i in body["items"]} == expected
    assert unavailable and unavailable <= expected
    assert body["total"] == len(expected)


def test_owner_list_search_and_pagination(seeded, db_session):
    headers = auth(db_session, "owner1")
    for n in range(5):
        add(seeded, db_session, {**DISH, "name": f"Zesty Wrap {n}"})
    total = seeded.get("/owner/menu", headers=headers).json()["total"]

    found = seeded.get("/owner/menu", params={"q": "zesty"}, headers=headers).json()
    page2 = seeded.get("/owner/menu", params={"page": 2, "page_size": 2}, headers=headers).json()

    assert found["total"] == 5
    assert all("zesty" in i["name"].lower() for i in found["items"])
    assert page2["total"] == total
    assert len(page2["items"]) == 2
    assert (page2["page"], page2["page_size"]) == (2, 2)


@pytest.mark.parametrize(
    "params", [{"page_size": 51}, {"page_size": 0}, {"page": 0}, {"q": "x" * 81}]
)
def test_owner_list_rejects_bad_params(seeded, db_session, params):
    response = seeded.get("/owner/menu", params=params, headers=auth(db_session, "owner1"))

    assert response.status_code == 422


def test_owner_list_query_count_is_constant(seeded, db_session):
    headers = auth(db_session, "owner1")
    captured: list[str] = []
    engine = db_session.get_bind()

    def record(conn, cursor, statement, parameters, context, executemany):
        captured.append(statement)

    def count_statements() -> int:
        captured.clear()
        assert seeded.get("/owner/menu", headers=headers).status_code == 200
        return len(captured)

    event.listen(engine, "before_cursor_execute", record)
    try:
        few = count_statements()
        for n in range(30):
            db_session.add(
                MenuItem(
                    restaurant_id=restaurant_of(db_session, "owner1").id,
                    name=f"Bulk {n}", description="d", category="Bulk", price=10 + n, is_veg=True,
                )
            )  # fmt: skip
        db_session.commit()
        many = count_statements()
    finally:
        event.remove(engine, "before_cursor_execute", record)

    assert many == few
    assert many <= 5
