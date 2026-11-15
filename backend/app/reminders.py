import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress
from datetime import UTC, datetime

from fastapi import FastAPI

from app.config import get_settings
from app.database import SessionLocal
from app.services.reminders import create_due_reminders

logger = logging.getLogger("campusbite.reminders")


def run_reminder_check() -> int:
    stale_minutes = get_settings().reminder_stale_minutes
    with SessionLocal() as db:
        return create_due_reminders(db, datetime.now(UTC), stale_minutes)


async def reminder_loop(interval_seconds: int) -> None:
    while True:
        try:
            await asyncio.to_thread(run_reminder_check)
        except Exception:
            logger.exception("Reminder check failed; trying again at the next interval")
        await asyncio.sleep(interval_seconds)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    interval = get_settings().reminder_check_seconds
    task = asyncio.create_task(reminder_loop(interval)) if interval > 0 else None
    try:
        yield
    finally:
        if task is not None:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
