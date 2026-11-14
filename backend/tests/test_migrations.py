import os
import subprocess
import sys
from pathlib import Path

from sqlalchemy import create_engine, inspect

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
