from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Order, OrderStatus, Restaurant, Role, User
from app.order_status import owner_can_move
from app.services.orders import OrderFilters, OrderRejected, apply_order_filters
from app.services.restaurants import count_rows

BLOCKED_MESSAGES = {
    OrderStatus.CANCELLED: "This order was cancelled.",
    OrderStatus.DELIVERED: "This order was already delivered.",
    OrderStatus.REFUNDED: "This order was refunded.",
}


def load_options() -> tuple:
    return (
        selectinload(Order.items),
        selectinload(Order.customer),
        selectinload(Order.delivery_partner),
    )


def list_orders_for_restaurant(
    db: Session, restaurant: Restaurant, filters: OrderFilters, page: int, page_size: int
) -> tuple[list[Order], int]:
    query = apply_order_filters(select(Order).where(Order.restaurant_id == restaurant.id), filters)
    total = count_rows(db, query)
    rows = db.scalars(
        query.options(*load_options())
        .order_by(Order.created_at.desc(), Order.id.desc())
        .limit(page_size)
        .offset((page - 1) * page_size)
    )
    return list(rows), total


def get_order_for_restaurant(db: Session, restaurant: Restaurant, order_id: int) -> Order | None:
    return db.scalar(
        select(Order)
        .where(Order.id == order_id, Order.restaurant_id == restaurant.id)
        .options(*load_options())
        .execution_options(populate_existing=True)
    )


def advance_order(
    db: Session, restaurant: Restaurant, order_id: int, target: OrderStatus
) -> Order | None:
    order = db.scalar(
        select(Order)
        .where(Order.id == order_id, Order.restaurant_id == restaurant.id)
        .with_for_update()
    )
    if order is None:
        return None
    if not owner_can_move(order.status, target):
        raise OrderRejected(409, "invalid_transition", blocked_message(order.status, target))
    order.status = target
    db.commit()
    return get_order_for_restaurant(db, restaurant, order_id)


def blocked_message(current: OrderStatus, target: OrderStatus) -> str:
    if current in BLOCKED_MESSAGES:
        return BLOCKED_MESSAGES[current]
    return f"An order that is {current.value} cannot move to {target.value}."


def list_delivery_partners(db: Session, page: int, page_size: int) -> tuple[list[User], int]:
    query = select(User).where(User.role == Role.DELIVERY_PARTNER)
    total = count_rows(db, query)
    rows = db.scalars(
        query.order_by(User.name, User.id).limit(page_size).offset((page - 1) * page_size)
    )
    return list(rows), total


def assign_delivery_partner(
    db: Session, restaurant: Restaurant, order_id: int, partner_id: int
) -> Order | None:
    order = db.scalar(
        select(Order)
        .where(Order.id == order_id, Order.restaurant_id == restaurant.id)
        .with_for_update()
    )
    if order is None:
        return None
    if order.status is not OrderStatus.READY:
        raise OrderRejected(409, "invalid_transition", assign_blocked_message(order.status))
    partner = db.get(User, partner_id)
    if partner is None or partner.role is not Role.DELIVERY_PARTNER:
        raise OrderRejected(
            422, "delivery_partner_not_found", "Pick a delivery partner from the list."
        )
    order.delivery_partner_id = partner.id
    order.status = OrderStatus.ASSIGNED
    db.commit()
    return get_order_for_restaurant(db, restaurant, order_id)


def assign_blocked_message(current: OrderStatus) -> str:
    if current is OrderStatus.ASSIGNED:
        return "This order already has a delivery partner."
    if current in BLOCKED_MESSAGES:
        return BLOCKED_MESSAGES[current]
    return "A delivery partner can only be assigned once the order is READY."
