from dataclasses import dataclass

from sqlalchemy import ColumnElement, Select, func, select
from sqlalchemy.orm import Session

from app.models import MenuItem, Restaurant

LIKE_ESCAPE = "\\"


def contains_pattern(term: str) -> str:
    escaped = term.replace(LIKE_ESCAPE, LIKE_ESCAPE * 2).replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def contains(column: ColumnElement[str], term: str) -> ColumnElement[bool]:
    return column.ilike(contains_pattern(term), escape=LIKE_ESCAPE)


def count_rows[T](db: Session, query: Select[tuple[T]]) -> int:
    return db.scalar(select(func.count()).select_from(query.order_by(None).subquery())) or 0


def get_restaurant(db: Session, restaurant_id: int) -> Restaurant | None:
    return db.get(Restaurant, restaurant_id)


def search_restaurants(
    db: Session, q: str | None, page: int, page_size: int
) -> tuple[list[Restaurant], int]:
    query = select(Restaurant)
    if q:
        query = query.where(contains(Restaurant.name, q) | contains(Restaurant.cuisine, q))
    total = count_rows(db, query)
    rows = db.scalars(query.order_by(Restaurant.id).limit(page_size).offset((page - 1) * page_size))
    return list(rows), total


@dataclass(frozen=True)
class MenuFilters:
    q: str | None = None
    min_price: int | None = None
    max_price: int | None = None
    is_veg: bool | None = None


def menu_query(restaurant_id: int, filters: MenuFilters) -> Select[tuple[MenuItem]]:
    query = select(MenuItem).where(MenuItem.restaurant_id == restaurant_id)
    if filters.q:
        query = query.where(contains(MenuItem.name, filters.q))
    if filters.min_price is not None:
        query = query.where(MenuItem.price >= filters.min_price)
    if filters.max_price is not None:
        query = query.where(MenuItem.price <= filters.max_price)
    if filters.is_veg is not None:
        query = query.where(MenuItem.is_veg == filters.is_veg)
    return query


def search_menu(
    db: Session, restaurant_id: int, filters: MenuFilters, page: int, page_size: int
) -> tuple[list[MenuItem], int]:
    query = menu_query(restaurant_id, filters)
    total = count_rows(db, query)
    rows = db.scalars(query.order_by(MenuItem.id).limit(page_size).offset((page - 1) * page_size))
    return list(rows), total
