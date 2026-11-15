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


ORDER_TABLES = {"orders", "order_items", "payment_ledger"}


def test_orders_migration_creates_and_drops_tables(tmp_path):
    url = f"sqlite:///{tmp_path / 'orders.db'}"

    upgrade = run_alembic(url, "upgrade", "head")
    engine = create_engine(url)
    inspector = inspect(engine)
    after_upgrade = set(inspector.get_table_names())
    foreign_keys = {
        table: {
            (fk["constrained_columns"][0], fk["referred_table"])
            for fk in inspector.get_foreign_keys(table)
        }
        for table in ORDER_TABLES & after_upgrade
    }
    engine.dispose()
    downgrade = run_alembic(url, "downgrade", "base")
    engine = create_engine(url)
    after_downgrade = set(inspect(engine).get_table_names())
    engine.dispose()

    assert upgrade.returncode == 0, upgrade.stderr
    assert ORDER_TABLES <= after_upgrade
    assert foreign_keys["orders"] == {
        ("customer_id", "users"),
        ("restaurant_id", "restaurants"),
        ("delivery_partner_id", "users"),
    }
    assert foreign_keys["order_items"] == {("order_id", "orders"), ("menu_item_id", "menu_items")}
    assert foreign_keys["payment_ledger"] == {("order_id", "orders")}
    assert downgrade.returncode == 0, downgrade.stderr
    assert not ORDER_TABLES & after_downgrade


def test_downgrade_one_step_from_head_keeps_menu_tables(tmp_path):
    url = f"sqlite:///{tmp_path / 'step.db'}"
    assert run_alembic(url, "upgrade", "head").returncode == 0

    downgrade = run_alembic(url, "downgrade", "0002")
    engine = create_engine(url)
    remaining = set(inspect(engine).get_table_names())
    engine.dispose()

    assert downgrade.returncode == 0, downgrade.stderr
    assert not ORDER_TABLES & remaining
    assert {"users", "restaurants", "menu_items"} <= remaining


ORDER_INSERT = (
    "INSERT INTO orders (id, customer_id, restaurant_id, status, total, delivery_address, "
    "payment_status, created_at, updated_at) "
    "VALUES (:id, 1, 1, 'PLACED', :total, 'Hostel 4', 'mock_paid', "
    "CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
)


def insert_order(conn, order_id: int = 1, total: int = 10) -> None:
    conn.execute(text(ORDER_INSERT), {"id": order_id, "total": total})


def insert_order_item(conn, quantity: int = 1, unit_price: int = 10, line_total: int = 10) -> None:
    conn.execute(
        text(
            "INSERT INTO order_items (order_id, menu_item_id, name, unit_price, quantity, "
            "line_total) VALUES (1, 1, 'Dish', :u, :q, :l)"
        ),
        {"u": unit_price, "q": quantity, "l": line_total},
    )


def insert_ledger(conn, amount: int = 10) -> None:
    conn.execute(
        text(
            "INSERT INTO payment_ledger (order_id, amount, method, status, created_at) "
            "VALUES (1, :a, 'mock', 'mock_paid', CURRENT_TIMESTAMP)"
        ),
        {"a": amount},
    )


@pytest.mark.parametrize(
    "violation",
    [
        lambda c: insert_order(c, 2, 0),
        lambda c: insert_order(c, 2, -1),
        lambda c: insert_order_item(c, quantity=0),
        lambda c: insert_order_item(c, quantity=21),
        lambda c: insert_order_item(c, unit_price=-1),
        lambda c: insert_order_item(c, line_total=-1),
        lambda c: insert_ledger(c, 0),
        lambda c: insert_ledger(c, -5),
    ],
    ids=[
        "order_total_zero",
        "order_total_negative",
        "quantity_zero",
        "quantity_21",
        "unit_price_negative",
        "line_total_negative",
        "amount_zero",
        "amount_negative",
    ],
)
def test_migrated_order_tables_enforce_checks(migrated_engine, violation):
    with migrated_engine.begin() as conn:
        insert_order(conn)

    with pytest.raises(IntegrityError), migrated_engine.begin() as conn:
        violation(conn)


def test_migrated_order_tables_accept_valid_rows(migrated_engine):
    with migrated_engine.begin() as conn:
        insert_order(conn)
        insert_order_item(conn, quantity=20, unit_price=10, line_total=200)
        insert_ledger(conn)


def test_delivery_partner_migration_adds_and_drops_column_and_index(tmp_path):
    url = f"sqlite:///{tmp_path / 'partner.db'}"

    upgrade = run_alembic(url, "upgrade", "head")
    engine = create_engine(url)
    inspector = inspect(engine)
    column = next(c for c in inspector.get_columns("orders") if c["name"] == "delivery_partner_id")
    indexed = [i["column_names"] for i in inspector.get_indexes("orders")]
    engine.dispose()
    downgrade = run_alembic(url, "downgrade", "0003")
    engine = create_engine(url)
    inspector = inspect(engine)
    columns_after = {c["name"] for c in inspector.get_columns("orders")}
    indexed_after = [i["column_names"] for i in inspector.get_indexes("orders")]
    engine.dispose()

    assert upgrade.returncode == 0, upgrade.stderr
    assert column["nullable"] is True
    assert ["delivery_partner_id"] in indexed
    assert downgrade.returncode == 0, downgrade.stderr
    assert "delivery_partner_id" not in columns_after
    assert ["delivery_partner_id"] not in indexed_after
    assert "customer_id" in columns_after


def test_migrated_orders_reject_an_unknown_delivery_partner(migrated_engine):
    with migrated_engine.begin() as conn:
        insert_order(conn)

    with pytest.raises(IntegrityError), migrated_engine.begin() as conn:
        conn.execute(text("PRAGMA foreign_keys=ON"))
        conn.execute(text("UPDATE orders SET delivery_partner_id = 999 WHERE id = 1"))


def test_reviews_migration_creates_table_with_constraints_and_downgrades(tmp_path):
    url = f"sqlite:///{tmp_path / 'reviews.db'}"

    upgrade = run_alembic(url, "upgrade", "head")
    engine = create_engine(url)
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    uniques = inspector.get_unique_constraints("reviews") if "reviews" in tables else []
    checks = inspector.get_check_constraints("reviews") if "reviews" in tables else []
    foreign_keys = inspector.get_foreign_keys("reviews") if "reviews" in tables else []
    engine.dispose()
    downgrade = run_alembic(url, "downgrade", "0004")
    engine = create_engine(url)
    after = set(inspect(engine).get_table_names())
    engine.dispose()

    assert upgrade.returncode == 0, upgrade.stderr
    assert "reviews" in tables
    assert {"name": "uq_reviews_order_id", "column_names": ["order_id"]} in [
        {"name": u["name"], "column_names": u["column_names"]} for u in uniques
    ]
    assert any(
        c["name"] == "ck_reviews_rating_range" and "BETWEEN 1 AND 5" in c["sqltext"]
        for c in checks
    )
    assert {(f["constrained_columns"][0], f["referred_table"]) for f in foreign_keys} == {
        ("order_id", "orders"),
        ("customer_id", "users"),
        ("restaurant_id", "restaurants"),
    }
    assert downgrade.returncode == 0, downgrade.stderr
    assert "reviews" not in after
    assert ORDER_TABLES <= after


def test_reviews_downgrade_to_base_drops_everything(tmp_path):
    url = f"sqlite:///{tmp_path / 'reviews_base.db'}"
    assert run_alembic(url, "upgrade", "head").returncode == 0

    downgrade = run_alembic(url, "downgrade", "base")
    engine = create_engine(url)
    remaining = set(inspect(engine).get_table_names()) - {"alembic_version"}
    engine.dispose()

    assert downgrade.returncode == 0, downgrade.stderr
    assert remaining == set()


def insert_review(conn, order_id: int = 1, rating: int = 5) -> None:
    conn.execute(
        text(
            "INSERT INTO reviews (order_id, customer_id, restaurant_id, rating, created_at) "
            "VALUES (:o, 1, 1, :r, CURRENT_TIMESTAMP)"
        ),
        {"o": order_id, "r": rating},
    )


@pytest.mark.parametrize("rating", [0, 6, -1])
def test_migrated_reviews_reject_ratings_outside_1_to_5(migrated_engine, rating):
    with migrated_engine.begin() as conn:
        insert_order(conn)

    with pytest.raises(IntegrityError), migrated_engine.begin() as conn:
        insert_review(conn, rating=rating)


def test_migrated_reviews_allow_one_review_per_order(migrated_engine):
    with migrated_engine.begin() as conn:
        insert_order(conn, 1)
        insert_order(conn, 2)
        insert_review(conn, 1)
        insert_review(conn, 2, rating=1)

    with pytest.raises(IntegrityError), migrated_engine.begin() as conn:
        insert_review(conn, 1, rating=3)


def test_migrated_reviews_reject_an_unknown_order(migrated_engine):
    with pytest.raises(IntegrityError), migrated_engine.begin() as conn:
        conn.execute(text("PRAGMA foreign_keys=ON"))
        insert_review(conn, 999)


RETURN_COLUMNS = {"return_status", "return_reason", "return_requested_at"}


def orders_shape(url: str) -> tuple[dict, list]:
    engine = create_engine(url)
    inspector = inspect(engine)
    columns = {c["name"]: c for c in inspector.get_columns("orders")}
    indexes = [i["column_names"] for i in inspector.get_indexes("orders")]
    engine.dispose()
    return columns, indexes


def test_return_request_migration_adds_columns_and_index(tmp_path):
    url = f"sqlite:///{tmp_path / 'returns.db'}"

    upgrade = run_alembic(url, "upgrade", "head")
    columns, indexes = orders_shape(url)

    assert upgrade.returncode == 0, upgrade.stderr
    assert RETURN_COLUMNS <= set(columns)
    assert all(columns[name]["nullable"] is True for name in RETURN_COLUMNS)
    assert ["return_status"] in indexes


def test_return_request_downgrade_to_0005_removes_columns_and_index(tmp_path):
    url = f"sqlite:///{tmp_path / 'returns_down.db'}"
    assert run_alembic(url, "upgrade", "head").returncode == 0

    downgrade = run_alembic(url, "downgrade", "0005")
    columns, indexes = orders_shape(url)

    assert downgrade.returncode == 0, downgrade.stderr
    assert RETURN_COLUMNS.isdisjoint(columns)
    assert ["return_status"] not in indexes
    assert {"customer_id", "delivery_partner_id"} <= set(columns)


def test_return_request_downgrade_to_base_then_upgrade_again(tmp_path):
    url = f"sqlite:///{tmp_path / 'returns_base.db'}"
    assert run_alembic(url, "upgrade", "head").returncode == 0

    down = run_alembic(url, "downgrade", "base")
    engine = create_engine(url)
    remaining = set(inspect(engine).get_table_names()) - {"alembic_version"}
    engine.dispose()
    up = run_alembic(url, "upgrade", "head")
    columns, _ = orders_shape(url)

    assert down.returncode == 0, down.stderr
    assert remaining == set()
    assert up.returncode == 0, up.stderr
    assert RETURN_COLUMNS <= set(columns)
