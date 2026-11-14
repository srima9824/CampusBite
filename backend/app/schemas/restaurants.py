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


class Page[T](BaseModel):
    items: list[T]
    total: int
    page: int
    page_size: int
