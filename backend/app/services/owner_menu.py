from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import MenuItem, Restaurant, User
from app.schemas.owner_menu import MenuItemCreate, MenuItemUpdate


class DuplicateDishName(Exception):
    pass


def get_owned_restaurant(db: Session, owner: User) -> Restaurant | None:
    return db.scalar(select(Restaurant).where(Restaurant.owner_id == owner.id))


def get_owned_item(db: Session, restaurant: Restaurant, item_id: int) -> MenuItem | None:
    return db.scalar(
        select(MenuItem).where(MenuItem.id == item_id, MenuItem.restaurant_id == restaurant.id)
    )


def save(db: Session, item: MenuItem) -> MenuItem:
    db.add(item)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise DuplicateDishName from None
    return item


def create_item(db: Session, restaurant: Restaurant, data: MenuItemCreate) -> MenuItem:
    return save(db, MenuItem(restaurant_id=restaurant.id, **data.model_dump()))


def update_item(db: Session, item: MenuItem, data: MenuItemUpdate) -> MenuItem:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    return save(db, item)


def set_availability(db: Session, item: MenuItem, is_available: bool) -> MenuItem:
    item.is_available = is_available
    return save(db, item)
