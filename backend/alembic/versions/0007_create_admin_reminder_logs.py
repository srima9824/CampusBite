import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
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


def upgrade() -> None:
    op.create_table(
        "admin_reminder_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id"), nullable=False),
        sa.Column("restaurant_id", sa.Integer(), sa.ForeignKey("restaurants.id"), nullable=False),
        sa.Column(
            "order_status",
            sa.Enum(*ORDER_STATUSES, name="orderstatus", native_enum=False, length=20),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("order_id", "order_status", name="uq_admin_reminder_logs_order_status"),
    )
    op.create_index("ix_admin_reminder_logs_order_id", "admin_reminder_logs", ["order_id"])
    op.create_index(
        "ix_admin_reminder_logs_restaurant_id", "admin_reminder_logs", ["restaurant_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_admin_reminder_logs_restaurant_id", table_name="admin_reminder_logs")
    op.drop_index("ix_admin_reminder_logs_order_id", table_name="admin_reminder_logs")
    op.drop_table("admin_reminder_logs")
