from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class Participant:
  id: str
  display_name: str
  role: str = "player"
  seat: Optional[str] = None
  ready: bool = False
  latency_ms: Optional[int] = None
  version: int = 1
  last_seen: float = field(default_factory=time.monotonic)


@dataclass
class RoomState:
  id: str
  created_at: float
  players: Dict[str, Participant] = field(default_factory=dict)
  spectators: Dict[str, Participant] = field(default_factory=dict)
  max_players: int = 6
  phase: str = "waiting"
  metadata: Dict[str, str] = field(default_factory=dict)
  sequence_id: int = 0
  history: List[Dict[str, str]] = field(default_factory=list)
  hand_id: str = field(default_factory=lambda: str(uuid.uuid4()))
  last_action_at: float = field(default_factory=time.monotonic)
  stacks: Dict[str, int] = field(default_factory=dict)
  bets: Dict[str, int] = field(default_factory=dict)
  pot: int = 0
  turn_order: List[str] = field(default_factory=list)
  current_turn_index: int = 0
  folded: set = field(default_factory=set)
  anti_cheat_warnings: List[str] = field(default_factory=list)

  def bump_sequence(self) -> int:
    self.sequence_id += 1
    return self.sequence_id

  def mark_action(self):
    self.last_action_at = time.monotonic()


class InMemoryRoomManager:
  def __init__(self):
    self._rooms: Dict[str, RoomState] = {}

  def list_rooms(self) -> List[RoomState]:
    return list(self._rooms.values())

  def create_room(self, room_id: Optional[str] = None, max_players: int = 6, metadata: Optional[Dict[str, str]] = None) -> RoomState:
    room_id = room_id or f"room-{uuid.uuid4()}"
    if room_id in self._rooms:
      raise ValueError(f"Room {room_id} already exists")
    room = RoomState(
      id=room_id,
      created_at=time.monotonic(),
      max_players=max_players,
      metadata=metadata or {},
    )
    self._rooms[room_id] = room
    return room

  def get_room(self, room_id: str) -> Optional[RoomState]:
    return self._rooms.get(room_id)

  def remove_room(self, room_id: str):
    self._rooms.pop(room_id, None)

  def join_room(self, room_id: str, participant: Participant):
    room = self.get_room(room_id)
    if not room:
      raise KeyError("room not found")
    if len(room.players) >= room.max_players:
      raise RuntimeError("room full")
    room.players[participant.id] = participant
    room.stacks.setdefault(participant.id, 1500)
    room.bets.setdefault(participant.id, 0)
    if participant.id not in room.turn_order:
      room.turn_order.append(participant.id)
    return room

  def leave_room(self, room_id: str, participant_id: str):
    room = self.get_room(room_id)
    if not room:
      return None
    room.players.pop(participant_id, None)
    room.spectators.pop(participant_id, None)
    room.turn_order = [pid for pid in room.turn_order if pid != participant_id]
    room.folded.discard(participant_id)
    if not room.players and not room.spectators:
      self.remove_room(room_id)
    return room

  def add_spectator(self, room_id: str, participant: Participant):
    room = self.get_room(room_id)
    if not room:
      raise KeyError("room not found")
    room.spectators[participant.id] = participant
    return room

  def record_log(self, room_id: str, entry: Dict[str, str]):
    room = self.get_room(room_id)
    if room:
      room.history.append(entry)
      room.mark_action()
    return room

  def reset_hand(self, room_id: str):
    room = self.get_room(room_id)
    if room:
      room.hand_id = str(uuid.uuid4())
      room.pot = 0
      room.bets = {pid: 0 for pid in room.players.keys()}
      room.turn_order = list(room.players.keys())
      room.current_turn_index = 0
      room.phase = "playing"
      room.folded = set()
      room.anti_cheat_warnings.clear()
      room.mark_action()
    return room


room_manager = InMemoryRoomManager()
