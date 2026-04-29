"""ORM base definitions."""
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Root declarative base for all ORM models."""

    pass


from .user import User  # noqa: E402  (import after Base definition)
from .hand_log import HandAction, HandLog, HandResult  # noqa: E402
from .badugi_action_log import BadugiHandAction  # noqa: E402
from .tournament_snapshot import TournamentSnapshot  # noqa: E402
from .variant import (  # noqa: E402
    Variant,
    VariantBettingStructure,
    VariantEvaluator,
    VariantModifier,
    VariantRule,
    variant_modifier_links,
)

__all__ = (
    "Base",
    "User",
    "HandLog",
    "HandAction",
    "HandResult",
    "BadugiHandAction",
    "TournamentSnapshot",
    "Variant",
    "VariantRule",
    "VariantModifier",
    "VariantEvaluator",
    "VariantBettingStructure",
    "variant_modifier_links",
)
