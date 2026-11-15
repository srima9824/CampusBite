from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_roles
from app.dependencies.owner import owned_restaurant
from app.docs import NOT_LOGGED_IN, described
from app.models import AdminReminderLog, Order, Role, User
from app.schemas.reminders import ReminderOut
from app.schemas.restaurants import Page
from app.services import reminders as service

router = APIRouter(prefix="/owner/reminders", tags=["owner orders"])

DbSession = Annotated[Session, Depends(get_db)]
Owner = Annotated[User, Depends(require_roles(Role.RESTAURANT_OWNER))]


def as_reminder(reminder: AdminReminderLog, order: Order, now: datetime) -> ReminderOut:
    updated_at = order.updated_at
    if updated_at.tzinfo is None:
        updated_at = updated_at.replace(tzinfo=UTC)
    waited = max(0, int((now - updated_at).total_seconds() // 60))
    return ReminderOut(
        id=reminder.id,
        order_id=reminder.order_id,
        order_status=reminder.order_status,
        created_at=reminder.created_at,
        minutes_waiting=waited,
    )


@router.get(
    "",
    summary="List reminders for my restaurant",
    description=(
        "Lists reminders for orders at the logged-in owner's restaurant that have waited too long "
        "without an update: still `PLACED` or `ACCEPTED` after more than 15 minutes. Newest first, "
        "10 per page by default. A reminder shows only while the order is still in that status, "
        "so it disappears once the order moves on. `minutes_waiting` is how long the order has "
        "gone without an update. Reminders are created by a background task about once a minute."
    ),
    responses=described(
        {
            401: NOT_LOGGED_IN,
            403: "Only restaurant owners can use this route.",
            404: "This owner has no restaurant yet (`restaurant_not_found`).",
        }
    ),
)
def list_reminders(
    owner: Owner,
    db: DbSession,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=50)] = 10,
) -> Page[ReminderOut]:
    restaurant = owned_restaurant(db, owner)
    rows, total = service.list_active_reminders(db, restaurant, page, page_size)
    now = datetime.now(UTC)
    items = [as_reminder(reminder, order, now) for reminder, order in rows]
    return Page(items=items, total=total, page=page, page_size=page_size)
