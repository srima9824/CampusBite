from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import Select, select
from sqlalchemy.orm import Session, selectinload

from app.config import get_settings
from app.models import (
    MenuItem,
    Order,
    OrderItem,
    OrderStatus,
    PaymentLedger,
    PaymentStatus,
    Restaurant,
    User,
)
from app.schemas.orders import OrderCreate, OrderLineIn
from app.services.restaurants import count_rows

PAYMENT_METHOD = "mock"


class OrderRejected(Exception):
    def __init__(self, status_code: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


def load_dishes(db: Session, lines: list[OrderLineIn]) -> dict[int, MenuItem]:
    ids = [line.menu_item_id for line in lines]
    dishes = {dish.id: dish for dish in db.scalars(select(MenuItem).where(MenuItem.id.in_(ids)))}
    if len(dishes) != len(ids):
        raise OrderRejected(422, "menu_item_not_found", "One of the dishes is not on the menu.")
    return dishes


def load_restaurant(db: Session, dishes: dict[int, MenuItem]) -> Restaurant:
    restaurant_ids = {dish.restaurant_id for dish in dishes.values()}
    if len(restaurant_ids) > 1:
        raise OrderRejected(422, "mixed_restaurants", "Order from one restaurant at a time.")
    return db.get_one(Restaurant, restaurant_ids.pop())


def check_orderable(restaurant: Restaurant, dishes: dict[int, MenuItem]) -> None:
    if not restaurant.is_open:
        raise OrderRejected(409, "restaurant_closed", f"{restaurant.name} is closed right now.")
    for dish in dishes.values():
        if not dish.is_available:
            raise OrderRejected(409, "item_unavailable", f"{dish.name} is not available right now.")


def build_items(lines: list[OrderLineIn], dishes: dict[int, MenuItem]) -> list[OrderItem]:
    return [
        OrderItem(
            menu_item_id=line.menu_item_id,
            name=dishes[line.menu_item_id].name,
            unit_price=dishes[line.menu_item_id].price,
            quantity=line.quantity,
            line_total=dishes[line.menu_item_id].price * line.quantity,
        )
        for line in lines
    ]


def place_order(db: Session, customer: User, data: OrderCreate) -> Order:
    dishes = load_dishes(db, data.items)
    restaurant = load_restaurant(db, dishes)
    check_orderable(restaurant, dishes)
    items = build_items(data.items, dishes)
    total = sum(item.line_total for item in items)
    order = Order(
        customer_id=customer.id,
        restaurant_id=restaurant.id,
        total=total,
        delivery_address=data.delivery_address,
        notes=data.notes,
        items=items,
    )
    db.add(order)
    db.flush()
    db.add(
        PaymentLedger(
            order_id=order.id, amount=total, method=PAYMENT_METHOD, status=PaymentStatus.MOCK_PAID
        )
    )
    db.commit()
    return get_order_for_customer(db, customer, order.id)


CANCEL_BLOCKED_MESSAGES = {
    OrderStatus.CANCELLED: "This order is already cancelled.",
    OrderStatus.DELIVERED: "Delivered orders cannot be cancelled.",
    OrderStatus.REFUNDED: "This order has already been refunded.",
}
DEFAULT_CANCEL_BLOCKED = "This order is already being prepared, so it can no longer be cancelled."


def cancel_order(db: Session, customer: User, order_id: int) -> Order | None:
    order = db.scalar(
        select(Order)
        .where(Order.id == order_id, Order.customer_id == customer.id)
        .with_for_update()
    )
    if order is None:
        return None
    if order.status is not OrderStatus.PLACED:
        message = CANCEL_BLOCKED_MESSAGES.get(order.status, DEFAULT_CANCEL_BLOCKED)
        raise OrderRejected(409, "invalid_transition", message)
    order.status = OrderStatus.CANCELLED
    order.payment_status = PaymentStatus.REFUNDED
    db.add(
        PaymentLedger(
            order_id=order.id,
            amount=order.total,
            method=PAYMENT_METHOD,
            status=PaymentStatus.REFUNDED,
        )
    )
    db.commit()
    return get_order_for_customer(db, customer, order.id)


def get_order_for_customer(db: Session, customer: User, order_id: int) -> Order | None:
    return db.scalar(
        select(Order)
        .where(Order.id == order_id, Order.customer_id == customer.id)
        .options(selectinload(Order.items), selectinload(Order.restaurant))
        .execution_options(populate_existing=True)
    )


@dataclass(frozen=True)
class OrderFilters:
    statuses: list[OrderStatus] = field(default_factory=list)
    date_from: date | None = None
    date_to: date | None = None


def local_day_start_utc(day: date) -> datetime:
    zone = ZoneInfo(get_settings().app_timezone)
    return datetime.combine(day, time.min, tzinfo=zone).astimezone(UTC)


def customer_orders_query(customer: User, filters: OrderFilters) -> Select[tuple[Order]]:
    query = select(Order).where(Order.customer_id == customer.id)
    if filters.statuses:
        query = query.where(Order.status.in_(filters.statuses))
    if filters.date_from is not None:
        query = query.where(Order.created_at >= local_day_start_utc(filters.date_from))
    if filters.date_to is not None:
        day_after = filters.date_to + timedelta(days=1)
        query = query.where(Order.created_at < local_day_start_utc(day_after))
    return query


def list_orders_for_customer(
    db: Session, customer: User, filters: OrderFilters, page: int, page_size: int
) -> tuple[list[Order], int]:
    query = customer_orders_query(customer, filters)
    total = count_rows(db, query)
    rows = db.scalars(
        query.options(selectinload(Order.items), selectinload(Order.restaurant))
        .order_by(Order.created_at.desc(), Order.id.desc())
        .limit(page_size)
        .offset((page - 1) * page_size)
    )
    return list(rows), total
