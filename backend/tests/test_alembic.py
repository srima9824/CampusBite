import os
import subprocess
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent


def run_alembic(*args: str) -> subprocess.CompletedProcess:
    env = {**os.environ, "DATABASE_URL": "sqlite://"}
    return subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
    )


def test_alembic_heads_runs():
    result = run_alembic("heads")

    assert result.returncode == 0, result.stderr


def test_alembic_offline_upgrade_runs():
    result = run_alembic("upgrade", "head", "--sql")

    assert result.returncode == 0, result.stderr
