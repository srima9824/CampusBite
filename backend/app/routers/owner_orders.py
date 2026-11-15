from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_roles
from app.dependencies.order_filters import order_filters
from app.dependencies.owner import owned_restaurant
from app.docs import NOT_LOGGED_IN, described
from app.errors import api_error
from app.models import Role, User
from app.schemas.owner_orders import OrderStatusUpdate, OwnerOrderOut
from app.schemas.restaurants import Page
from app.services import orders as order_service
from app.services import owner_orders as service

router = APIRouter(prefix="/owner/orders", tags=["owner orders"])

DbSession = Annotated[Session, Depends(get_db)]
Owner = Annotated[User, Depends(require_roles(Role.RESTAURANT_OWNER))]

OWNER_ONLY = "Only restaurant owners can use this route."
NO_RESTAURANT = "This owner has no restaurant yet (`restaurant_not_found`)."
ORDER_NOT_FOUND = "No order with this id at the owner's restaurant (`order_not_found`)."


def order_not_found() -> HTTPException:
    return api_error(status.HTTP_404_NOT_FOUND, "order_not_found", "Order not found.")


@router.get(
    "",
    summary="List orders for my restaurant",
    description=(
        "Lists the orders placed at the logged-in owner's restaurant, newest first, 10 per page by "
        "default. The restaurant is found from the login, so an owner only ever sees their own "
        "orders. `status` is one order status or a comma list such as `PLACED,ACCEPTED`. "
        "`date_from` and `date_to` are `YYYY-MM-DD` days in India time, and both ends are "
        "included. Each order shows the customer's name, the delivery address and the notes."
    ),
    responses=described(
        {
            401: NOT_LOGGED_IN,
            403: OWNER_ONLY,
            404: NO_RESTAURANT,
            422: "Unknown status (`invalid_status`), bad date (`invalid_date`) or start after end "
            "(`invalid_date_range`).",
        }
    ),
)
def list_restaurant_orders(
    owner: Owner,
    db: DbSession,
    filters: Annotated[order_service.OrderFilters, Depends(order_filters)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=50)] = 10,
) -> Page[OwnerOrderOut]:
    restaurant = owned_restaurant(db, owner)
    rows, total = service.list_orders_for_restaurant(db, restaurant, filters, page, page_size)
    items = [OwnerOrderOut.model_validate(row) for row in rows]
    return Page(items=items, total=total, page=page, page_size=page_size)


@router.get(
    "/{order_id}",
    summary="Show one order for my restaurant",
    description=(
        "Returns one order with its items, payment, the customer's name, the delivery address "
        "and the notes. The customer's email is never shown to the restaurant."
    ),
    responses=described({401: NOT_LOGGED_IN, 403: OWNER_ONLY, 404: ORDER_NOT_FOUND}),
)
def get_restaurant_order(order_id: int, owner: Owner, db: DbSession) -> OwnerOrderOut:
    restaurant = owned_restaurant(db, owner)
    order = service.get_order_for_restaurant(db, restaurant, order_id)
    if order is None:
        raise order_not_found()
    return OwnerOrderOut.model_validate(order)


@router.patch(
    "/{order_id}/status",
    summary="Move an order to the next kitchen step",
    description=(
        "Moves an order forward one step at a time: `PLACED` to `ACCEPTED`, then `PREPARING`, "
        "then `READY`. Skipping a step, going backwards, or changing a cancelled or delivered "
        "order is refused. Handing the order to a delivery partner is a separate step."
    ),
    responses=described(
        {
            401: NOT_LOGGED_IN,
            403: OWNER_ONLY,
            404: ORDER_NOT_FOUND,
            409: "This is not the next step for this order (`invalid_transition`).",
            422: "The status must be `ACCEPTED`, `PREPARING` or `READY`.",
        }
    ),
)
def update_order_status(
    order_id: int, data: OrderStatusUpdate, owner: Owner, db: DbSession
) -> OwnerOrderOut:
    restaurant = owned_restaurant(db, owner)
    try:
        order = service.advance_order(db, restaurant, order_id, data.status)
    except order_service.OrderRejected as rejection:
        raise api_error(rejection.status_code, rejection.code, rejection.message) from None
    if order is None:
        raise order_not_found()
    return OwnerOrderOut.model_validate(order)
