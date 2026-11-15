from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Order, OrderStatus, ReturnStatus, User
from app.schemas.returns import ReturnRequestCreate
from app.services.orders import OrderRejected, get_order_for_customer

NOT_DELIVERED_MESSAGE = "You can ask for a return once the order has been delivered."
ALREADY_REQUESTED_MESSAGE = "You have already asked for a return for this order."


def request_return(
    db: Session, customer: User, order_id: int, data: ReturnRequestCreate
) -> Order | None:
    order = db.scalar(
        select(Order)
        .where(Order.id == order_id, Order.customer_id == customer.id)
        .with_for_update()
    )
    if order is None:
        return None
    if order.status is not OrderStatus.DELIVERED:
        raise OrderRejected(409, "return_not_allowed", NOT_DELIVERED_MESSAGE)
    if order.return_status is not None:
        raise OrderRejected(409, "return_exists", ALREADY_REQUESTED_MESSAGE)
    order.return_status = ReturnStatus.REQUESTED
    order.return_reason = data.reason
    order.return_requested_at = datetime.now(UTC)
    db.commit()
    return get_order_for_customer(db, customer, order_id)
