import pytest
from pydantic import ValidationError

from app.config import Settings, get_settings


def build_settings() -> Settings:
    return Settings(_env_file=None)


def test_database_url_is_required(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(ValidationError):
        build_settings()


def test_cors_origins_are_split_trimmed_and_empty_parts_dropped(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", " http://a.test , ,http://b.test,")

    assert build_settings().cors_origins == ["http://a.test", "http://b.test"]


def test_defaults(monkeypatch):
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    settings = build_settings()

    assert settings.reminder_stale_minutes == 15
    assert settings.jwt_algorithm == "HS256"
    assert settings.cors_origins == ["http://localhost:5173"]


def test_get_settings_is_cached_until_cleared(monkeypatch):
    first = get_settings()
    assert get_settings() is first

    get_settings.cache_clear()
    monkeypatch.setenv("DATABASE_URL", "sqlite:///other.db")
    assert get_settings().database_url == "sqlite:///other.db"
