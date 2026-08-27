"""add durable p2p room states

Revision ID: 20260827_01
Revises: 20260504_01
"""
from alembic import op
import sqlalchemy as sa


revision = "20260827_01"
down_revision = "20260504_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "p2p_room_states",
        sa.Column("room_code", sa.String(length=12), primary_key=True),
        sa.Column("owner_id", sa.String(length=64), nullable=False),
        sa.Column("sequence_id", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("closed", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_p2p_room_states_owner_id", "p2p_room_states", ["owner_id"])
    op.create_index("ix_p2p_room_states_updated_at", "p2p_room_states", ["updated_at"])


def downgrade() -> None:
    op.drop_index("ix_p2p_room_states_updated_at", table_name="p2p_room_states")
    op.drop_index("ix_p2p_room_states_owner_id", table_name="p2p_room_states")
    op.drop_table("p2p_room_states")
