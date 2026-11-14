from sqlalchemy import ColumnElement, Select, func, select
from sqlalchemy.orm import Session

from app.models import Restaurant

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
