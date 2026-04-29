"""CRUD helpers for VariantDefinition persistence."""
from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional

from sqlalchemy.orm import Session, selectinload

from ..models import (
    Variant,
    VariantBettingStructure,
    VariantEvaluator,
    VariantModifier,
    VariantRule,
)


def _variant_options():
    return (
        selectinload(Variant.rule),
        selectinload(Variant.modifiers),
        selectinload(Variant.evaluator),
        selectinload(Variant.betting_structure),
    )


def list_variants(db: Session) -> List[Variant]:
    """Return active variants ordered for frontend selection."""

    return (
        db.query(Variant)
        .options(*_variant_options())
        .filter(Variant.is_active.is_(True))
        .order_by(Variant.sort_order.asc(), Variant.variant_key.asc())
        .all()
    )


def get_variant_by_key(db: Session, variant_key: str) -> Optional[Variant]:
    """Return one active variant by public key."""

    if not variant_key:
        return None
    return (
        db.query(Variant)
        .options(*_variant_options())
        .filter(
            Variant.variant_key == variant_key,
            Variant.is_active.is_(True),
        )
        .one_or_none()
    )


def _get_or_create_evaluator(db: Session, data: Dict[str, Any]) -> VariantEvaluator:
    evaluator_key = data["evaluator_key"]
    evaluator = (
        db.query(VariantEvaluator)
        .filter(VariantEvaluator.evaluator_key == evaluator_key)
        .one_or_none()
    )
    if evaluator is None:
        evaluator = VariantEvaluator(evaluator_key=evaluator_key)
        db.add(evaluator)

    evaluator.name = data.get("evaluator_name") or evaluator_key
    evaluator.description = data.get("evaluator_description")
    evaluator.base_game = data.get("evaluator_base_game") or data["base_game"]
    evaluator.split_mode = data.get("evaluator_split_mode") or data["showdown"].get("splitMode", "single")
    evaluator.is_active = data.get("evaluator_is_active", True)
    return evaluator


def _get_or_create_betting_structure(db: Session, data: Dict[str, Any]) -> VariantBettingStructure:
    betting_key = data["betting_key"]
    betting_structure = (
        db.query(VariantBettingStructure)
        .filter(VariantBettingStructure.betting_key == betting_key)
        .one_or_none()
    )
    if betting_structure is None:
        betting_structure = VariantBettingStructure(betting_key=betting_key)
        db.add(betting_structure)

    betting_structure.name = data.get("betting_name") or betting_key
    betting_structure.description = data.get("betting_description")
    return betting_structure


def _get_or_create_modifiers(db: Session, modifier_keys: Iterable[str]) -> List[VariantModifier]:
    modifiers: List[VariantModifier] = []
    for modifier_key in modifier_keys:
        modifier = (
            db.query(VariantModifier)
            .filter(VariantModifier.modifier_key == modifier_key)
            .one_or_none()
        )
        if modifier is None:
            modifier = VariantModifier(
                modifier_key=modifier_key,
                name=modifier_key,
            )
            db.add(modifier)
        else:
            modifier.name = modifier.name or modifier_key
        modifiers.append(modifier)
    return modifiers


def upsert_variant(db: Session, data: Dict[str, Any]) -> Variant:
    """Insert or update a variant and its rule/master rows without committing."""

    evaluator = _get_or_create_evaluator(db, data)
    betting_structure = _get_or_create_betting_structure(db, data)
    db.flush()

    variant = (
        db.query(Variant)
        .filter(Variant.variant_key == data["variant_key"])
        .one_or_none()
    )
    if variant is None:
        variant = Variant(variant_key=data["variant_key"])
        db.add(variant)

    variant.name = data["name"]
    variant.description = data.get("description")
    variant.base_game = data["base_game"]
    variant.deck_type = data["deck_type"]
    variant.min_players = data["min_players"]
    variant.max_players = data["max_players"]
    variant.evaluator = evaluator
    variant.betting_structure = betting_structure
    variant.is_active = data.get("is_active", True)
    variant.is_official = data.get("is_official", True)
    variant.sort_order = data.get("sort_order", 0)

    if variant.rule is None:
        variant.rule = VariantRule()
    variant.rule.hole_cards = data["hole_cards"]
    variant.rule.boards = data["boards"]
    variant.rule.betting = data["betting"]
    variant.rule.forced_bets = data["forced_bets"]
    variant.rule.showdown = data["showdown"]
    variant.rule.draw_rules = data.get("draw_rules")
    variant.rule.stud_rules = data.get("stud_rules")
    variant.rule.lowball_rules = data.get("lowball_rules")
    variant.rule.special_rules = data.get("special_rules")

    variant.modifiers = _get_or_create_modifiers(db, data.get("modifiers", []))
    return variant
