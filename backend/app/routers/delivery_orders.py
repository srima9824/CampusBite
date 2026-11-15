from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_roles
from app.dependencies.order_filters import order_filters
from app.docs import NOT_LOGGED_IN, described
from app.errors import api_error
from app.models import Role, User
from app.schemas.delivery_orders import DeliveryOrderOut, DeliveryStatusUpdate
from app.schemas.restaurants import Page
from app.services import delivery_orders as service
from app.services import orders as order_service

router = APIRouter(prefix="/delivery/orders", tags=["delivery"])

DbSession = Annotated[Session, Depends(get_db)]
Partner = Annotated[User, Depends(require_roles(Role.DELIVERY_PARTNER))]

PARTNER_ONLY = "Only delivery partners can use this route."
ORDER_NOT_FOUND = (
    "This order does not exist or is not assigned to this partner (`order_not_found`)."
)


def order_not_found() -> HTTPException:
    return api_error(status.HTTP_404_NOT_FOUND, "order_not_found", "Order not found.")


@router.get(
    "",
    summary="List my deliveries",
    description=(
        "Lists only the orders assigned to the logged-in delivery partner, newest first, 10 per "
        "page by default. Use `status=ASSIGNED,OUT_FOR_DELIVERY` for current deliveries and "
        "`status=DELIVERED` for the delivery history. `date_from` and `date_to` are `YYYY-MM-DD` "
        "days in India time. Each order shows the restaurant, the customer's name, the delivery "
        "address, the notes and the items."
    ),
    responses=described(
        {
            401: NOT_LOGGED_IN,
            403: PARTNER_ONLY,
            422: "Unknown status (`invalid_status`), bad date (`invalid_date`) or start after end "
            "(`invalid_date_range`).",
        }
    ),
)
def list_deliveries(
    partner: Partner,
    db: DbSession,
    filters: Annotated[order_service.OrderFilters, Depends(order_filters)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=50)] = 10,
) -> Page[DeliveryOrderOut]:
    rows, total = service.list_orders_for_partner(db, partner, filters, page, page_size)
    items = [DeliveryOrderOut.model_validate(row) for row in rows]
    return Page(items=items, total=total, page=page, page_size=page_size)


@router.get(
    "/{order_id}",
    summary="Show one of my deliveries",
    description=(
        "Returns one assigned order with the delivery details. The customer's email, the order "
        "total and the payment are not shown to delivery partners."
    ),
    responses=described({401: NOT_LOGGED_IN, 403: PARTNER_ONLY, 404: ORDER_NOT_FOUND}),
)
def get_delivery(order_id: int, partner: Partner, db: DbSession) -> DeliveryOrderOut:
    order = service.get_order_for_partner(db, partner, order_id)
    if order is None:
        raise order_not_found()
    return DeliveryOrderOut.model_validate(order)


@router.patch(
    "/{order_id}/status",
    summary="Update a delivery",
    description=(
        "Moves an assigned order forward one step at a time: `ASSIGNED` to `OUT_FOR_DELIVERY`, "
        "then `DELIVERED`. Skipping a step, going backwards, or changing a delivered order is "
        "refused. A partner can only update orders that are assigned to them."
    ),
    responses=described(
        {
            401: NOT_LOGGED_IN,
            403: PARTNER_ONLY,
            404: ORDER_NOT_FOUND,
            409: "This is not the next step for this order (`invalid_transition`).",
            422: "The status must be `OUT_FOR_DELIVERY` or `DELIVERED`.",
        }
    ),
)
def update_delivery_status(
    order_id: int, data: DeliveryStatusUpdate, partner: Partner, db: DbSession
) -> DeliveryOrderOut:
    try:
        order = service.advance_delivery(db, partner, order_id, data.status)
    except order_service.OrderRejected as rejection:
        raise api_error(rejection.status_code, rejection.code, rejection.message) from None
    if order is None:
        raise order_not_found()
    return DeliveryOrderOut.model_validate(order)
