from pydantic import BaseModel, ConfigDict


class RestaurantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    cuisine: str
    description: str
    logo_key: str
    image_key: str
    is_open: bool
    average_rating: float | None = None
    review_count: int = 0


class MenuItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    restaurant_id: int
    name: str
    description: str
    category: str
    price: int
    is_veg: bool
    is_available: bool


class Page[T](BaseModel):
    items: list[T]
    total: int
    page: int
    page_size: int
