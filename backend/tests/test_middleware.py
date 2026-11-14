import logging

import pytest
from fastapi.testclient import TestClient

from app.main import create_app

LOGGER = "campusbite.request"


@pytest.fixture
def failing_client():
    app = create_app()

    @app.get("/boom")
    def boom() -> None:
        raise RuntimeError("kaboom")

    return TestClient(app, raise_server_exceptions=False)


def test_response_has_non_negative_process_time(client):
    response = client.get("/health")

    assert float(response.headers["x-process-time"]) >= 0


def test_request_start_and_completion_are_logged(client, caplog):
    with caplog.at_level(logging.INFO, logger=LOGGER):
        client.get("/health")

    messages = [r.getMessage() for r in caplog.records if r.name == LOGGER]
    assert "GET /health" in messages
    assert any(
        m.startswith("GET /health -> 200 in ") and m.endswith(" ms") for m in messages
    )


def test_not_found_is_logged_with_404(client, caplog):
    with caplog.at_level(logging.INFO, logger=LOGGER):
        response = client.get("/missing")

    assert response.status_code == 404
    assert "x-process-time" in response.headers
    messages = [r.getMessage() for r in caplog.records if r.name == LOGGER]
    assert any(m.startswith("GET /missing -> 404 in ") for m in messages)


def test_unhandled_exception_is_logged_and_returns_500(failing_client, caplog):
    with caplog.at_level(logging.INFO, logger=LOGGER):
        response = failing_client.get("/boom")

    assert response.status_code == 500
    errors = [
        r for r in caplog.records if r.name == LOGGER and r.levelno == logging.ERROR
    ]
    assert len(errors) == 1
    assert "/boom" in errors[0].getMessage()
    assert errors[0].exc_info is not None


def test_process_time_header_is_exposed_to_allowed_origin(client):
    response = client.get("/health", headers={"Origin": "http://localhost:5173"})

    exposed = response.headers["access-control-expose-headers"]
    assert "X-Process-Time" in exposed
