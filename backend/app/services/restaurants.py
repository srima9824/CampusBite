from dataclasses import dataclass

from sqlalchemy import ColumnElement, Select, func, select
from sqlalchemy.orm import Session

from app.models import MenuItem, Restaurant, Review

LIKE_ESCAPE = "\\"


def contains_pattern(term: str) -> str:
    escaped = term.replace(LIKE_ESCAPE, LIKE_ESCAPE * 2).replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def contains(column: ColumnElement[str], term: str) -> ColumnElement[bool]:
    return column.ilike(contains_pattern(term), escape=LIKE_ESCAPE)


def count_rows[T](db: Session, query: Select[tuple[T]]) -> int:
    return db.scalar(select(func.count()).select_from(query.order_by(None).subquery())) or 0


@dataclass(frozen=True)
class RatedRestaurant:
    restaurant: Restaurant
    average_rating: float | None
    review_count: int


def get_restaurant(db: Session, restaurant_id: int) -> Restaurant | None:
    return db.get(Restaurant, restaurant_id)


def rated_restaurants_query() -> Select[tuple[Restaurant, float | None, int | None]]:
    ratings = (
        select(
            Review.restaurant_id.label("restaurant_id"),
            func.avg(Review.rating).label("average"),
            func.count(Review.id).label("count"),
        )
        .group_by(Review.restaurant_id)
        .subquery()
    )
    return select(Restaurant, ratings.c.average, ratings.c.count).outerjoin(
        ratings, ratings.c.restaurant_id == Restaurant.id
    )


def as_rated(row: tuple[Restaurant, float | None, int | None]) -> RatedRestaurant:
    restaurant, average, count = row
    rounded = None if average is None else round(float(average), 1)
    return RatedRestaurant(restaurant, rounded, count or 0)


def get_rated_restaurant(db: Session, restaurant_id: int) -> RatedRestaurant | None:
    row = db.execute(rated_restaurants_query().where(Restaurant.id == restaurant_id)).first()
    return None if row is None else as_rated(row)


def search_restaurants(
    db: Session, q: str | None, page: int, page_size: int
) -> tuple[list[RatedRestaurant], int]:
    query = rated_restaurants_query()
    if q:
        query = query.where(contains(Restaurant.name, q) | contains(Restaurant.cuisine, q))
    total = count_rows(db, query)
    rows = db.execute(query.order_by(Restaurant.id).limit(page_size).offset((page - 1) * page_size))
    return [as_rated(row) for row in rows], total


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
