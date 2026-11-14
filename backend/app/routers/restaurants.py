from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.errors import api_error
from app.models import Restaurant
from app.schemas.restaurants import Page, RestaurantOut
from app.services import restaurants as service

router = APIRouter(prefix="/restaurants", tags=["restaurants"])

DbSession = Annotated[Session, Depends(get_db)]


def require_restaurant(db: Session, restaurant_id: int) -> Restaurant:
    restaurant = service.get_restaurant(db, restaurant_id)
    if restaurant is None:
        raise api_error(
            status.HTTP_404_NOT_FOUND, "restaurant_not_found", "This restaurant does not exist."
        )
    return restaurant


@router.get("")
def list_restaurants(
    db: DbSession,
    q: Annotated[str | None, Query(max_length=80)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=50)] = 12,
) -> Page[RestaurantOut]:
    rows, total = service.search_restaurants(db, q, page, page_size)
    items = [RestaurantOut.model_validate(row) for row in rows]
    return Page(items=items, total=total, page=page, page_size=page_size)


@router.get("/{restaurant_id}")
def get_restaurant(restaurant_id: int, db: DbSession) -> RestaurantOut:
    return RestaurantOut.model_validate(require_restaurant(db, restaurant_id))
