import logging
from datetime import datetime, timedelta

from sqlalchemy import exists, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import AdminReminderLog, Order, OrderStatus, Restaurant
from app.services.restaurants import count_rows

logger = logging.getLogger("campusbite.reminders")

WATCHED_STATUSES = (OrderStatus.PLACED, OrderStatus.ACCEPTED)


def due_orders_query(now: datetime, stale_minutes: int):
    already_reminded = exists().where(
        AdminReminderLog.order_id == Order.id,
        AdminReminderLog.order_status == Order.status,
    )
    return select(Order).where(
        Order.status.in_(WATCHED_STATUSES),
        Order.updated_at < now - timedelta(minutes=stale_minutes),
        ~already_reminded,
    )


def create_due_reminders(db: Session, now: datetime, stale_minutes: int) -> int:
    orders = list(db.scalars(due_orders_query(now, stale_minutes)))
    for order in orders:
        db.add(
            AdminReminderLog(
                order_id=order.id, restaurant_id=order.restaurant_id, order_status=order.status
            )
        )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return 0
    if orders:
        logger.info("Created %s reminder(s) for orders waiting too long", len(orders))
    return len(orders)


def list_active_reminders(
    db: Session, restaurant: Restaurant, page: int, page_size: int
) -> tuple[list[tuple[AdminReminderLog, Order]], int]:
    query = (
        select(AdminReminderLog, Order)
        .join(Order, Order.id == AdminReminderLog.order_id)
        .where(
            AdminReminderLog.restaurant_id == restaurant.id,
            Order.status == AdminReminderLog.order_status,
        )
    )
    total = count_rows(db, query)
    rows = db.execute(
        query.order_by(AdminReminderLog.created_at.desc(), AdminReminderLog.id.desc())
        .limit(page_size)
        .offset((page - 1) * page_size)
    )
    return [(reminder, order) for reminder, order in rows], total
