from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.docs import described
from app.errors import api_error
from app.models import MenuItem, Restaurant
from app.pagination import MAX_PAGE
from app.schemas.public_reviews import PublicReviewOut
from app.schemas.restaurants import Page
from app.services import public_reviews as service

router = APIRouter(tags=["reviews"])

DbSession = Annotated[Session, Depends(get_db)]
Rating = Annotated[int | None, Query(ge=1, le=5)]
PageNumber = Annotated[int, Query(ge=1, le=MAX_PAGE)]
PageSize = Annotated[int, Query(ge=1, le=50)]

PRIVACY_NOTE = (
    "The reviewer is shown as first name and last initial, for example `Maya P.`. Email, full "
    "name, order id and address are never shown."
)


@router.get(
    "/restaurants/{restaurant_id}/reviews",
    summary="Read a restaurant's reviews",
    description=(
        "Lists the reviews customers left for a restaurant, newest first, 10 per page by default. "
        "Anyone can use this route. `rating` shows only reviews with that many stars. Each review "
        f"also lists the dishes in the reviewed order. {PRIVACY_NOTE}"
    ),
    responses=described({404: "No restaurant with this id (`restaurant_not_found`)."}),
)
def list_restaurant_reviews(
    restaurant_id: int,
    db: DbSession,
    rating: Rating = None,
    page: PageNumber = 1,
    page_size: PageSize = 10,
) -> Page[PublicReviewOut]:
    if db.get(Restaurant, restaurant_id) is None:
        raise api_error(
            status.HTTP_404_NOT_FOUND, "restaurant_not_found", "This restaurant does not exist."
        )
    query = service.restaurant_reviews_query(restaurant_id)
    items, total = service.list_reviews(db, query, rating, page, page_size)
    return Page(items=items, total=total, page=page, page_size=page_size)


@router.get(
    "/menu-items/{menu_item_id}/reviews",
    summary="Read the reviews for a dish",
    description=(
        "Lists the reviews of delivered orders that included this dish, newest first, 10 per page "
        "by default. Anyone can use this route. A review is for a whole order, not for one dish, "
        "so a review of an order with several dishes appears under each of them. `rating` shows "
        f"only reviews with that many stars. {PRIVACY_NOTE}"
    ),
    responses=described({404: "No dish with this id (`menu_item_not_found`)."}),
)
def list_dish_reviews(
    menu_item_id: int,
    db: DbSession,
    rating: Rating = None,
    page: PageNumber = 1,
    page_size: PageSize = 10,
) -> Page[PublicReviewOut]:
    if db.get(MenuItem, menu_item_id) is None:
        raise api_error(
            status.HTTP_404_NOT_FOUND, "menu_item_not_found", "This dish does not exist."
        )
    query = service.dish_reviews_query(menu_item_id)
    items, total = service.list_reviews(db, query, rating, page, page_size)
    return Page(items=items, total=total, page=page, page_size=page_size)
