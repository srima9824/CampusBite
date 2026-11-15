import asyncio
import logging
from datetime import timedelta

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import reminders
from app.config import get_settings
from app.database import Base
from app.main import app
from app.models import AdminReminderLog, Order, Restaurant, Role, User
from app.models.order import OrderStatus
from app.models.restaurant import utc_now


async def run_loop_for(seconds: float, interval: float = 0.01) -> None:
    task = asyncio.create_task(reminders.reminder_loop(interval))
    await asyncio.sleep(seconds)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task


def test_loop_runs_the_check_repeatedly(monkeypatch):
    calls = []
    monkeypatch.setattr(reminders, "run_reminder_check", lambda: calls.append(1) or 0)

    asyncio.run(run_loop_for(0.2))

    assert len(calls) >= 3


def test_failing_check_is_logged_and_does_not_stop_the_loop(monkeypatch, caplog):
    calls = []

    def flaky():
        calls.append(1)
        if len(calls) == 1:
            raise RuntimeError("database is down")
        return 0

    monkeypatch.setattr(reminders, "run_reminder_check", flaky)

    with caplog.at_level(logging.ERROR, logger="campusbite.reminders"):
        asyncio.run(run_loop_for(0.2))

    assert len(calls) >= 3
    errors = [r for r in caplog.records if r.name == "campusbite.reminders"]
    assert len(errors) == 1
    assert errors[0].levelno == logging.ERROR
    assert errors[0].exc_info is not None
    assert "database is down" in caplog.text


def test_loop_keeps_going_when_every_check_fails(monkeypatch, caplog):
    calls = []

    def always_fails():
        calls.append(1)
        raise ValueError("nope")

    monkeypatch.setattr(reminders, "run_reminder_check", always_fails)

    with caplog.at_level(logging.ERROR, logger="campusbite.reminders"):
        asyncio.run(run_loop_for(0.15))

    assert len(calls) >= 3
    assert len([r for r in caplog.records if r.levelno == logging.ERROR]) == len(calls)


async def lifespan_tasks(monkeypatch, seconds: str) -> tuple[int, int, int]:
    monkeypatch.setenv("REMINDER_CHECK_SECONDS", seconds)
    get_settings.cache_clear()
    before = len(asyncio.all_tasks())
    async with reminders.lifespan(app):
        during = len(asyncio.all_tasks())
        await asyncio.sleep(0.05)
    await asyncio.sleep(0)
    after = len(asyncio.all_tasks())
    return before, during, after


def test_lifespan_starts_one_task_when_enabled_and_cancels_it_on_shutdown(monkeypatch):
    calls = []
    monkeypatch.setattr(reminders, "run_reminder_check", lambda: calls.append(1) or 0)

    before, during, after = asyncio.run(lifespan_tasks(monkeypatch, "1"))

    assert during == before + 1
    assert after == before
    assert len(calls) >= 1


def test_lifespan_creates_no_task_when_disabled(monkeypatch):
    calls = []
    monkeypatch.setattr(reminders, "run_reminder_check", lambda: calls.append(1) or 0)

    before, during, after = asyncio.run(lifespan_tasks(monkeypatch, "0"))

    assert during == before
    assert after == before
    assert calls == []


def test_lifespan_shutdown_is_clean_while_a_check_is_sleeping(monkeypatch):
    monkeypatch.setattr(reminders, "run_reminder_check", lambda: 0)

    async def scenario():
        monkeypatch.setenv("REMINDER_CHECK_SECONDS", "3600")
        get_settings.cache_clear()
        async with reminders.lifespan(app):
            await asyncio.sleep(0.05)
        return [t for t in asyncio.all_tasks() if t is not asyncio.current_task()]

    assert asyncio.run(scenario()) == []


def test_run_reminder_check_uses_session_local(monkeypatch):
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    maker = sessionmaker(bind=engine, expire_on_commit=False)
    with maker() as db:
        owner = User(
            name="O", email="o@masaischool.ac.in", password_hash="x", role=Role.RESTAURANT_OWNER
        )
        customer = User(
            name="C", email="c@masaischool.ac.in", password_hash="x", role=Role.CUSTOMER
        )
        db.add_all([owner, customer])
        db.flush()
        restaurant = Restaurant(
            owner_id=owner.id, name="R", cuisine="c", description="d", logo_key="l", image_key="i"
        )
        db.add(restaurant)
        db.flush()
        order = Order(
            customer_id=customer.id,
            restaurant_id=restaurant.id,
            status=OrderStatus.PLACED,
            total=10,
            delivery_address="Hostel 4",
        )
        db.add(order)
        db.commit()
        order.updated_at = utc_now() - timedelta(minutes=60)
        db.commit()
    monkeypatch.setattr(reminders, "SessionLocal", maker)

    first = reminders.run_reminder_check()
    second = reminders.run_reminder_check()

    with maker() as db:
        rows = list(db.scalars(select(AdminReminderLog)))
    engine.dispose()
    assert (first, second) == (1, 0)
    assert len(rows) == 1
