from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Order, OrderStatus, User
from app.order_status import delivery_partner_can_move
from app.services.orders import OrderFilters, OrderRejected, apply_order_filters
from app.services.restaurants import count_rows

BLOCKED_MESSAGES = {
    OrderStatus.DELIVERED: "This order was already delivered.",
    OrderStatus.CANCELLED: "This order was cancelled.",
    OrderStatus.REFUNDED: "This order was refunded.",
}


def load_options() -> tuple:
    return (
        selectinload(Order.items),
        selectinload(Order.customer),
        selectinload(Order.restaurant),
    )


def list_orders_for_partner(
    db: Session, partner: User, filters: OrderFilters, page: int, page_size: int
) -> tuple[list[Order], int]:
    base = select(Order).where(Order.delivery_partner_id == partner.id)
    query = apply_order_filters(base, filters)
    total = count_rows(db, query)
    rows = db.scalars(
        query.options(*load_options())
        .order_by(Order.created_at.desc(), Order.id.desc())
        .limit(page_size)
        .offset((page - 1) * page_size)
    )
    return list(rows), total


def get_order_for_partner(db: Session, partner: User, order_id: int) -> Order | None:
    return db.scalar(
        select(Order)
        .where(Order.id == order_id, Order.delivery_partner_id == partner.id)
        .options(*load_options())
        .execution_options(populate_existing=True)
    )


def blocked_message(current: OrderStatus, target: OrderStatus) -> str:
    if current in BLOCKED_MESSAGES:
        return BLOCKED_MESSAGES[current]
    return f"An order that is {current.value} cannot move to {target.value}."


def advance_delivery(
    db: Session, partner: User, order_id: int, target: OrderStatus
) -> Order | None:
    order = db.scalar(
        select(Order)
        .where(Order.id == order_id, Order.delivery_partner_id == partner.id)
        .with_for_update()
    )
    if order is None:
        return None
    if not delivery_partner_can_move(order.status, target):
        raise OrderRejected(409, "invalid_transition", blocked_message(order.status, target))
    order.status = target
    db.commit()
    return get_order_for_partner(db, partner, order_id)
