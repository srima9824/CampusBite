from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_roles
from app.dependencies.owner import owned_restaurant
from app.docs import NOT_LOGGED_IN, described
from app.errors import api_error
from app.models import ReturnStatus, Role, User
from app.schemas.owner_orders import OwnerOrderOut
from app.schemas.restaurants import Page
from app.services import owner_returns as service

router = APIRouter(prefix="/owner/returns", tags=["owner orders"])

DbSession = Annotated[Session, Depends(get_db)]
Owner = Annotated[User, Depends(require_roles(Role.RESTAURANT_OWNER))]


def parse_return_statuses(
    raw: Annotated[str | None, Query(alias="return_status", max_length=100)] = None,
) -> list[ReturnStatus]:
    if not raw:
        return []
    try:
        return [ReturnStatus(part.strip()) for part in raw.split(",")]
    except ValueError:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "invalid_return_status",
            "That is not a return status we know.",
        ) from None


@router.get(
    "",
    summary="List return requests",
    description=(
        "Lists the orders at the logged-in owner's restaurant that have a return request, newest "
        "request first, 10 per page by default. `return_status` is `REQUESTED`, `APPROVED` or "
        "`REJECTED`, or a comma list. Each order shows the reason, the customer's name and the "
        "payment status."
    ),
    responses=described(
        {
            401: NOT_LOGGED_IN,
            403: "Only restaurant owners can use this route.",
            404: "This owner has no restaurant yet (`restaurant_not_found`).",
            422: "Unknown return status (`invalid_return_status`).",
        }
    ),
)
def list_returns(
    owner: Owner,
    db: DbSession,
    statuses: Annotated[list[ReturnStatus], Depends(parse_return_statuses)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=50)] = 10,
) -> Page[OwnerOrderOut]:
    restaurant = owned_restaurant(db, owner)
    rows, total = service.list_returns_for_restaurant(db, restaurant, statuses, page, page_size)
    items = [OwnerOrderOut.model_validate(row) for row in rows]
    return Page(items=items, total=total, page=page, page_size=page_size)
