from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_roles
from app.docs import NOT_LOGGED_IN, described
from app.errors import api_error
from app.models import MenuItem, Restaurant, Role, User
from app.schemas.owner_menu import AvailabilityUpdate, MenuItemCreate, MenuItemUpdate
from app.schemas.restaurants import MenuItemOut, Page
from app.services import owner_menu as service
from app.services.restaurants import MenuFilters, search_menu

router = APIRouter(prefix="/owner/menu", tags=["owner menu"])

DbSession = Annotated[Session, Depends(get_db)]
Owner = Annotated[User, Depends(require_roles(Role.RESTAURANT_OWNER))]


def owned_restaurant(db: Session, owner: User) -> Restaurant:
    restaurant = service.get_owned_restaurant(db, owner)
    if restaurant is None:
        raise api_error(
            status.HTTP_404_NOT_FOUND, "restaurant_not_found", "You do not have a restaurant yet."
        )
    return restaurant


def owned_item(db: Session, owner: User, item_id: int) -> MenuItem:
    item = service.get_owned_item(db, owned_restaurant(db, owner), item_id)
    if item is None:
        raise api_error(
            status.HTTP_404_NOT_FOUND, "menu_item_not_found", "This dish is not on your menu."
        )
    return item


def dish_name_taken() -> HTTPException:
    return api_error(
        status.HTTP_409_CONFLICT, "dish_name_taken", "Your menu already has a dish with this name."
    )


@router.get(
    "",
    summary="List my dishes",
    description=(
        "Lists every dish on the logged-in owner's menu, including unavailable ones. The "
        "restaurant "
        "is found from the login, so an owner only ever sees their own menu. `q` searches dish "
        "names."
    ),
    responses=described(
        {
            401: NOT_LOGGED_IN,
            403: "Only restaurant owners can use this route.",
            404: "This owner has no restaurant yet (`restaurant_not_found`).",
        }
    ),
)
def list_own_menu(
    owner: Owner,
    db: DbSession,
    q: Annotated[str | None, Query(max_length=80)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=50)] = 50,
) -> Page[MenuItemOut]:
    restaurant = owned_restaurant(db, owner)
    rows, total = search_menu(db, restaurant.id, MenuFilters(q=q), page, page_size)
    items = [MenuItemOut.model_validate(row) for row in rows]
    return Page(items=items, total=total, page=page, page_size=page_size)


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Add a dish",
    description=(
        "Adds a dish to the logged-in owner's menu. The price is in whole rupees (1 to 100000). "
        "The new dish starts as available. A dish name can be used only once per restaurant."
    ),
    responses=described(
        {
            401: NOT_LOGGED_IN,
            403: "Only restaurant owners can use this route.",
            404: "This owner has no restaurant yet (`restaurant_not_found`).",
            409: "The menu already has a dish with this name (`dish_name_taken`).",
            422: "A field is not valid, or the body has fields that are not allowed.",
        }
    ),
)
def add_dish(data: MenuItemCreate, owner: Owner, db: DbSession) -> MenuItemOut:
    try:
        item = service.create_item(db, owned_restaurant(db, owner), data)
    except service.DuplicateDishName:
        raise dish_name_taken() from None
    return MenuItemOut.model_validate(item)


@router.patch(
    "/{item_id}",
    summary="Edit a dish",
    description=(
        "Changes only the fields that are sent: name, description, category, price or veg flag. "
        "At least one field is needed, and a field cannot be null. Prices on orders that were "
        "already placed do not change. An owner cannot edit another restaurant's dish."
    ),
    responses=described(
        {
            401: NOT_LOGGED_IN,
            403: "Only restaurant owners can use this route.",
            404: "This dish is not on the owner's menu (`menu_item_not_found`).",
            409: "The menu already has a dish with this name (`dish_name_taken`).",
            422: "A field is not valid, or nothing was sent to change.",
        }
    ),
)
def edit_dish(item_id: int, data: MenuItemUpdate, owner: Owner, db: DbSession) -> MenuItemOut:
    try:
        item = service.update_item(db, owned_item(db, owner, item_id), data)
    except service.DuplicateDishName:
        raise dish_name_taken() from None
    return MenuItemOut.model_validate(item)


@router.patch(
    "/{item_id}/availability",
    summary="Mark a dish available or unavailable",
    description=(
        "Turns a dish on or off. Unavailable dishes still show on the menu but cannot be ordered."
    ),
    responses=described(
        {
            401: NOT_LOGGED_IN,
            403: "Only restaurant owners can use this route.",
            404: "This dish is not on the owner's menu (`menu_item_not_found`).",
        }
    ),
)
def set_dish_availability(
    item_id: int, data: AvailabilityUpdate, owner: Owner, db: DbSession
) -> MenuItemOut:
    item = service.set_availability(db, owned_item(db, owner, item_id), data.is_available)
    return MenuItemOut.model_validate(item)
