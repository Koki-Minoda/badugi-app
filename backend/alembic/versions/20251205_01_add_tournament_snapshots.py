"""add tournament_snapshots table

Revision ID: 20251205_01
Revises:
Create Date: 2025-12-05 02:15:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20251205_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tournament_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(("user_id",), ("users.id",), ondelete="CASCADE"),
    )
    op.create_index(
        "ux_tournament_snapshots_user_id",
        "tournament_snapshots",
        ["user_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ux_tournament_snapshots_user_id", table_name="tournament_snapshots")
    op.drop_table("tournament_snapshots")

