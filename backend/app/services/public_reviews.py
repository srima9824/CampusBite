from sqlalchemy import Select, select
from sqlalchemy.orm import Session, selectinload

from app.models import Order, OrderItem, Review
from app.schemas.public_reviews import PublicReviewOut
from app.services.restaurants import count_rows


def reviewer_label(full_name: str) -> str:
    parts = full_name.split()
    if not parts:
        return "A CampusBite customer"
    if len(parts) == 1:
        return parts[0]
    return f"{parts[0]} {parts[-1][0].upper()}."


def to_public(review: Review) -> PublicReviewOut:
    return PublicReviewOut(
        rating=review.rating,
        comment=review.comment,
        created_at=review.created_at,
        reviewer=reviewer_label(review.customer.name),
        dishes=[item.name for item in review.order.items],
    )


def restaurant_reviews_query(restaurant_id: int) -> Select[tuple[Review]]:
    return select(Review).where(Review.restaurant_id == restaurant_id)


def dish_reviews_query(menu_item_id: int) -> Select[tuple[Review]]:
    orders_with_dish = select(OrderItem.order_id).where(OrderItem.menu_item_id == menu_item_id)
    return select(Review).where(Review.order_id.in_(orders_with_dish))


def list_reviews(
    db: Session, query: Select[tuple[Review]], rating: int | None, page: int, page_size: int
) -> tuple[list[PublicReviewOut], int]:
    if rating is not None:
        query = query.where(Review.rating == rating)
    total = count_rows(db, query)
    rows = db.scalars(
        query.options(
            selectinload(Review.customer),
            selectinload(Review.order).selectinload(Order.items),
        )
        .order_by(Review.created_at.desc(), Review.id.desc())
        .limit(page_size)
        .offset((page - 1) * page_size)
    )
    return [to_public(review) for review in rows], total
