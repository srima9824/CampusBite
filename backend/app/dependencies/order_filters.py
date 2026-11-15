from datetime import date
from typing import Annotated

from fastapi import Query, status

from app.errors import api_error
from app.models import OrderStatus
from app.services.orders import OrderFilters


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
) -> OrderFilters:
    filters = OrderFilters(
        parse_statuses(status_filter), parse_day(date_from), parse_day(date_to)
    )
    if filters.date_from and filters.date_to and filters.date_from > filters.date_to:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "invalid_date_range",
            "The start date is after the end date.",
        )
    return filters
