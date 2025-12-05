"""Pydantic schemas for tournament snapshot APIs."""
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


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


class TournamentSaveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    snapshot: TournamentSnapshotPayload


class TournamentResumeResponse(BaseModel):
    hasSnapshot: bool
    snapshot: Optional[TournamentSnapshotPayload] = None
