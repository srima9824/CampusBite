from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_roles
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


@router.get("")
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


@router.post("", status_code=status.HTTP_201_CREATED)
def place_order(data: OrderCreate, customer: Customer, db: DbSession) -> OrderOut:
    try:
        order = service.place_order(db, customer, data)
    except service.OrderRejected as rejection:
        raise api_error(rejection.status_code, rejection.code, rejection.message) from None
    return OrderOut.model_validate(order)


@router.get("/{order_id}")
def get_order(order_id: int, customer: Customer, db: DbSession) -> OrderOut:
    order = service.get_order_for_customer(db, customer, order_id)
    if order is None:
        raise api_error(status.HTTP_404_NOT_FOUND, "order_not_found", "Order not found.")
    return OrderOut.model_validate(order)
