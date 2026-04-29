"""add badugi_action_logs table

Revision ID: 20260212_01
Revises: 20251205_01
Create Date: 2026-02-12 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260212_01"
down_revision = "20251205_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "badugi_action_logs",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("hand_id", sa.String(length=64), nullable=False),
        sa.Column("player_id", sa.String(length=64), nullable=False),
        sa.Column("seat_index", sa.Integer(), nullable=True),
        sa.Column("phase", sa.String(length=32), nullable=False),
        sa.Column("round", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("action_type", sa.String(length=32), nullable=False),
        sa.Column("paid", sa.Float(), nullable=False, server_default="0"),
        sa.Column("to_call", sa.Float(), nullable=True),
        sa.Column("is_forced", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("stack_before", sa.Float(), nullable=True),
        sa.Column("stack_after", sa.Float(), nullable=True),
        sa.Column("bet_before", sa.Float(), nullable=True),
        sa.Column("bet_after", sa.Float(), nullable=True),
        sa.Column("seq", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "ts",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_badugi_action_logs_hand_id", "badugi_action_logs", ["hand_id"])
    op.create_index("ix_badugi_action_logs_player_id", "badugi_action_logs", ["player_id"])
    op.create_index("ix_badugi_action_logs_phase", "badugi_action_logs", ["phase"])
    op.create_index("ix_badugi_action_logs_action_type", "badugi_action_logs", ["action_type"])
    op.create_index("ix_badugi_action_logs_ts", "badugi_action_logs", ["ts"])


def downgrade() -> None:
    op.drop_index("ix_badugi_action_logs_ts", table_name="badugi_action_logs")
    op.drop_index("ix_badugi_action_logs_action_type", table_name="badugi_action_logs")
    op.drop_index("ix_badugi_action_logs_phase", table_name="badugi_action_logs")
    op.drop_index("ix_badugi_action_logs_player_id", table_name="badugi_action_logs")
    op.drop_index("ix_badugi_action_logs_hand_id", table_name="badugi_action_logs")
    op.drop_table("badugi_action_logs")
