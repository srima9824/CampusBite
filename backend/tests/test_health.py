from sqlalchemy.exc import SQLAlchemyError

from app.database import get_db
from app.main import app


def test_health_reports_database_up(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "up"}


def test_health_reports_database_down_when_session_fails(client):
    class BrokenSession:
        def execute(self, *args, **kwargs):
            raise SQLAlchemyError("connection lost")

    app.dependency_overrides[get_db] = lambda: BrokenSession()

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "down"}
