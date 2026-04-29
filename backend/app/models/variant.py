"""Variant definition ORM models.

These models are intentionally not wired to API routes or game flow yet.
They are the persistence shape for a future Alembic-managed VariantDefinition
registry.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from . import Base


IdColumn = BigInteger().with_variant(Integer, "sqlite")


variant_modifier_links = Table(
    "variant_modifier_links",
    Base.metadata,
    Column(
        "variant_id",
        IdColumn,
        ForeignKey("variants.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "modifier_id",
        IdColumn,
        ForeignKey("variant_modifiers.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class TimestampColumns:
    """Shared created/updated timestamps for variant metadata tables."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(),
        nullable=False,
        default=func.now(),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(),
        nullable=False,
        default=func.now(),
        server_default=func.now(),
        onupdate=func.now(),
    )


class Variant(Base, TimestampColumns):
    """Top-level poker variant metadata."""

    __tablename__ = "variants"
    __table_args__ = (UniqueConstraint("variant_key", name="uq_variants_variant_key"),)

    id: Mapped[int] = mapped_column(IdColumn, primary_key=True, autoincrement=True)
    variant_key: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    base_game: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    deck_type: Mapped[str] = mapped_column(String(32), nullable=False)
    min_players: Mapped[int] = mapped_column(Integer, nullable=False)
    max_players: Mapped[int] = mapped_column(Integer, nullable=False)
    evaluator_id: Mapped[int] = mapped_column(
        IdColumn,
        ForeignKey("variant_evaluators.id"),
        nullable=False,
        index=True,
    )
    betting_structure_id: Mapped[int] = mapped_column(
        IdColumn,
        ForeignKey("variant_betting_structures.id"),
        nullable=False,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=true())
    is_official: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=true())
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    rule: Mapped[Optional["VariantRule"]] = relationship(
        back_populates="variant",
        cascade="all, delete-orphan",
        lazy="selectin",
        uselist=False,
    )
    modifiers: Mapped[List["VariantModifier"]] = relationship(
        secondary=variant_modifier_links,
        back_populates="variants",
        lazy="selectin",
    )
    evaluator: Mapped["VariantEvaluator"] = relationship(
        back_populates="variants",
        lazy="selectin",
    )
    betting_structure: Mapped["VariantBettingStructure"] = relationship(
        back_populates="variants",
        lazy="selectin",
    )


class VariantRule(Base, TimestampColumns):
    """JSON rule payloads for one variant."""

    __tablename__ = "variant_rules"
    __table_args__ = (UniqueConstraint("variant_id", name="uq_variant_rules_variant_id"),)

    id: Mapped[int] = mapped_column(IdColumn, primary_key=True, autoincrement=True)
    variant_id: Mapped[int] = mapped_column(
        IdColumn,
        ForeignKey("variants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    hole_cards: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    boards: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    betting: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    forced_bets: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    showdown: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    draw_rules: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    stud_rules: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    lowball_rules: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    special_rules: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    variant: Mapped[Variant] = relationship(back_populates="rule")


class VariantModifier(Base, TimestampColumns):
    """Reusable modifier master such as doubleBoard or bombPot."""

    __tablename__ = "variant_modifiers"
    __table_args__ = (UniqueConstraint("modifier_key", name="uq_variant_modifiers_modifier_key"),)

    id: Mapped[int] = mapped_column(IdColumn, primary_key=True, autoincrement=True)
    modifier_key: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    variants: Mapped[List[Variant]] = relationship(
        secondary=variant_modifier_links,
        back_populates="modifiers",
        lazy="selectin",
    )


class VariantEvaluator(Base, TimestampColumns):
    """Evaluator master referenced by variants."""

    __tablename__ = "variant_evaluators"
    __table_args__ = (UniqueConstraint("evaluator_key", name="uq_variant_evaluators_evaluator_key"),)

    id: Mapped[int] = mapped_column(IdColumn, primary_key=True, autoincrement=True)
    evaluator_key: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    base_game: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    split_mode: Mapped[str] = mapped_column(String(32), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=true())

    variants: Mapped[List[Variant]] = relationship(
        back_populates="evaluator",
        lazy="selectin",
    )


class VariantBettingStructure(Base, TimestampColumns):
    """Betting structure master referenced by variants."""

    __tablename__ = "variant_betting_structures"
    __table_args__ = (
        UniqueConstraint("betting_key", name="uq_variant_betting_structures_betting_key"),
    )

    id: Mapped[int] = mapped_column(IdColumn, primary_key=True, autoincrement=True)
    betting_key: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    variants: Mapped[List[Variant]] = relationship(
        back_populates="betting_structure",
        lazy="selectin",
    )
