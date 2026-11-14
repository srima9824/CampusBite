import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

ORDER_STATUSES = (
    "PLACED",
    "ACCEPTED",
    "PREPARING",
    "READY",
    "ASSIGNED",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED",
    "REFUNDED",
)


def payment_status() -> sa.Enum:
    return sa.Enum("mock_paid", "refunded", name="paymentstatus", native_enum=False, length=20)


def upgrade() -> None:
    op.create_table(
        "orders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("customer_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("restaurant_id", sa.Integer(), sa.ForeignKey("restaurants.id"), nullable=False),
        sa.Column(
            "status",
            sa.Enum(*ORDER_STATUSES, name="orderstatus", native_enum=False, length=20),
            nullable=False,
        ),
        sa.Column("total", sa.Integer(), nullable=False),
        sa.Column("delivery_address", sa.String(200), nullable=False),
        sa.Column("notes", sa.String(200), nullable=True),
        sa.Column("payment_status", payment_status(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("total > 0", name="ck_orders_total_positive"),
    )
    op.create_index("ix_orders_customer_id", "orders", ["customer_id"])
    op.create_index("ix_orders_restaurant_id", "orders", ["restaurant_id"])
    op.create_index("ix_orders_status", "orders", ["status"])
    op.create_table(
        "order_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id"), nullable=False),
        sa.Column("menu_item_id", sa.Integer(), sa.ForeignKey("menu_items.id"), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("unit_price", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("line_total", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            "quantity >= 1 AND quantity <= 20", name="ck_order_items_quantity_range"
        ),
        sa.CheckConstraint("unit_price > 0", name="ck_order_items_unit_price_positive"),
        sa.CheckConstraint("line_total > 0", name="ck_order_items_line_total_positive"),
    )
    op.create_index("ix_order_items_order_id", "order_items", ["order_id"])
    op.create_table(
        "payment_ledger",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id"), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("method", sa.String(20), nullable=False),
        sa.Column("status", payment_status(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("amount > 0", name="ck_payment_ledger_amount_positive"),
    )
    op.create_index("ix_payment_ledger_order_id", "payment_ledger", ["order_id"])


def downgrade() -> None:
    op.drop_index("ix_payment_ledger_order_id", table_name="payment_ledger")
    op.drop_table("payment_ledger")
    op.drop_index("ix_order_items_order_id", table_name="order_items")
    op.drop_table("order_items")
    op.drop_index("ix_orders_status", table_name="orders")
    op.drop_index("ix_orders_restaurant_id", table_name="orders")
    op.drop_index("ix_orders_customer_id", table_name="orders")
    op.drop_table("orders")
