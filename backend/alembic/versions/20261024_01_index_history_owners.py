"""Index authenticated history owners without trusting legacy metadata.

Revision ID: 20261024_01
Revises: 20260930_01

Existing rows intentionally remain NULL: older endpoints accepted arbitrary
metadata, so its owner claims are not sufficient proof of ownership.
"""
from alembic import op
import sqlalchemy as sa

revision = "20261024_01"
down_revision = "20260930_01"
branch_labels = None
depends_on = None

TABLES = ("badugi_hand_logs", "badugi_action_logs")


def upgrade() -> None:
    for table in TABLES:
        inspector = sa.inspect(op.get_bind())
        if not any(column["name"] == "owner_user_id" for column in inspector.get_columns(table)):
            op.add_column(table, sa.Column("owner_user_id", sa.Integer(), nullable=True))
        index = f"ix_{table}_owner_user_id"
        if not any(item["name"] == index for item in sa.inspect(op.get_bind()).get_indexes(table)):
            op.create_index(index, table, ["owner_user_id"])


def downgrade() -> None:
    for table in reversed(TABLES):
        op.drop_index(f"ix_{table}_owner_user_id", table_name=table)
        op.drop_column(table, "owner_user_id")
