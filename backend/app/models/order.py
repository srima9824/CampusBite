import enum
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.restaurant import Restaurant, utc_now
from app.models.user import User


class OrderStatus(enum.Enum):
    PLACED = "PLACED"
    ACCEPTED = "ACCEPTED"
    PREPARING = "PREPARING"
    READY = "READY"
    ASSIGNED = "ASSIGNED"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"
    REFUNDED = "REFUNDED"


class PaymentStatus(enum.Enum):
    MOCK_PAID = "mock_paid"
    REFUNDED = "refunded"


def payment_status_column() -> Enum:
    return Enum(
        PaymentStatus,
        native_enum=False,
        length=20,
        values_callable=lambda e: [m.value for m in e],
    )


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (CheckConstraint("total > 0", name="ck_orders_total_positive"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id"), index=True)
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, native_enum=False, length=20),
        default=OrderStatus.PLACED,
        index=True,
    )
    total: Mapped[int]
    delivery_address: Mapped[str] = mapped_column(String(200))
    notes: Mapped[str | None] = mapped_column(String(200))
    payment_status: Mapped[PaymentStatus] = mapped_column(
        payment_status_column(), default=PaymentStatus.MOCK_PAID
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    restaurant: Mapped[Restaurant] = relationship()
    customer: Mapped[User] = relationship()
    items: Mapped[list["OrderItem"]] = relationship(back_populates="order", order_by="OrderItem.id")


class OrderItem(Base):
    __tablename__ = "order_items"
    __table_args__ = (
        CheckConstraint("quantity >= 1 AND quantity <= 20", name="ck_order_items_quantity_range"),
        CheckConstraint("unit_price > 0", name="ck_order_items_unit_price_positive"),
        CheckConstraint("line_total > 0", name="ck_order_items_line_total_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    menu_item_id: Mapped[int] = mapped_column(ForeignKey("menu_items.id"))
    name: Mapped[str] = mapped_column(String(80))
    unit_price: Mapped[int]
    quantity: Mapped[int]
    line_total: Mapped[int]

    order: Mapped[Order] = relationship(back_populates="items")


class PaymentLedger(Base):
    __tablename__ = "payment_ledger"
    __table_args__ = (CheckConstraint("amount > 0", name="ck_payment_ledger_amount_positive"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    amount: Mapped[int]
    method: Mapped[str] = mapped_column(String(20))
    status: Mapped[PaymentStatus] = mapped_column(payment_status_column())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
