from datetime import datetime

from pydantic import BaseModel

from app.models import OrderStatus


class ReminderOut(BaseModel):
    id: int
    order_id: int
    order_status: OrderStatus
    created_at: datetime
    minutes_waiting: int
