from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_roles
from app.dependencies.owner import owned_restaurant
from app.docs import NOT_LOGGED_IN, described
from app.models import Role, User
from app.schemas.owner_stats import OwnerStatsOut
from app.services import owner_stats as service

router = APIRouter(prefix="/owner/stats", tags=["owner orders"])

DbSession = Annotated[Session, Depends(get_db)]
Owner = Annotated[User, Depends(require_roles(Role.RESTAURANT_OWNER))]


@router.get(
    "",
    summary="Show my restaurant's statistics",
    description=(
        "Basic numbers for the logged-in owner's restaurant: `total_orders`, `revenue` in whole "
        "rupees, `orders_today` (today in India time), the number of orders in each status, the "
        "five best-selling dishes, and the average rating with its review count. Revenue and top "
        "dishes count only orders whose payment is still `mock_paid`, so cancelled and refunded "
        "orders are left out."
    ),
    responses=described(
        {
            401: NOT_LOGGED_IN,
            403: "Only restaurant owners can use this route.",
            404: "This owner has no restaurant yet (`restaurant_not_found`).",
        }
    ),
)
def show_stats(owner: Owner, db: DbSession) -> OwnerStatsOut:
    return service.restaurant_stats(db, owned_restaurant(db, owner))
