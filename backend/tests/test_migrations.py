import os
import subprocess
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError

BACKEND_DIR = Path(__file__).resolve().parent.parent


def run_alembic(database_url: str, *args: str) -> subprocess.CompletedProcess:
    env = {**os.environ, "DATABASE_URL": database_url}
    return subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
    )


def test_upgrade_creates_users_with_unique_email_index_then_downgrades(tmp_path):
    url = f"sqlite:///{tmp_path / 'migration.db'}"

    upgrade = run_alembic(url, "upgrade", "head")
    engine = create_engine(url)
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    indexes = inspector.get_indexes("users") if "users" in tables else []
    engine.dispose()

    assert upgrade.returncode == 0, upgrade.stderr
    assert "users" in tables
    assert any(i["column_names"] == ["email"] and i["unique"] for i in indexes)

    downgrade = run_alembic(url, "downgrade", "base")
    engine = create_engine(url)
    remaining = inspect(engine).get_table_names()
    engine.dispose()

    assert downgrade.returncode == 0, downgrade.stderr
    assert "users" not in remaining


def test_restaurant_migration_creates_and_drops_tables(tmp_path):
    url = f"sqlite:///{tmp_path / 'restaurants.db'}"

    upgrade = run_alembic(url, "upgrade", "head")
    engine = create_engine(url)
    after_upgrade = set(inspect(engine).get_table_names())
    engine.dispose()
    downgrade = run_alembic(url, "downgrade", "base")
    engine = create_engine(url)
    after_downgrade = set(inspect(engine).get_table_names())
    engine.dispose()

    assert upgrade.returncode == 0, upgrade.stderr
    assert {"restaurants", "menu_items"} <= after_upgrade
    assert downgrade.returncode == 0, downgrade.stderr
    assert not {"restaurants", "menu_items", "users"} & after_downgrade


def insert_owner(conn, n: int) -> None:
    conn.execute(
        text(
            "INSERT INTO users (id, name, email, password_hash, role, created_at) "
            "VALUES (:id, 'o', :email, 'x', 'restaurant_owner', CURRENT_TIMESTAMP)"
        ),
        {"id": n, "email": f"o{n}@masaischool.ac.in"},
    )


def insert_restaurant(conn, owner_id: int, name: str) -> None:
    conn.execute(
        text(
            "INSERT INTO restaurants (owner_id, name, cuisine, description, logo_key, "
            "image_key, is_open, created_at) "
            "VALUES (:o, :n, 'c', 'd', 'l', 'i', 1, CURRENT_TIMESTAMP)"
        ),
        {"o": owner_id, "n": name},
    )


def insert_dish(conn, name: str, price: int) -> None:
    conn.execute(
        text(
            "INSERT INTO menu_items (restaurant_id, name, description, category, price, "
            "is_veg, is_available, created_at) "
            "VALUES (1, :n, 'd', 'c', :p, 1, 1, CURRENT_TIMESTAMP)"
        ),
        {"n": name, "p": price},
    )


@pytest.fixture
def migrated_engine(tmp_path):
    url = f"sqlite:///{tmp_path / 'constraints.db'}"
    assert run_alembic(url, "upgrade", "head").returncode == 0
    engine = create_engine(url)
    with engine.begin() as conn:
        insert_owner(conn, 1)
        insert_owner(conn, 2)
        insert_restaurant(conn, 1, "A")
        insert_dish(conn, "Dish", 10)
    yield engine
    engine.dispose()


@pytest.mark.parametrize(
    "violation",
    [
        lambda c: insert_restaurant(c, 1, "B"),
        lambda c: insert_restaurant(c, 2, "A"),
        lambda c: insert_dish(c, "Dish", 20),
        lambda c: insert_dish(c, "Free", 0),
        lambda c: insert_dish(c, "Negative", -5),
    ],
    ids=[
        "owner_unique",
        "restaurant_name_unique",
        "dish_name_unique",
        "price_zero",
        "price_negative",
    ],
)
def test_migrated_schema_enforces_constraints(migrated_engine, violation):
    with pytest.raises(IntegrityError), migrated_engine.begin() as conn:
        violation(conn)
