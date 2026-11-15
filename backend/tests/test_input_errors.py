import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import DataError, IntegrityError, StatementError

from app.main import create_app
from app.pagination import MAX_PAGE

INVALID_INPUT = {"detail": {"code": "invalid_input", "message": "Some of the input is not valid."}}
SERVER_ERROR = {"detail": {"code": "server_error", "message": "Something went wrong."}}

PAGED_PUBLIC_ROUTES = [
    "/restaurants",
    "/restaurants/1/menu",
    "/restaurants/1/reviews",
    "/menu-items/1/reviews",
]
PAGED_PROTECTED_ROUTES = [
    "/orders",
    "/owner/menu",
    "/owner/orders",
    "/owner/returns",
    "/owner/reminders",
    "/owner/delivery-partners",
    "/delivery/orders",
]


def client_raising(error: Exception) -> TestClient:
    app = create_app()

    @app.get("/boom")
    def boom() -> None:
        raise error

    return TestClient(app, raise_server_exceptions=False)


def test_numbers_the_database_cannot_hold_are_a_422_in_the_normal_shape():
    response = client_raising(DataError("SELECT 1", {}, Exception("bigint out of range"))).get(
        "/boom"
    )

    assert response.status_code == 422
    assert response.json() == INVALID_INPUT


@pytest.mark.parametrize(
    "error",
    [
        IntegrityError("INSERT", {}, Exception("constraint")),
        StatementError("other failure", "SELECT 1", {}, RuntimeError("boom")),
    ],
    ids=["integrity", "statement-not-a-value-error"],
)
def test_other_database_errors_are_a_generic_500_without_details(error):
    response = client_raising(error).get("/boom")

    assert response.status_code == 500
    assert response.json() == SERVER_ERROR
    assert "constraint" not in response.text and "boom" not in response.text


@pytest.mark.parametrize("path", PAGED_PUBLIC_ROUTES)
@pytest.mark.parametrize("page", [MAX_PAGE + 1, 99999999999999999999])
def test_a_huge_page_number_is_a_422_on_public_routes(client, path, page):
    response = client.get(path, params={"page": page})

    assert response.status_code == 422


@pytest.mark.parametrize("path", PAGED_PROTECTED_ROUTES)
def test_a_huge_page_number_is_rejected_before_any_login_check_on_every_list(client, path):
    response = client.get(path, params={"page": MAX_PAGE + 1})

    assert response.status_code in (401, 422)


def test_the_largest_allowed_page_is_accepted_and_empty(client):
    response = client.get("/restaurants", params={"page": MAX_PAGE})

    assert response.status_code == 200
    assert response.json()["items"] == []


EMAIL = "a@masaischool.ac.in"
NUL_BODIES = [
    ("/auth/register", {"name": "Bad\u0000Name", "email": EMAIL, "password": "longenough1"}),
    ("/auth/register", {"name": "Ok", "email": EMAIL, "password": "long\u0000enough1"}),
    ("/auth/login", {"email": "a\u0000@masaischool.ac.in", "password": "longenough1"}),
]


@pytest.mark.parametrize(("path", "body"), NUL_BODIES)
def test_nul_characters_in_a_public_request_body_are_a_422(client, path, body):
    response = client.post(path, json=body)

    assert response.status_code == 422


@pytest.mark.parametrize("path", ["/restaurants", "/restaurants/1/menu"])
def test_nul_in_a_search_text_is_a_422(client, path):
    response = client.get(path, params={"q": "a\u0000b"})

    assert response.status_code == 422


def test_a_normal_search_text_still_works(client):
    response = client.get("/restaurants", params={"q": "dosa"})

    assert response.status_code == 200


ORDER_LINES = [{"menu_item_id": 1, "quantity": 1}]


@pytest.mark.parametrize(
    "body",
    [
        {"items": ORDER_LINES, "delivery_address": "Block\u0000B Room 204"},
        {"items": ORDER_LINES, "delivery_address": "Block B", "notes": "a\u0000b"},
    ],
    ids=["address", "notes"],
)
def test_nul_in_an_order_body_is_refused_by_validation(body):
    from pydantic import ValidationError

    from app.schemas.orders import OrderCreate

    with pytest.raises(ValidationError, match="NUL"):
        OrderCreate.model_validate(body)


@pytest.mark.parametrize(
    ("model", "body"),
    [
        ("app.schemas.reviews.ReviewCreate", {"rating": 5, "comment": "ni\u0000ce"}),
        ("app.schemas.returns.ReturnRequestCreate", {"reason": "too\u0000cold"}),
        ("app.schemas.insights.InsightRequest", {"question": "what\u0000now"}),
        (
            "app.schemas.owner_menu.MenuItemCreate",
            {"name": "Dosa\u0000", "category": "Dosas", "price": 10, "is_veg": True},
        ),
        ("app.schemas.owner_menu.MenuItemUpdate", {"description": "x\u0000y"}),
    ],
)
def test_nul_in_other_request_bodies_is_refused_by_validation(model, body):
    import importlib

    from pydantic import ValidationError

    module, name = model.rsplit(".", 1)
    schema = getattr(importlib.import_module(module), name)

    with pytest.raises(ValidationError, match="NUL"):
        schema.model_validate(body)
