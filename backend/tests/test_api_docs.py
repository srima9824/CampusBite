import pytest

from app.docs import TAGS_METADATA
from app.main import app

MIN_DESCRIPTION_LENGTH = 40
PROTECTED_PREFIXES = ("/owner", "/orders", "/auth/me")


def operations() -> list[tuple[str, str, dict]]:
    schema = app.openapi()
    return [
        (method.upper(), path, operation)
        for path, methods in schema["paths"].items()
        for method, operation in methods.items()
    ]


@pytest.mark.parametrize(("method", "path", "operation"), operations())
def test_every_route_has_a_title_and_description(method, path, operation):
    assert operation.get("summary"), f"{method} {path} has no summary"
    assert len(operation.get("description", "")) >= MIN_DESCRIPTION_LENGTH, (
        f"{method} {path} needs a description"
    )


@pytest.mark.parametrize(("method", "path", "operation"), operations())
def test_protected_routes_document_the_login_error(method, path, operation):
    if path.startswith(PROTECTED_PREFIXES):
        assert "401" in operation["responses"], f"{method} {path} does not document 401"


def test_every_tag_used_by_a_route_is_described():
    described = {tag["name"] for tag in TAGS_METADATA if tag["description"]}
    used = {tag for _, _, operation in operations() for tag in operation.get("tags", [])}

    assert used <= described


def test_api_has_an_overview_description():
    assert "Authorize" in app.openapi()["info"]["description"]
