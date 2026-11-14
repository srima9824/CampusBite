import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "restaurants",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("cuisine", sa.String(40), nullable=False),
        sa.Column("description", sa.String(300), nullable=False),
        sa.Column("logo_key", sa.String(60), nullable=False),
        sa.Column("image_key", sa.String(60), nullable=False),
        sa.Column("is_open", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("owner_id", name="uq_restaurants_owner_id"),
        sa.UniqueConstraint("name", name="uq_restaurants_name"),
    )
    op.create_table(
        "menu_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("restaurant_id", sa.Integer(), sa.ForeignKey("restaurants.id"), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("description", sa.String(300), nullable=False),
        sa.Column("category", sa.String(40), nullable=False),
        sa.Column("price", sa.Integer(), nullable=False),
        sa.Column("is_veg", sa.Boolean(), nullable=False),
        sa.Column("is_available", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("restaurant_id", "name", name="uq_menu_items_restaurant_id_name"),
        sa.CheckConstraint("price > 0", name="ck_menu_items_price_positive"),
    )
    op.create_index("ix_menu_items_restaurant_id", "menu_items", ["restaurant_id"])


def downgrade() -> None:
    op.drop_index("ix_menu_items_restaurant_id", table_name="menu_items")
    op.drop_table("menu_items")
    op.drop_table("restaurants")
