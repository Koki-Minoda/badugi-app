"""Pydantic schemas for future VariantDefinition APIs."""
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


JsonObject = Dict[str, Any]


class VariantRuleRead(BaseModel):
    id: int
    variant_id: int
    hole_cards: JsonObject
    boards: JsonObject
    betting: JsonObject
    forced_bets: JsonObject
    showdown: JsonObject
    draw_rules: Optional[JsonObject] = None
    stud_rules: Optional[JsonObject] = None
    lowball_rules: Optional[JsonObject] = None
    special_rules: Optional[JsonObject] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VariantModifierRead(BaseModel):
    id: int
    modifier_key: str
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VariantEvaluatorRead(BaseModel):
    id: int
    evaluator_key: str
    name: str
    description: Optional[str] = None
    base_game: str
    split_mode: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VariantBettingStructureRead(BaseModel):
    id: int
    betting_key: str
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VariantRead(BaseModel):
    id: int
    variant_key: str
    name: str
    description: Optional[str] = None
    base_game: str
    deck_type: str
    min_players: int
    max_players: int
    evaluator_id: int
    betting_structure_id: int
    is_active: bool
    is_official: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VariantDetailRead(BaseModel):
    """Frontend-friendly shape for reconstructing VariantDefinition."""

    variant_key: str
    name: str
    description: Optional[str] = None
    base_game: str
    deck_type: str
    min_players: int
    max_players: int
    hole_cards: JsonObject
    boards: JsonObject
    betting: JsonObject
    forced_bets: JsonObject
    showdown: JsonObject
    modifiers: List[str] = Field(default_factory=list)
    evaluator: Optional[VariantEvaluatorRead] = None
    betting_structure: Optional[VariantBettingStructureRead] = None
    draw_rules: Optional[JsonObject] = None
    stud_rules: Optional[JsonObject] = None
    lowball_rules: Optional[JsonObject] = None
    special_rules: Optional[JsonObject] = None
    is_active: bool
    is_official: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VariantCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    variant_key: str = Field(..., min_length=1, max_length=128)
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    base_game: str = Field(..., min_length=1, max_length=32)
    deck_type: str = Field(..., min_length=1, max_length=32)
    min_players: int = Field(..., ge=1)
    max_players: int = Field(..., ge=1)
    evaluator_id: int = Field(..., ge=1)
    betting_structure_id: int = Field(..., ge=1)
    is_active: bool = True
    is_official: bool = True
    sort_order: int = 0
    hole_cards: JsonObject
    boards: JsonObject
    betting: JsonObject
    forced_bets: JsonObject
    showdown: JsonObject
    draw_rules: Optional[JsonObject] = None
    stud_rules: Optional[JsonObject] = None
    lowball_rules: Optional[JsonObject] = None
    special_rules: Optional[JsonObject] = None
    modifier_ids: List[int] = Field(default_factory=list)


class VariantUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    base_game: Optional[str] = Field(default=None, min_length=1, max_length=32)
    deck_type: Optional[str] = Field(default=None, min_length=1, max_length=32)
    min_players: Optional[int] = Field(default=None, ge=1)
    max_players: Optional[int] = Field(default=None, ge=1)
    evaluator_id: Optional[int] = Field(default=None, ge=1)
    betting_structure_id: Optional[int] = Field(default=None, ge=1)
    is_active: Optional[bool] = None
    is_official: Optional[bool] = None
    sort_order: Optional[int] = None
    hole_cards: Optional[JsonObject] = None
    boards: Optional[JsonObject] = None
    betting: Optional[JsonObject] = None
    forced_bets: Optional[JsonObject] = None
    showdown: Optional[JsonObject] = None
    draw_rules: Optional[JsonObject] = None
    stud_rules: Optional[JsonObject] = None
    lowball_rules: Optional[JsonObject] = None
    special_rules: Optional[JsonObject] = None
    modifier_ids: Optional[List[int]] = None
