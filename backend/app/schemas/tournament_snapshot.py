"""Pydantic schemas for tournament snapshot APIs."""
import json
from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class SnapshotPlayer(BaseModel):
    model_config = ConfigDict(extra="forbid")

    playerId: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    stack: int = Field(..., ge=0)
    isBust: bool = False


class SnapshotSeat(BaseModel):
    model_config = ConfigDict(extra="forbid")

    seatIndex: int = Field(..., ge=0)
    playerId: Optional[str] = None


class SnapshotTable(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tableId: str = Field(..., min_length=1)
    seats: List[SnapshotSeat]


class SnapshotState(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str = Field(..., min_length=1)
    lastHandId: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        if value != "waiting_for_next_hand":
            raise ValueError("status must be 'waiting_for_next_hand' in alpha build")
        return value


class TournamentSnapshotPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tournamentId: str = Field(..., min_length=1)
    level: int = Field(..., ge=0)
    heroPlayerId: str = Field(..., min_length=1)
    players: List[SnapshotPlayer]
    tables: List[SnapshotTable]
    currentState: SnapshotState


class TournamentClientSnapshotPayload(BaseModel):
    """Lossless browser MTT snapshot used by the current product client."""

    model_config = ConfigDict(extra="forbid")

    version: Literal[1]
    savedAt: Optional[str] = None
    stageId: Optional[str] = None
    variantId: Optional[str] = None
    config: Dict[str, Any]
    tournamentState: Dict[str, Any]
    hero: Dict[str, Any]
    hud: Dict[str, Any]

    @model_validator(mode="after")
    def validate_resume_contract(self):
        if not self.config.get("id") and not self.tournamentState.get("config", {}).get("id"):
            raise ValueError("snapshot tournament id is required")
        if not isinstance(self.tournamentState.get("players"), dict):
            raise ValueError("snapshot players must be an object")
        if len(json.dumps(self.model_dump(), separators=(",", ":"))) > 2_000_000:
            raise ValueError("snapshot exceeds 2 MB limit")
        return self


class TournamentSaveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    snapshot: Union[TournamentClientSnapshotPayload, TournamentSnapshotPayload]


class TournamentResumeResponse(BaseModel):
    hasSnapshot: bool
    snapshot: Optional[Union[TournamentClientSnapshotPayload, TournamentSnapshotPayload]] = None
