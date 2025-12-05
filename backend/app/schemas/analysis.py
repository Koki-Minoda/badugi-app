"""Pydantic models for tournament analysis APIs."""  # [tournament-feedback]
from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class WorstSpotAction(BaseModel):
    """Hero action snapshot within a hand."""  # [tournament-feedback]

    model_config = ConfigDict(extra="forbid")

    street: str = Field(..., min_length=1)
    action: str = Field(..., min_length=1)
    amount: Optional[int] = None
    drawCount: Optional[int] = Field(default=None, ge=0)


class WorstSpotPayload(BaseModel):
    """Schema for the front-end WorstSpot payload."""  # [tournament-feedback]

    model_config = ConfigDict(extra="forbid")

    handId: str = Field(..., min_length=1)
    street: Literal["predraw", "draw", "postdraw", "showdown"]
    action: str = Field(..., min_length=1)
    chipDelta: int
    heroHand: Optional[List[str]] = None
    drawnCards: Optional[int] = Field(default=None, ge=0, le=4)
    potSize: Optional[int] = Field(default=None, ge=0)
    opponentAggression: Optional[Literal["low", "medium", "high"]] = None
    actionHistory: List[WorstSpotAction] = Field(default_factory=list)

