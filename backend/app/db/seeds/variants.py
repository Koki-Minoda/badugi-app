"""Seed initial VariantDefinition records.

Usage from the backend directory:

    python -m app.db.seeds.variants

The seed is idempotent and does not delete existing data.
"""
from __future__ import annotations

from typing import Any, Dict, List

from sqlalchemy.orm import Session

from ...core.db import SessionLocal
from ...crud.variant import upsert_variant


INITIAL_VARIANTS: List[Dict[str, Any]] = [
    {
        "variant_key": "badugi",
        "name": "Badugi",
        "description": "Four-card triple draw lowball using unique ranks and suits.",
        "base_game": "badugi",
        "deck_type": "standard52",
        "min_players": 2,
        "max_players": 6,
        "hole_cards": {"count": 4},
        "boards": {"count": 0, "cardsPerBoard": 0, "streets": []},
        "betting": {
            "structure": "limit",
            "streets": ["preDraw", "draw1", "draw2", "draw3"],
            "hasPreflop": False,
        },
        "forced_bets": {"type": "blinds"},
        "showdown": {"evaluator": "badugiLow", "splitMode": "single", "scoopAllowed": True},
        "modifiers": ["tripleDraw", "lowball"],
        "evaluator_key": "badugiLow",
        "betting_key": "limit",
        "is_active": True,
        "is_official": True,
        "sort_order": 10,
    },
    {
        "variant_key": "nl_holdem",
        "name": "No-Limit Hold'em",
        "description": "Standard no-limit Texas Hold'em.",
        "base_game": "holdem",
        "deck_type": "standard52",
        "min_players": 2,
        "max_players": 9,
        "hole_cards": {"count": 2},
        "boards": {"count": 1, "cardsPerBoard": 5, "streets": ["flop", "turn", "river"]},
        "betting": {
            "structure": "noLimit",
            "streets": ["preflop", "flop", "turn", "river"],
            "hasPreflop": True,
        },
        "forced_bets": {"type": "blinds"},
        "showdown": {"evaluator": "holdemHigh", "splitMode": "single", "scoopAllowed": True},
        "modifiers": ["noLimit"],
        "evaluator_key": "holdemHigh",
        "betting_key": "noLimit",
        "is_active": True,
        "is_official": True,
        "sort_order": 20,
    },
    {
        "variant_key": "limit_holdem",
        "name": "Limit Hold'em",
        "description": "Fixed-limit Texas Hold'em.",
        "base_game": "holdem",
        "deck_type": "standard52",
        "min_players": 2,
        "max_players": 9,
        "hole_cards": {"count": 2},
        "boards": {"count": 1, "cardsPerBoard": 5, "streets": ["flop", "turn", "river"]},
        "betting": {
            "structure": "limit",
            "streets": ["preflop", "flop", "turn", "river"],
            "hasPreflop": True,
        },
        "forced_bets": {"type": "blinds"},
        "showdown": {"evaluator": "holdemHigh", "splitMode": "single", "scoopAllowed": True},
        "modifiers": ["limit"],
        "evaluator_key": "holdemHigh",
        "betting_key": "limit",
        "is_active": True,
        "is_official": True,
        "sort_order": 30,
    },
    {
        "variant_key": "plo",
        "name": "Pot-Limit Omaha",
        "description": "Pot Limit Omaha high.",
        "base_game": "omaha",
        "deck_type": "standard52",
        "min_players": 2,
        "max_players": 9,
        "hole_cards": {"count": 4, "mustUse": 2},
        "boards": {"count": 1, "cardsPerBoard": 5, "streets": ["flop", "turn", "river"]},
        "betting": {
            "structure": "potLimit",
            "streets": ["preflop", "flop", "turn", "river"],
            "hasPreflop": True,
        },
        "forced_bets": {"type": "blinds"},
        "showdown": {"evaluator": "omahaHigh", "splitMode": "single", "scoopAllowed": True},
        "modifiers": ["potLimit"],
        "evaluator_key": "omahaHigh",
        "betting_key": "potLimit",
        "is_active": True,
        "is_official": True,
        "sort_order": 40,
    },
    {
        "variant_key": "double_board_bomb_pot_omaha",
        "name": "Double Board Bomb Pot Omaha",
        "description": (
            "Pot Limit Omaha bomb pot played with two boards. Each board awards "
            "half the pot unless one player scoops both boards."
        ),
        "base_game": "omaha",
        "deck_type": "standard52",
        "min_players": 2,
        "max_players": 9,
        "hole_cards": {"count": 4, "mustUse": 2},
        "boards": {"count": 2, "cardsPerBoard": 5, "streets": ["flop", "turn", "river"]},
        "betting": {
            "structure": "potLimit",
            "streets": ["flop", "turn", "river"],
            "hasPreflop": False,
        },
        "forced_bets": {"type": "bombPot", "everyonePosts": True, "amountBB": 5},
        "showdown": {"evaluator": "omahaHigh", "splitMode": "byBoard", "scoopAllowed": True},
        "modifiers": ["doubleBoard", "bombPot", "potLimit", "noPreflop"],
        "evaluator_key": "omahaHigh",
        "betting_key": "potLimit",
        "is_active": True,
        "is_official": True,
        "sort_order": 50,
    },
]


def seed_variants(db: Session) -> None:
    for variant_data in INITIAL_VARIANTS:
        upsert_variant(db, variant_data)
    db.commit()


def main() -> None:
    db = SessionLocal()
    try:
        seed_variants(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
