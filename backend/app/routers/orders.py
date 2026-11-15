from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_roles
from app.dependencies.order_filters import order_filters
from app.docs import NOT_LOGGED_IN, described
from app.errors import api_error
from app.models import Role, User
from app.schemas.orders import OrderCreate, OrderOut
from app.schemas.restaurants import Page
from app.schemas.returns import ReturnRequestCreate
from app.schemas.reviews import ReviewCreate, ReviewOut
from app.services import orders as service
from app.services import returns as return_service
from app.services import reviews as review_service

router = APIRouter(prefix="/orders", tags=["orders"])

DbSession = Annotated[Session, Depends(get_db)]
Customer = Annotated[User, Depends(require_roles(Role.CUSTOMER))]


@router.get(
    "",
    summary="List my orders",
    description=(
        "Lists the logged-in customer's own orders, newest first, 10 per page by default. "
        "`status` is one order status or a comma list such as `PLACED,ACCEPTED`. `date_from` and "
        "`date_to` are `YYYY-MM-DD` days in India time, and both ends are included. Filters "
        "combine."
    ),
    responses=described(
        {
            401: NOT_LOGGED_IN,
            403: "Only customers can use this route.",
            422: "Unknown status (`invalid_status`), bad date (`invalid_date`) or start after end "
            "(`invalid_date_range`).",
        }
    ),
)
def list_orders(
    customer: Customer,
    db: DbSession,
    filters: Annotated[service.OrderFilters, Depends(order_filters)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=50)] = 10,
) -> Page[OrderOut]:
    rows, total = service.list_orders_for_customer(db, customer, filters, page, page_size)
    items = [OrderOut.model_validate(row) for row in rows]
    return Page(items=items, total=total, page=page, page_size=page_size)


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Place an order",
    description=(
        "Places an order from one restaurant using the dummy payment. Send dish ids with "
        "quantities "
        "(1 to 20 each), a delivery address and optional notes. Prices always come from the "
        "database, never from the request, and there is no delivery fee. The order starts as "
        "`PLACED` "
        "with payment status `mock_paid`, and a payment record is saved with it."
    ),
    responses=described(
        {
            401: NOT_LOGGED_IN,
            403: "Only customers can use this route.",
            409: "A dish is unavailable (`item_unavailable`) or the restaurant is closed "
            "(`restaurant_closed`).",
            422: "A dish does not exist, dishes come from two restaurants (`mixed_restaurants`), "
            "or a field is not valid.",
        }
    ),
)
def place_order(data: OrderCreate, customer: Customer, db: DbSession) -> OrderOut:
    try:
        order = service.place_order(db, customer, data)
    except service.OrderRejected as rejection:
        raise api_error(rejection.status_code, rejection.code, rejection.message) from None
    return OrderOut.model_validate(order)


@router.post(
    "/{order_id}/cancel",
    summary="Cancel my order",
    description=(
        "Cancels one of the logged-in customer's orders. This is only allowed while the order is "
        "still `PLACED`. The order becomes `CANCELLED`, the payment status becomes `refunded` "
        "and a refund entry is added to the payment record. Orders that were accepted, are "
        "being prepared, were delivered or are already cancelled cannot be cancelled."
    ),
    responses=described(
        {
            401: NOT_LOGGED_IN,
            403: "Only customers can use this route.",
            404: "No order with this id for this customer (`order_not_found`).",
            409: "The order can no longer be cancelled (`invalid_transition`).",
        }
    ),
)
def cancel_order(order_id: int, customer: Customer, db: DbSession) -> OrderOut:
    try:
        order = service.cancel_order(db, customer, order_id)
    except service.OrderRejected as rejection:
        raise api_error(rejection.status_code, rejection.code, rejection.message) from None
    if order is None:
        raise api_error(status.HTTP_404_NOT_FOUND, "order_not_found", "Order not found.")
    return OrderOut.model_validate(order)


@router.post(
    "/{order_id}/return",
    status_code=status.HTTP_201_CREATED,
    summary="Ask for a return and refund",
    description=(
        "Asks the restaurant for a return and refund of a delivered order. A reason of 5 to 300 "
        "characters is required. Only the customer who placed the order can ask, only once the "
        "order is `DELIVERED`, and only once per order. There is no time limit. The order's "
        "`return_status` becomes `REQUESTED`; the restaurant then approves or rejects it."
    ),
    responses=described(
        {
            401: NOT_LOGGED_IN,
            403: "Only customers can use this route.",
            404: "No order with this id for this customer (`order_not_found`).",
            409: "The order is not delivered yet (`return_not_allowed`) or a return was already "
            "requested (`return_exists`).",
            422: "The reason must have 5 to 300 characters.",
        }
    ),
)
def request_order_return(
    order_id: int, data: ReturnRequestCreate, customer: Customer, db: DbSession
) -> OrderOut:
    try:
        order = return_service.request_return(db, customer, order_id, data)
    except service.OrderRejected as rejection:
        raise api_error(rejection.status_code, rejection.code, rejection.message) from None
    if order is None:
        raise api_error(status.HTTP_404_NOT_FOUND, "order_not_found", "Order not found.")
    return OrderOut.model_validate(order)


@router.post(
    "/{order_id}/review",
    status_code=status.HTTP_201_CREATED,
    summary="Review a delivered order",
    description=(
        "Rates a delivered order from 1 to 5 stars, with an optional comment of up to 500 "
        "characters. A customer can review only their own orders, only once they are `DELIVERED`, "
        "and only once per order. A review cannot be edited or deleted. Ratings feed the average "
        "rating shown on the restaurant."
    ),
    responses=described(
        {
            401: NOT_LOGGED_IN,
            403: "Only customers can use this route.",
            404: "No order with this id for this customer (`order_not_found`).",
            409: "The order is not delivered yet (`review_not_allowed`) or already has a review "
            "(`review_exists`).",
            422: "The rating must be a whole number from 1 to 5, or the comment is too long.",
        }
    ),
)
def review_order(
    order_id: int, data: ReviewCreate, customer: Customer, db: DbSession
) -> ReviewOut:
    try:
        review = review_service.create_review(db, customer, order_id, data)
    except service.OrderRejected as rejection:
        raise api_error(rejection.status_code, rejection.code, rejection.message) from None
    if review is None:
        raise api_error(status.HTTP_404_NOT_FOUND, "order_not_found", "Order not found.")
    return ReviewOut.model_validate(review)


@router.get(
    "/{order_id}",
    summary="Show one of my orders",
    description="Returns one order with its items, restaurant and payment. Customers can only see "
    "their own orders.",
    responses=described(
        {
            401: NOT_LOGGED_IN,
            403: "Only customers can use this route.",
            404: "No order with this id for this customer (`order_not_found`).",
        }
    ),
)
def get_order(order_id: int, customer: Customer, db: DbSession) -> OrderOut:
    order = service.get_order_for_customer(db, customer, order_id)
    if order is None:
        raise api_error(status.HTTP_404_NOT_FOUND, "order_not_found", "Order not found.")
    return OrderOut.model_validate(order)
