from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_roles
from app.docs import NOT_LOGGED_IN, described
from app.models import Role, User
from app.pagination import MAX_PAGE
from app.schemas.owner_orders import DeliveryPartnerOut
from app.schemas.restaurants import Page
from app.services import owner_orders as service

router = APIRouter(prefix="/owner/delivery-partners", tags=["owner orders"])

DbSession = Annotated[Session, Depends(get_db)]
Owner = Annotated[User, Depends(require_roles(Role.RESTAURANT_OWNER))]


@router.get(
    "",
    summary="List delivery partners",
    description=(
        "Lists the delivery partners an owner can assign to a `READY` order, by name. Only the id "
        "and name are shown, never an email."
    ),
    responses=described(
        {401: NOT_LOGGED_IN, 403: "Only restaurant owners can use this route."}
    ),
)
def list_delivery_partners(
    owner: Owner,
    db: DbSession,
    page: Annotated[int, Query(ge=1, le=MAX_PAGE)] = 1,
    page_size: Annotated[int, Query(ge=1, le=50)] = 50,
) -> Page[DeliveryPartnerOut]:
    rows, total = service.list_delivery_partners(db, page, page_size)
    items = [DeliveryPartnerOut.model_validate(row) for row in rows]
    return Page(items=items, total=total, page=page, page_size=page_size)
