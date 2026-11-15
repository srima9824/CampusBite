from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_roles
from app.docs import NOT_LOGGED_IN, described
from app.errors import api_error
from app.models import OrderStatus, Role, User
from app.schemas.orders import OrderCreate, OrderOut
from app.schemas.restaurants import Page
from app.services import orders as service

router = APIRouter(prefix="/orders", tags=["orders"])

DbSession = Annotated[Session, Depends(get_db)]
Customer = Annotated[User, Depends(require_roles(Role.CUSTOMER))]


def parse_statuses(raw: str | None) -> list[OrderStatus]:
    if not raw:
        return []
    try:
        return [OrderStatus(part.strip()) for part in raw.split(",")]
    except ValueError:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "invalid_status",
            "That is not an order status we know.",
        ) from None


def parse_day(raw: str | None) -> date | None:
    if not raw:
        return None
    try:
        return date.fromisoformat(raw)
    except ValueError:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "invalid_date",
            "Dates need the form YYYY-MM-DD.",
        ) from None


def order_filters(
    status_filter: Annotated[str | None, Query(alias="status", max_length=200)] = None,
    date_from: Annotated[str | None, Query(max_length=10)] = None,
    date_to: Annotated[str | None, Query(max_length=10)] = None,
) -> service.OrderFilters:
    filters = service.OrderFilters(
        parse_statuses(status_filter), parse_day(date_from), parse_day(date_to)
    )
    if filters.date_from and filters.date_to and filters.date_from > filters.date_to:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "invalid_date_range",
            "The start date is after the end date.",
        )
    return filters


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
