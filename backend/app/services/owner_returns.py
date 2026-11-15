from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Order,
    OrderStatus,
    PaymentLedger,
    PaymentStatus,
    Restaurant,
    ReturnStatus,
)
from app.services.orders import PAYMENT_METHOD, OrderRejected
from app.services.owner_orders import get_order_for_restaurant, load_options
from app.services.restaurants import count_rows

NO_PENDING_MESSAGE = "This order has no return request waiting for a decision."
ALREADY_DECIDED_MESSAGE = "This return request was already decided."


def list_returns_for_restaurant(
    db: Session,
    restaurant: Restaurant,
    statuses: list[ReturnStatus],
    page: int,
    page_size: int,
) -> tuple[list[Order], int]:
    query = select(Order).where(
        Order.restaurant_id == restaurant.id, Order.return_status.is_not(None)
    )
    if statuses:
        query = query.where(Order.return_status.in_(statuses))
    total = count_rows(db, query)
    rows = db.scalars(
        query.options(*load_options())
        .order_by(Order.return_requested_at.desc(), Order.id.desc())
        .limit(page_size)
        .offset((page - 1) * page_size)
    )
    return list(rows), total


def decide_return(
    db: Session, restaurant: Restaurant, order_id: int, decision: ReturnStatus
) -> Order | None:
    order = db.scalar(
        select(Order)
        .where(Order.id == order_id, Order.restaurant_id == restaurant.id)
        .with_for_update()
    )
    if order is None:
        return None
    if order.return_status is None:
        raise OrderRejected(409, "return_not_pending", NO_PENDING_MESSAGE)
    if order.return_status is not ReturnStatus.REQUESTED:
        raise OrderRejected(409, "return_not_pending", ALREADY_DECIDED_MESSAGE)
    order.return_status = decision
    if decision is ReturnStatus.APPROVED:
        refund(db, order)
    db.commit()
    return get_order_for_restaurant(db, restaurant, order_id)


def refund(db: Session, order: Order) -> None:
    order.status = OrderStatus.REFUNDED
    order.payment_status = PaymentStatus.REFUNDED
    db.add(
        PaymentLedger(
            order_id=order.id,
            amount=order.total,
            method=PAYMENT_METHOD,
            status=PaymentStatus.REFUNDED,
        )
    )
