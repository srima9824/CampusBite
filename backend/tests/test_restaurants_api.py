import pytest

from app import seed

PASSWORD = "seed-pass-1234"

LIST_FIELDS = {"id", "name", "cuisine", "description", "logo_key", "image_key", "is_open"}


@pytest.fixture
def seeded_client(client, db_session):
    seed.seed_users(db_session, PASSWORD)
    seed.seed_restaurants(db_session)
    return client


def names(response) -> list[str]:
    return [item["name"] for item in response.json()["items"]]


def test_list_returns_four_restaurants_with_exact_fields(seeded_client):
    response = seeded_client.get("/restaurants")

    body = response.json()
    assert response.status_code == 200
    assert body["total"] == 4
    assert names(response) == ["Dosa Dash", "Burger Barn", "Taco Tuesday", "Chai & Chill"]
    for item in body["items"]:
        assert set(item) == LIST_FIELDS


def test_list_pagination_defaults(seeded_client):
    body = seeded_client.get("/restaurants").json()

    assert (body["page"], body["page_size"]) == (1, 12)


def test_list_pagination_first_and_second_page(seeded_client):
    first = seeded_client.get("/restaurants", params={"page_size": 3})
    second = seeded_client.get("/restaurants", params={"page_size": 3, "page": 2})

    assert names(first) == ["Dosa Dash", "Burger Barn", "Taco Tuesday"]
    assert names(second) == ["Chai & Chill"]
    assert first.json()["total"] == second.json()["total"] == 4
    assert second.json()["page"] == 2


def test_list_page_past_the_end_is_empty_with_total(seeded_client):
    body = seeded_client.get("/restaurants", params={"page": 9}).json()

    assert body["items"] == []
    assert body["total"] == 4


def test_list_accepts_page_size_cap(seeded_client):
    assert seeded_client.get("/restaurants", params={"page_size": 50}).status_code == 200


@pytest.mark.parametrize(
    "params", [{"page_size": 51}, {"page_size": 0}, {"page": 0}, {"page": -1}, {"page": "x"}]
)
def test_list_rejects_invalid_pagination(seeded_client, params):
    assert seeded_client.get("/restaurants", params=params).status_code == 422


@pytest.mark.parametrize(
    ("q", "expected"),
    [
        ("dosa", ["Dosa Dash"]),
        ("BURGER", ["Burger Barn"]),
        ("south indian", ["Dosa Dash"]),
        ("MEXICAN", ["Taco Tuesday"]),
        ("cafe", ["Chai & Chill"]),
        ("a", ["Dosa Dash", "Burger Barn", "Taco Tuesday", "Chai & Chill"]),
    ],
)
def test_search_matches_name_or_cuisine_case_insensitively(seeded_client, q, expected):
    response = seeded_client.get("/restaurants", params={"q": q})

    assert names(response) == expected
    assert response.json()["total"] == len(expected)


@pytest.mark.parametrize("q", ["%", "_", "\\", "zzz-unknown"])
def test_search_wildcards_and_unknown_terms_match_nothing(seeded_client, q):
    body = seeded_client.get("/restaurants", params={"q": q}).json()

    assert body["items"] == []
    assert body["total"] == 0


def test_search_term_over_max_length_is_rejected(seeded_client):
    assert seeded_client.get("/restaurants", params={"q": "x" * 81}).status_code == 422


def test_detail_returns_restaurant_without_owner_or_rating(seeded_client):
    response = seeded_client.get("/restaurants/1")

    body = response.json()
    assert response.status_code == 200
    assert set(body) == LIST_FIELDS
    assert body["name"] == "Dosa Dash"
    assert "owner_id" not in body
    assert "rating" not in body


def test_detail_unknown_restaurant_is_404_with_code(seeded_client):
    response = seeded_client.get("/restaurants/999")

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "restaurant_not_found"


def test_detail_non_integer_id_is_422(seeded_client):
    assert seeded_client.get("/restaurants/abc").status_code == 422


@pytest.mark.parametrize("path", ["/restaurants", "/restaurants/1", "/restaurants/1/menu"])
def test_endpoints_work_without_a_token(seeded_client, path):
    assert "authorization" not in {k.lower() for k in seeded_client.headers}
    assert seeded_client.get(path).status_code == 200
