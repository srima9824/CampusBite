from fastapi import status
from sqlalchemy.orm import Session

from app.errors import api_error
from app.models import Restaurant, User
from app.services import owner_menu as service


def owned_restaurant(db: Session, owner: User) -> Restaurant:
    restaurant = service.get_owned_restaurant(db, owner)
    if restaurant is None:
        raise api_error(
            status.HTTP_404_NOT_FOUND, "restaurant_not_found", "You do not have a restaurant yet."
        )
    return restaurant
