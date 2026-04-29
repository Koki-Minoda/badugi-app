"""add variant definition tables

Revision ID: 20260429_01
Revises: 20260212_01
Create Date: 2026-04-29 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260429_01"
down_revision = "20260212_01"
branch_labels = None
depends_on = None


ID_TYPE = sa.BigInteger().with_variant(sa.Integer(), "sqlite")


def upgrade() -> None:
    op.create_table(
        "variant_evaluators",
        sa.Column("id", ID_TYPE, primary_key=True, autoincrement=True),
        sa.Column("evaluator_key", sa.String(length=128), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("base_game", sa.String(length=32), nullable=False),
        sa.Column("split_mode", sa.String(length=32), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("evaluator_key", name="uq_variant_evaluators_evaluator_key"),
    )
    op.create_index("ix_variant_evaluators_evaluator_key", "variant_evaluators", ["evaluator_key"])
    op.create_index("ix_variant_evaluators_base_game", "variant_evaluators", ["base_game"])

    op.create_table(
        "variant_betting_structures",
        sa.Column("id", ID_TYPE, primary_key=True, autoincrement=True),
        sa.Column("betting_key", sa.String(length=128), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("betting_key", name="uq_variant_betting_structures_betting_key"),
    )
    op.create_index(
        "ix_variant_betting_structures_betting_key",
        "variant_betting_structures",
        ["betting_key"],
    )

    op.create_table(
        "variant_modifiers",
        sa.Column("id", ID_TYPE, primary_key=True, autoincrement=True),
        sa.Column("modifier_key", sa.String(length=128), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("modifier_key", name="uq_variant_modifiers_modifier_key"),
    )
    op.create_index("ix_variant_modifiers_modifier_key", "variant_modifiers", ["modifier_key"])

    op.create_table(
        "variants",
        sa.Column("id", ID_TYPE, primary_key=True, autoincrement=True),
        sa.Column("variant_key", sa.String(length=128), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("base_game", sa.String(length=32), nullable=False),
        sa.Column("deck_type", sa.String(length=32), nullable=False),
        sa.Column("min_players", sa.Integer(), nullable=False),
        sa.Column("max_players", sa.Integer(), nullable=False),
        sa.Column("evaluator_id", ID_TYPE, nullable=False),
        sa.Column("betting_structure_id", ID_TYPE, nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_official", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(("evaluator_id",), ("variant_evaluators.id",)),
        sa.ForeignKeyConstraint(("betting_structure_id",), ("variant_betting_structures.id",)),
        sa.UniqueConstraint("variant_key", name="uq_variants_variant_key"),
    )
    op.create_index("ix_variants_variant_key", "variants", ["variant_key"])
    op.create_index("ix_variants_base_game", "variants", ["base_game"])
    op.create_index("ix_variants_evaluator_id", "variants", ["evaluator_id"])
    op.create_index("ix_variants_betting_structure_id", "variants", ["betting_structure_id"])

    op.create_table(
        "variant_rules",
        sa.Column("id", ID_TYPE, primary_key=True, autoincrement=True),
        sa.Column("variant_id", ID_TYPE, nullable=False),
        sa.Column("hole_cards", sa.JSON(), nullable=False),
        sa.Column("boards", sa.JSON(), nullable=False),
        sa.Column("betting", sa.JSON(), nullable=False),
        sa.Column("forced_bets", sa.JSON(), nullable=False),
        sa.Column("showdown", sa.JSON(), nullable=False),
        sa.Column("draw_rules", sa.JSON(), nullable=True),
        sa.Column("stud_rules", sa.JSON(), nullable=True),
        sa.Column("lowball_rules", sa.JSON(), nullable=True),
        sa.Column("special_rules", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(("variant_id",), ("variants.id",), ondelete="CASCADE"),
        sa.UniqueConstraint("variant_id", name="uq_variant_rules_variant_id"),
    )
    op.create_index("ix_variant_rules_variant_id", "variant_rules", ["variant_id"])

    op.create_table(
        "variant_modifier_links",
        sa.Column("variant_id", ID_TYPE, nullable=False),
        sa.Column("modifier_id", ID_TYPE, nullable=False),
        sa.ForeignKeyConstraint(("variant_id",), ("variants.id",), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(("modifier_id",), ("variant_modifiers.id",), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("variant_id", "modifier_id"),
    )


def downgrade() -> None:
    op.drop_table("variant_modifier_links")
    op.drop_index("ix_variant_rules_variant_id", table_name="variant_rules")
    op.drop_table("variant_rules")
    op.drop_index("ix_variants_betting_structure_id", table_name="variants")
    op.drop_index("ix_variants_evaluator_id", table_name="variants")
    op.drop_index("ix_variants_base_game", table_name="variants")
    op.drop_index("ix_variants_variant_key", table_name="variants")
    op.drop_table("variants")
    op.drop_index("ix_variant_modifiers_modifier_key", table_name="variant_modifiers")
    op.drop_table("variant_modifiers")
    op.drop_index(
        "ix_variant_betting_structures_betting_key",
        table_name="variant_betting_structures",
    )
    op.drop_table("variant_betting_structures")
    op.drop_index("ix_variant_evaluators_base_game", table_name="variant_evaluators")
    op.drop_index("ix_variant_evaluators_evaluator_key", table_name="variant_evaluators")
    op.drop_table("variant_evaluators")
