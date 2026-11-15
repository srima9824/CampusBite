import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

FOREIGN_KEY = "fk_orders_delivery_partner_id_users"
INDEX = "ix_orders_delivery_partner_id"


def upgrade() -> None:
    with op.batch_alter_table("orders") as batch:
        batch.add_column(sa.Column("delivery_partner_id", sa.Integer(), nullable=True))
        batch.create_foreign_key(FOREIGN_KEY, "users", ["delivery_partner_id"], ["id"])
        batch.create_index(INDEX, ["delivery_partner_id"])


def downgrade() -> None:
    with op.batch_alter_table("orders") as batch:
        batch.drop_index(INDEX)
        batch.drop_constraint(FOREIGN_KEY, type_="foreignkey")
        batch.drop_column("delivery_partner_id")
