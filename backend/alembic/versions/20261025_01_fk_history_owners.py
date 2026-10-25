"""Enforce referential integrity for authenticated history owners.

Legacy rows remain NULL. An orphaned non-NULL owner aborts the upgrade before
altering either table so production data is never silently reassigned.
"""
from alembic import op
import sqlalchemy as sa

revision = "20261025_01"
down_revision = "20261024_01"
branch_labels = None
depends_on = None

TABLES = ("badugi_hand_logs", "badugi_action_logs")


def _name(table: str) -> str:
    return f"fk_{table}_owner_user_id_users"


def _owner_keys(table: str) -> list[dict]:
    return [
        key for key in sa.inspect(op.get_bind()).get_foreign_keys(table)
        if key["constrained_columns"] == ["owner_user_id"]
    ]


def upgrade() -> None:
    connection = op.get_bind()
    # Preflight both tables before the first DDL statement. MySQL DDL commits
    # implicitly, so a later orphan check would leave a half-upgraded schema.
    for table in TABLES:
        count = connection.execute(sa.text(
            f"SELECT COUNT(*) FROM {table} AS owned "
            "LEFT JOIN users AS u ON u.id = owned.owner_user_id "
            "WHERE owned.owner_user_id IS NOT NULL AND u.id IS NULL"
        )).scalar_one()
        if count:
            raise RuntimeError(f"{table} has {count} orphaned owner rows; migration stopped")
    for table in TABLES:
        existing = _owner_keys(table)
        if existing:
            matches_users = (
                len(existing) == 1
                and existing[0]["referred_table"] == "users"
                and existing[0]["referred_columns"] == ["id"]
                and existing[0].get("options", {}).get("ondelete", "").upper() == "CASCADE"
            )
            if not matches_users:
                raise RuntimeError(f"{table} already has a conflicting owner foreign key")
            continue
        with op.batch_alter_table(table) as batch:
            batch.create_foreign_key(
                _name(table), "users", ["owner_user_id"], ["id"], ondelete="CASCADE",
            )


def downgrade() -> None:
    for table in reversed(TABLES):
        if any(key["name"] == _name(table) for key in _owner_keys(table)):
            with op.batch_alter_table(table) as batch:
                batch.drop_constraint(_name(table), type_="foreignkey")
