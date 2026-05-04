"""add play feedback results

Revision ID: 20260504_01
Revises: 20260429_01
Create Date: 2026-05-04 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = "20260504_01"
down_revision = "20260429_01"
branch_labels = None
depends_on = None


ID_TYPE = sa.BigInteger().with_variant(sa.Integer(), "sqlite")


def upgrade() -> None:
    op.create_table(
        "play_feedback_results",
        sa.Column("id", ID_TYPE, primary_key=True, autoincrement=True),
        sa.Column("user_id", ID_TYPE, nullable=True),
        sa.Column("session_key", sa.String(length=255), nullable=False),
        sa.Column("mode", sa.String(length=32), nullable=False),
        sa.Column("variant_scope", sa.String(length=64), nullable=False),
        sa.Column("tournament_id", sa.String(length=128), nullable=True),
        sa.Column("hand_count", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("pii_removed", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("response", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(("user_id",), ("users.id",), ondelete="SET NULL"),
    )
    op.create_index("ix_play_feedback_results_user_id", "play_feedback_results", ["user_id"])
    op.create_index("ix_play_feedback_results_session_key", "play_feedback_results", ["session_key"])
    op.create_index("ix_play_feedback_results_mode", "play_feedback_results", ["mode"])
    op.create_index("ix_play_feedback_results_variant_scope", "play_feedback_results", ["variant_scope"])
    op.create_index("ix_play_feedback_results_tournament_id", "play_feedback_results", ["tournament_id"])
    op.create_index("ix_play_feedback_results_created_at", "play_feedback_results", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_play_feedback_results_created_at", table_name="play_feedback_results")
    op.drop_index("ix_play_feedback_results_tournament_id", table_name="play_feedback_results")
    op.drop_index("ix_play_feedback_results_variant_scope", table_name="play_feedback_results")
    op.drop_index("ix_play_feedback_results_mode", table_name="play_feedback_results")
    op.drop_index("ix_play_feedback_results_session_key", table_name="play_feedback_results")
    op.drop_index("ix_play_feedback_results_user_id", table_name="play_feedback_results")
    op.drop_table("play_feedback_results")
