"""reconcile legacy core tables for clean database installs

Revision ID: 20260828_01
Revises: 20260827_01
Create Date: 2026-08-28 00:00:00.000000

The original users and hand-history tables predate the Alembic chain. Existing
production databases already contain them, while a clean ``upgrade head`` did
not. This migration creates only tables that are absent so it is safe for both
database histories.
"""

from alembic import op
import sqlalchemy as sa


revision = "20260828_01"
down_revision = "20260827_01"
branch_labels = None
depends_on = None


def _has_table(name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(name)


def upgrade() -> None:
    if not _has_table("users"):
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("name", sa.String(length=255), nullable=True),
            sa.Column("email", sa.String(length=255), nullable=False),
            sa.Column("hashed_password", sa.String(length=255), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("email", name="uq_users_email"),
        )
        op.create_index("ix_users_email", "users", ["email"], unique=True)

    hand_id_type = sa.BigInteger().with_variant(sa.Integer(), "sqlite")
    if not _has_table("badugi_hand_logs"):
        op.create_table(
            "badugi_hand_logs",
            sa.Column("id", hand_id_type, primary_key=True, autoincrement=True),
            sa.Column("hand_id", sa.String(length=64), nullable=False),
            sa.Column("table_id", sa.String(length=64), nullable=True),
            sa.Column("tournament_id", sa.String(length=64), nullable=True),
            sa.Column("level", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("metadata", sa.JSON(), nullable=True),
            sa.UniqueConstraint("hand_id", name="uq_badugi_hand_logs_hand_id"),
        )
        op.create_index("ix_badugi_hand_logs_hand_id", "badugi_hand_logs", ["hand_id"], unique=True)
        op.create_index("ix_badugi_hand_logs_table_id", "badugi_hand_logs", ["table_id"])
        op.create_index("ix_badugi_hand_logs_tournament_id", "badugi_hand_logs", ["tournament_id"])

    if not _has_table("badugi_hand_actions"):
        op.create_table(
            "badugi_hand_actions",
            sa.Column("id", hand_id_type, primary_key=True, autoincrement=True),
            sa.Column(
                "hand_log_id",
                hand_id_type,
                sa.ForeignKey("badugi_hand_logs.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("seat_index", sa.Integer(), nullable=False),
            sa.Column("player_id", sa.String(length=64), nullable=True),
            sa.Column("action", sa.String(length=32), nullable=False),
            sa.Column("amount", sa.Integer(), nullable=True),
            sa.Column("round", sa.Integer(), nullable=False),
            sa.Column("phase", sa.String(length=32), nullable=False),
        )
        op.create_index("ix_badugi_hand_actions_hand_log_id", "badugi_hand_actions", ["hand_log_id"])

    if not _has_table("badugi_hand_results"):
        op.create_table(
            "badugi_hand_results",
            sa.Column("id", hand_id_type, primary_key=True, autoincrement=True),
            sa.Column(
                "hand_log_id",
                hand_id_type,
                sa.ForeignKey("badugi_hand_logs.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("seat_index", sa.Integer(), nullable=False),
            sa.Column("player_id", sa.String(length=64), nullable=True),
            sa.Column("final_stack", sa.Integer(), nullable=False),
            sa.Column("hand_label", sa.String(length=128), nullable=True),
            sa.Column("is_winner", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("pot_share", sa.Integer(), nullable=False),
        )
        op.create_index("ix_badugi_hand_results_hand_log_id", "badugi_hand_results", ["hand_log_id"])

    # Revision 20260212_01 used BIGINT for this autoincrement key. SQLite only
    # autoincrements a column declared exactly INTEGER PRIMARY KEY, so clean
    # test/dev installs could read the table but every telemetry insert failed.
    # Production MySQL keeps its BIGINT unchanged.
    bind = op.get_bind()
    if bind.dialect.name == "sqlite" and _has_table("badugi_action_logs"):
        id_column = next(
            column
            for column in sa.inspect(bind).get_columns("badugi_action_logs")
            if column["name"] == "id"
        )
        if isinstance(id_column["type"], sa.BigInteger):
            with op.batch_alter_table("badugi_action_logs", recreate="always") as batch_op:
                batch_op.alter_column(
                    "id",
                    existing_type=sa.BigInteger(),
                    type_=sa.Integer(),
                    existing_nullable=False,
                    autoincrement=True,
                )


def downgrade() -> None:
    # These tables can predate Alembic in production. Dropping them would risk
    # deleting user accounts and hand history, so this reconciliation is
    # intentionally non-destructive on downgrade.
    pass
