from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.errors import api_error
from app.models import Restaurant
from app.schemas.restaurants import MenuItemOut, Page, RestaurantOut
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


def check_price_range(min_price: int | None, max_price: int | None) -> None:
    if min_price is not None and max_price is not None and min_price > max_price:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "invalid_price_range",
            "The minimum price is higher than the maximum.",
        )


@router.get("/{restaurant_id}/menu")
def list_menu(
    restaurant_id: int,
    db: DbSession,
    q: Annotated[str | None, Query(max_length=80)] = None,
    min_price: Annotated[int | None, Query(ge=0)] = None,
    max_price: Annotated[int | None, Query(ge=0)] = None,
    veg: Literal["veg", "non_veg"] | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=50)] = 50,
) -> Page[MenuItemOut]:
    check_price_range(min_price, max_price)
    require_restaurant(db, restaurant_id)
    is_veg = None if veg is None else veg == "veg"
    filters = service.MenuFilters(q, min_price, max_price, is_veg)
    rows, total = service.search_menu(db, restaurant_id, filters, page, page_size)
    items = [MenuItemOut.model_validate(row) for row in rows]
    return Page(items=items, total=total, page=page, page_size=page_size)
