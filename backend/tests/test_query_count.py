import pytest
from sqlalchemy import event

from app import seed
from app.models import MenuItem

PASSWORD = "seed-pass-1234"


@pytest.fixture
def statements(db_session):
    engine = db_session.get_bind()
    captured: list[str] = []

    def record(conn, cursor, statement, parameters, context, executemany):
        captured.append(statement)

    event.listen(engine, "before_cursor_execute", record)
    yield captured
    event.remove(engine, "before_cursor_execute", record)


def add_menu_items(db, restaurant_id: int, how_many: int) -> None:
    db.add_all(
        MenuItem(
            restaurant_id=restaurant_id,
            name=f"Extra dish {restaurant_id}-{how_many}-{n}",
            description="d",
            category="Extras",
            price=10 + n,
            is_veg=True,
        )
        for n in range(how_many)
    )
    db.commit()


def statements_for(client, statements, path: str) -> int:
    statements.clear()
    assert client.get(path).status_code == 200
    return len(statements)


def test_list_issues_count_and_select_only(client, db_session, statements):
    seed.seed_users(db_session, PASSWORD)
    seed.seed_restaurants(db_session)

    assert statements_for(client, statements, "/restaurants") <= 2


def test_menu_statement_count_is_constant_as_rows_grow(client, db_session, statements):
    seed.seed_users(db_session, PASSWORD)
    seed.seed_restaurants(db_session)
    add_menu_items(db_session, 1, 4)
    small = statements_for(client, statements, "/restaurants/1/menu")
    small_total = client.get("/restaurants/1/menu").json()["total"]

    add_menu_items(db_session, 1, 36)
    large = statements_for(client, statements, "/restaurants/1/menu")
    large_total = client.get("/restaurants/1/menu").json()["total"]

    assert large_total - small_total == 36
    assert small == large
    assert large <= 3  # existence lookup + count + select
