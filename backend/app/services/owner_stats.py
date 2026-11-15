from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Order, OrderItem, OrderStatus, PaymentStatus, Restaurant, Review
from app.schemas.owner_stats import OwnerStatsOut, TopDishOut
from app.services.orders import local_day_start_utc

TOP_DISH_COUNT = 5


def today_bounds() -> tuple[datetime, datetime]:
    today = datetime.now(ZoneInfo(get_settings().app_timezone)).date()
    return local_day_start_utc(today), local_day_start_utc(today + timedelta(days=1))


def order_totals(db: Session, restaurant: Restaurant) -> tuple[int, int, int]:
    start, end = today_bounds()
    paid = Order.payment_status == PaymentStatus.MOCK_PAID
    row = db.execute(
        select(
            func.count(Order.id),
            func.coalesce(func.sum(Order.total).filter(paid), 0),
            func.count(Order.id).filter(Order.created_at >= start, Order.created_at < end),
        ).where(Order.restaurant_id == restaurant.id)
    ).one()
    return row[0], int(row[1]), row[2]


def orders_by_status(db: Session, restaurant: Restaurant) -> dict[OrderStatus, int]:
    rows = db.execute(
        select(Order.status, func.count(Order.id))
        .where(Order.restaurant_id == restaurant.id)
        .group_by(Order.status)
    )
    counts = {status: 0 for status in OrderStatus}
    counts.update({status: count for status, count in rows})
    return counts


def top_dishes(db: Session, restaurant: Restaurant) -> list[TopDishOut]:
    quantity = func.sum(OrderItem.quantity).label("quantity")
    name = func.min(OrderItem.name).label("name")
    rows = db.execute(
        select(OrderItem.menu_item_id, name, quantity)
        .join(Order, Order.id == OrderItem.order_id)
        .where(
            Order.restaurant_id == restaurant.id,
            Order.payment_status == PaymentStatus.MOCK_PAID,
        )
        .group_by(OrderItem.menu_item_id)
        .order_by(quantity.desc(), name)
        .limit(TOP_DISH_COUNT)
    )
    return [TopDishOut(menu_item_id=i, name=n, quantity=int(q)) for i, n, q in rows]


def rating_summary(db: Session, restaurant: Restaurant) -> tuple[float | None, int]:
    average, count = db.execute(
        select(func.avg(Review.rating), func.count(Review.id)).where(
            Review.restaurant_id == restaurant.id
        )
    ).one()
    return (None if average is None else round(float(average), 1)), count


def restaurant_stats(db: Session, restaurant: Restaurant) -> OwnerStatsOut:
    total, revenue, today = order_totals(db, restaurant)
    average, review_count = rating_summary(db, restaurant)
    return OwnerStatsOut(
        total_orders=total,
        revenue=revenue,
        orders_today=today,
        by_status=orders_by_status(db, restaurant),
        top_dishes=top_dishes(db, restaurant),
        average_rating=average,
        review_count=review_count,
    )
