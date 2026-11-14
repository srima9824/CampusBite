import pytest
from sqlalchemy import select

from app import seed
from app.models import MenuItem

PASSWORD = "seed-pass-1234"


@pytest.fixture
def seeded_client(client, db_session):
    seed.seed_users(db_session, PASSWORD)
    seed.seed_restaurants(db_session)
    return client


def menu(client, restaurant_id=1, **params):
    return client.get(f"/restaurants/{restaurant_id}/menu", params=params)


def test_menu_lists_only_that_restaurants_dishes(seeded_client, db_session):
    expected = set(db_session.scalars(select(MenuItem.id).where(MenuItem.restaurant_id == 1)))

    body = menu(seeded_client).json()

    assert {item["id"] for item in body["items"]} == expected
    assert {item["restaurant_id"] for item in body["items"]} == {1}
    assert body["total"] == len(expected)


def test_menu_item_has_exact_fields(seeded_client):
    item = menu(seeded_client).json()["items"][0]

    assert set(item) == {
        "id", "restaurant_id", "name", "description", "category",
        "price", "is_veg", "is_available",
    }  # fmt: skip


def test_menu_includes_unavailable_dishes_flagged_false(seeded_client, db_session):
    unavailable_ids = set(
        db_session.scalars(select(MenuItem.id).where(MenuItem.is_available.is_(False)))
    )
    returned = {}
    for restaurant_id in (1, 2, 3, 4):
        for item in menu(seeded_client, restaurant_id).json()["items"]:
            returned[item["id"]] = item["is_available"]

    assert unavailable_ids
    assert all(returned[i] is False for i in unavailable_ids)


def test_menu_search_matches_dish_name_case_insensitively(seeded_client):
    all_items = menu(seeded_client).json()["items"]
    term = all_items[0]["name"].split()[0].upper()

    items = menu(seeded_client, q=term).json()["items"]

    assert all_items[0]["id"] in {i["id"] for i in items}
    assert all(term.lower() in i["name"].lower() for i in items)


@pytest.mark.parametrize("q", ["%", "_", "zzz-unknown"])
def test_menu_search_wildcards_and_unknown_match_nothing(seeded_client, q):
    body = menu(seeded_client, q=q).json()

    assert body["items"] == []
    assert body["total"] == 0


def test_price_bounds_are_inclusive(seeded_client):
    prices = sorted({i["price"] for i in menu(seeded_client).json()["items"]})
    low, high = prices[1], prices[-2]

    items = menu(seeded_client, min_price=low, max_price=high).json()["items"]

    got = {i["price"] for i in items}
    assert low in got
    assert high in got
    assert all(low <= p <= high for p in got)


def test_only_min_price(seeded_client):
    prices = sorted({i["price"] for i in menu(seeded_client).json()["items"]})

    items = menu(seeded_client, min_price=prices[-1]).json()["items"]

    assert items
    assert {i["price"] for i in items} == {prices[-1]}


def test_only_max_price(seeded_client):
    prices = sorted({i["price"] for i in menu(seeded_client).json()["items"]})

    items = menu(seeded_client, max_price=prices[0]).json()["items"]

    assert items
    assert {i["price"] for i in items} == {prices[0]}


def test_min_above_max_is_422_invalid_price_range(seeded_client):
    response = menu(seeded_client, min_price=200, max_price=100)

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "invalid_price_range"


def test_invalid_price_range_is_reported_before_unknown_restaurant(seeded_client):
    response = menu(seeded_client, 999, min_price=200, max_price=100)

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "invalid_price_range"


@pytest.mark.parametrize("params", [{"min_price": -1}, {"max_price": -5}, {"min_price": "abc"},
                                    {"max_price": "1.5"}])  # fmt: skip
def test_negative_or_non_integer_price_is_422(seeded_client, params):
    assert menu(seeded_client, **params).status_code == 422


@pytest.mark.parametrize(("veg", "expected"), [("veg", True), ("non_veg", False)])
def test_veg_filter(seeded_client, veg, expected):
    items = menu(seeded_client, veg=veg).json()["items"]

    assert items
    assert {i["is_veg"] for i in items} == {expected}


def test_veg_and_non_veg_partition_the_menu(seeded_client):
    total = menu(seeded_client).json()["total"]

    veg = menu(seeded_client, veg="veg").json()["total"]
    non_veg = menu(seeded_client, veg="non_veg").json()["total"]

    assert veg + non_veg == total


@pytest.mark.parametrize("veg", ["vegan", "true", "", "VEG"])
def test_invalid_veg_value_is_422(seeded_client, veg):
    assert menu(seeded_client, veg=veg).status_code == 422


def test_combined_filters_all_apply(seeded_client):
    all_items = menu(seeded_client).json()["items"]
    veg_prices = sorted(i["price"] for i in all_items if i["is_veg"])
    cap = veg_prices[len(veg_prices) // 2]

    items = menu(seeded_client, veg="veg", max_price=cap, min_price=veg_prices[0]).json()["items"]

    assert items
    assert all(i["is_veg"] and veg_prices[0] <= i["price"] <= cap for i in items)
    expected = [i for i in all_items if i["is_veg"] and veg_prices[0] <= i["price"] <= cap]
    assert [i["id"] for i in items] == [i["id"] for i in expected]


def test_pagination_totals_and_pages(seeded_client):
    first = menu(seeded_client, page_size=3).json()
    last = menu(seeded_client, page_size=3, page=100).json()
    second = menu(seeded_client, page_size=3, page=2).json()

    assert first["total"] == second["total"] == last["total"]
    assert len(first["items"]) == 3
    assert not {i["id"] for i in first["items"]} & {i["id"] for i in second["items"]}
    assert last["items"] == []
    assert (first["page"], first["page_size"]) == (1, 3)


def test_menu_default_page_size_is_fifty(seeded_client):
    assert menu(seeded_client).json()["page_size"] == 50


@pytest.mark.parametrize("params", [{"page_size": 51}, {"page_size": 0}, {"page": 0}])
def test_menu_rejects_invalid_pagination(seeded_client, params):
    assert menu(seeded_client, **params).status_code == 422


def test_unknown_restaurant_menu_is_404(seeded_client):
    response = menu(seeded_client, 999)

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "restaurant_not_found"
