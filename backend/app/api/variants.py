"""Read-only VariantDefinition endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..crud.variant import get_variant_by_key, list_variants
from ..models import Variant
from ..schemas.variant import VariantDetailRead

router = APIRouter(tags=["variants"])


def _variant_to_detail(variant: Variant) -> VariantDetailRead:
    rule = variant.rule
    if rule is None:
        raise HTTPException(status_code=500, detail="variant_rule_missing")

    return VariantDetailRead(
        variant_key=variant.variant_key,
        name=variant.name,
        description=variant.description,
        base_game=variant.base_game,
        deck_type=variant.deck_type,
        min_players=variant.min_players,
        max_players=variant.max_players,
        hole_cards=rule.hole_cards,
        boards=rule.boards,
        betting=rule.betting,
        forced_bets=rule.forced_bets,
        showdown=rule.showdown,
        modifiers=[modifier.modifier_key for modifier in variant.modifiers],
        evaluator=variant.evaluator,
        betting_structure=variant.betting_structure,
        draw_rules=rule.draw_rules,
        stud_rules=rule.stud_rules,
        lowball_rules=rule.lowball_rules,
        special_rules=rule.special_rules,
        is_active=variant.is_active,
        is_official=variant.is_official,
        sort_order=variant.sort_order,
        created_at=variant.created_at,
        updated_at=variant.updated_at,
    )


@router.get("/variants", response_model=list[VariantDetailRead])
def get_variants(db: Session = Depends(get_db)):
    try:
        variants = list_variants(db)
    except SQLAlchemyError:
        return []
    return [_variant_to_detail(variant) for variant in variants]


@router.get("/variants/{variant_key}", response_model=VariantDetailRead)
def get_variant(variant_key: str, db: Session = Depends(get_db)):
    try:
        variant = get_variant_by_key(db, variant_key)
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="db_unreachable")
    if variant is None:
        raise HTTPException(status_code=404, detail="variant_not_found")
    return _variant_to_detail(variant)
