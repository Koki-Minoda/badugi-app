"""add shared p2p state read limits

Revision ID: 20260831_01
Revises: 20260828_01
"""
from alembic import op
import sqlalchemy as sa


revision = "20260831_01"
down_revision = "20260828_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("p2p_state_read_limits"):
        return
    op.create_table(
        "p2p_state_read_limits",
        sa.Column("room_code", sa.String(length=12), primary_key=True),
        sa.Column("user_id", sa.String(length=64), primary_key=True),
        sa.Column("window_started_at", sa.Float(), nullable=False),
        sa.Column("request_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.Float(), nullable=False),
    )
    op.create_index(
        "ix_p2p_state_read_limits_updated_at",
        "p2p_state_read_limits",
        ["updated_at"],
    )


def downgrade() -> None:
    if not sa.inspect(op.get_bind()).has_table("p2p_state_read_limits"):
        return
    op.drop_index(
        "ix_p2p_state_read_limits_updated_at",
        table_name="p2p_state_read_limits",
    )
    op.drop_table("p2p_state_read_limits")
