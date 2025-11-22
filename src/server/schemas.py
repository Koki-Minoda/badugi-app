from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class TokenPayload(BaseModel):
  access_token: str
  refresh_token: str
  token_type: str = "bearer"


class UserProfile(BaseModel):
  id: str
  nickname: str
  avatar: str
  country: str = "JP"
  settings: dict = Field(default_factory=dict)


class RatingUpdate(BaseModel):
  user_id: str
  sr_before: int
  sr_after: int
  mr_before: int
  mr_after: int
  global_after: int
  reason: str
  metadata: dict = Field(default_factory=dict)


class HandHistory(BaseModel):
  handId: str
  winner: str
  variantId: Optional[str]
  data: dict


class TournamentSnapshot(BaseModel):
  sessionId: str
  stageId: str
  blindLevel: int
  remainingPlayers: int
  stacks: List[dict]
  breaks: Optional[dict] = None
  metadata: dict = Field(default_factory=dict)


class MixedRecord(BaseModel):
  rotationId: str
  gameId: str
  handsPlayed: int
  result: dict


class RLBufferEntry(BaseModel):
  user_id: str
  payload: dict


class RoomCreateRequest(BaseModel):
  owner_id: str
  max_players: int = 6
  mode: str = "ring"
  metadata: dict = Field(default_factory=dict)


class RoomJoinRequest(BaseModel):
  room_id: str
  player_id: str
  display_name: str
  seat_hint: Optional[str] = None
  role: str = "player"


class RoomLeaveRequest(BaseModel):
  room_id: str
  player_id: str


class RoomInfoResponse(BaseModel):
  room_id: str
  phase: str
  players: List[dict]
  spectators: List[dict]
  metadata: dict
  sequence_id: int

def ok(data: Any):
  return {"status": "ok", "data": data}
