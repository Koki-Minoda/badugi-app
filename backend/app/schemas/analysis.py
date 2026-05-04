"""Pydantic models for tournament analysis APIs."""  # [tournament-feedback]
from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

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


class PlayFeedbackSummary(BaseModel):
    """Aggregated session metrics produced by the front-end feedback payload."""

    model_config = ConfigDict(extra="allow")

    hands: int = Field(..., ge=30)
    vpip: Optional[float] = Field(default=None, ge=0, le=1)
    pfr: Optional[float] = Field(default=None, ge=0, le=1)
    showdownRate: Optional[float] = Field(default=None, ge=0, le=1)
    allInRate: Optional[float] = Field(default=None, ge=0, le=1)
    splitPotRate: Optional[float] = Field(default=None, ge=0, le=1)
    netChips: Optional[int] = None
    roi: Optional[float] = None
    variants: Dict[str, int] = Field(default_factory=dict)
    topIssues: List[Dict[str, Any]] = Field(default_factory=list, max_length=20)


class PlayFeedbackPayload(BaseModel):
    """Schema for cash/tournament session feedback requests."""

    model_config = ConfigDict(extra="allow")

    schemaVersion: int = Field(..., ge=1)
    mode: Literal["cash", "tournament", "mixed"]
    variantScope: str = Field("all", min_length=1, max_length=64)
    minHands: int = Field(30, ge=30, le=1000)
    handCount: int = Field(..., ge=30, le=5000)
    heroSeat: int = Field(0, ge=0, le=9)
    summary: PlayFeedbackSummary
    promptContext: Dict[str, Any] = Field(default_factory=dict)


class PlayFeedbackResponse(BaseModel):
    """Structured coaching response for a completed play session."""

    adviceJa: str
    adviceEn: str
    source: Literal["openai", "fallback"] = "fallback"
    acceptedHandCount: int
    piiRemoved: bool = True
