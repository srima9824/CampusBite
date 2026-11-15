from pydantic import BaseModel

from app.models import OrderStatus


class TopDishOut(BaseModel):
    menu_item_id: int
    name: str
    quantity: int


class OwnerStatsOut(BaseModel):
    total_orders: int
    revenue: int
    orders_today: int
    by_status: dict[OrderStatus, int]
    top_dishes: list[TopDishOut]
    average_rating: float | None
    review_count: int
