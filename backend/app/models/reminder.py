from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.order import OrderStatus
from app.models.restaurant import utc_now


class AdminReminderLog(Base):
    __tablename__ = "admin_reminder_logs"
    __table_args__ = (
        UniqueConstraint("order_id", "order_status", name="uq_admin_reminder_logs_order_status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id"), index=True)
    order_status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, native_enum=False, length=20)
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
