import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None

INDEX = "ix_orders_return_status"


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column(
            "return_status",
            sa.Enum(
                "REQUESTED",
                "APPROVED",
                "REJECTED",
                name="returnstatus",
                native_enum=False,
                length=20,
            ),
            nullable=True,
        ),
    )
    op.add_column("orders", sa.Column("return_reason", sa.String(300), nullable=True))
    op.add_column(
        "orders", sa.Column("return_requested_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.create_index(INDEX, "orders", ["return_status"])


def downgrade() -> None:
    with op.batch_alter_table("orders") as batch:
        batch.drop_index(INDEX)
        batch.drop_column("return_requested_at")
        batch.drop_column("return_reason")
        batch.drop_column("return_status")
