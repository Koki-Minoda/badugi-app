"""Index the bounded HUD statistics window.

Revision ID: 20260930_01
Revises: 20260831_01
"""
from alembic import op
import sqlalchemy as sa

revision = "20260930_01"
down_revision = "20260831_01"
branch_labels = None
depends_on = None

INDEX = "ix_badugi_action_logs_player_phase_ts"


def upgrade() -> None:
    indexes = sa.inspect(op.get_bind()).get_indexes("badugi_action_logs")
    if not any(index["name"] == INDEX for index in indexes):
        op.create_index(INDEX, "badugi_action_logs", ["player_id", "phase", "ts"])


def downgrade() -> None:
    op.drop_index(INDEX, table_name="badugi_action_logs")
