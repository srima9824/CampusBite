from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Order, OrderStatus, Review, User
from app.schemas.reviews import ReviewCreate
from app.services.orders import OrderRejected

NOT_DELIVERED_MESSAGE = "You can review an order once it has been delivered."
ALREADY_REVIEWED_MESSAGE = "You have already reviewed this order."


def create_review(
    db: Session, customer: User, order_id: int, data: ReviewCreate
) -> Review | None:
    order = db.scalar(
        select(Order)
        .where(Order.id == order_id, Order.customer_id == customer.id)
        .with_for_update()
    )
    if order is None:
        return None
    if order.status is not OrderStatus.DELIVERED:
        raise OrderRejected(409, "review_not_allowed", NOT_DELIVERED_MESSAGE)
    review = Review(
        order_id=order.id,
        customer_id=customer.id,
        restaurant_id=order.restaurant_id,
        rating=data.rating,
        comment=data.comment,
    )
    db.add(review)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise OrderRejected(409, "review_exists", ALREADY_REVIEWED_MESSAGE) from None
    return review
