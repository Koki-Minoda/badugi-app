from __future__ import annotations

import asyncio
import random
import time
import uuid
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from fastapi import WebSocket, WebSocketDisconnect

from server.room_manager import Participant, RoomState, room_manager
from server.security import create_card_key, encrypt_card
from server.storage import db

CARDS = [r + s for r in "A23456789TJQK" for s in "♠♥♦♣"]


@dataclass
class ClientSession:
  websocket: WebSocket
  room_id: str
  player_id: Optional[str] = None
  last_seen: float = field(default_factory=time.monotonic)
  heartbeat_task: Optional[asyncio.Task] = None


class P2PSyncController:
  def __init__(self):
    self.rooms: Dict[str, List[ClientSession]] = {}

  async def connect(self, room_id: str, websocket: WebSocket) -> ClientSession:
    await websocket.accept()
    session = ClientSession(websocket=websocket, room_id=room_id)
    self.rooms.setdefault(room_id, []).append(session)
    session.heartbeat_task = asyncio.create_task(self._heartbeat_watch(session))
    return session

  async def disconnect(self, session: ClientSession):
    if session.heartbeat_task:
      session.heartbeat_task.cancel()
    sessions = self.rooms.get(session.room_id, [])
    if session in sessions:
      sessions.remove(session)

  async def _heartbeat_watch(self, session: ClientSession):
    try:
      while True:
        await asyncio.sleep(3)
        if time.monotonic() - session.last_seen > 10:
          await self.send_event(
            session,
            "error",
            {
              "code": "timeout",
              "message": "Heartbeat lost, applying AI fallback",
              "recoverable": True,
            },
          )
          await session.websocket.close(code=1011)
          break
        await self.send_event(
          session,
          "heartbeat",
          {"timestamp": time.time(), "pendingActions": 0},
        )
    except asyncio.CancelledError:
      return
    except WebSocketDisconnect:
      return

  async def send_event(self, session: ClientSession, event: str, payload: dict):
    try:
      await session.websocket.send_json({"event": event, "payload": payload})
    except RuntimeError:
      pass

  async def broadcast(self, room_id: str, event: str, payload: dict):
    sessions = self.rooms.get(room_id, [])
    for sess in list(sessions):
      await self.send_event(sess, event, payload)

  async def handle(self, session: ClientSession, message: dict):
    event = message.get("event")
    payload = message.get("payload") or {}
    previous_seen = session.last_seen
    session.last_seen = time.monotonic()
    if event == "join_room":
      await self._handle_join(session, payload)
    elif event == "leave_room":
      await self._handle_leave(session, payload)
    elif event == "action":
      await self._handle_action(session, payload, time.monotonic() - previous_seen)
    elif event == "heartbeat":
      await self.send_event(session, "heartbeat", {"timestamp": time.time(), "pendingActions": 0})
    else:
      await self.send_event(
        session,
        "error",
        {"code": "invalid_event", "message": f"Unsupported event {event}", "recoverable": True},
      )

  async def _handle_join(self, session: ClientSession, payload: dict):
    room_id = session.room_id
    normalized_id = payload.get("playerId") or f"auto-{uuid.uuid4()}"
    session.player_id = normalized_id
    try:
      room_manager.join_room(
        room_id,
        request_participant(normalized_id, payload.get("displayName", "Guest"), payload.get("role", "player")),
      )
    except KeyError:
      await self.send_event(
        session,
        "error",
        {"code": "room_missing", "message": "room not found", "recoverable": False},
      )
      return
    except RuntimeError as exc:
      await self.send_event(
        session,
        "error",
        {"code": "room_full", "message": str(exc), "recoverable": True},
      )
      return
    await self.broadcast_room_state(room_id)
    await self._send_room_history(session.room_id)
    room = room_manager.get_room(room_id)
    if room and room.phase == "waiting" and len(room.players) >= 2:
      await self._start_next_hand(room_id)

  async def _handle_leave(self, session: ClientSession, payload: dict):
    room_manager.leave_room(session.room_id, payload.get("playerId", session.player_id or ""))
    await self.broadcast_room_state(session.room_id)
    room = room_manager.get_room(session.room_id)
    if room and len(room.players) < 2:
      room.phase = "waiting"

  async def _handle_action(self, session: ClientSession, payload: dict, delta: float):
    room = room_manager.get_room(session.room_id)
    if not room:
      await self.send_event(session, "error", {"code": "room_missing", "message": "room gone", "recoverable": False})
      return
    player_id = session.player_id or payload.get("playerId")
    action_type = (payload.get("type") or "call").lower()
    amount = int(payload.get("amount") or 0)
    if not player_id or player_id not in room.players:
      await self.send_event(
        session,
        "error",
        {"code": "missing_player", "message": "player not registered", "recoverable": False},
      )
      return
    if delta < 0.15:
      room.anti_cheat_warnings.append(f"{player_id} action too fast ({delta:.3f}s)")
    if action_type == "fold":
      room.folded.add(player_id)
    else:
      bet_amount = min(amount, room.stacks.get(player_id, 0))
      room.bets[player_id] = room.bets.get(player_id, 0) + bet_amount
      room.stacks[player_id] = max(0, room.stacks.get(player_id, 0) - bet_amount)
      room.pot += bet_amount
    self._advance_turn(room)
    room_manager.record_log(
      room.id,
      {
        "playerId": player_id,
        "action": action_type,
        "amount": amount,
        "phase": room.phase,
      },
    )
    await self.broadcast_state(room)
    if self._is_showdown(room):
      await self._finalize_hand(room)

  def _advance_turn(self, room):
    if not room.turn_order:
      return
    active = [pid for pid in room.turn_order if pid not in room.folded]
    if not active:
      return
    room.current_turn_index = (room.current_turn_index + 1) % len(active)
    room.turn_order = active

  def _is_showdown(self, room):
    active = [pid for pid in room.turn_order if pid not in room.folded]
    return len(active) <= 1

  async def broadcast_state(self, room: RoomState):
    delta = {
      "sequenceId": room.bump_sequence(),
      "handId": room.hand_id,
      "phase": room.phase,
      "bets": room.bets,
      "pot": room.pot,
      "stacks": room.stacks,
      "lastAction": room.history[-1] if room.history else {},
    }
    await self.broadcast(room.id, "updated_state", delta)

  async def broadcast_room_state(self, room_id: str):
    room = room_manager.get_room(room_id)
    if not room:
      return
    payload = {
      "roomId": room.id,
      "phase": room.phase,
      "players": list(room.players.keys()),
      "spectators": list(room.spectators.keys()),
      "sequenceId": room.sequence_id,
      "handId": room.hand_id,
      "warnings": room.anti_cheat_warnings[-5:],
    }
    await self.broadcast(room_id, "room_state", payload)

  async def _send_room_history(self, room_id: str):
    room = room_manager.get_room(room_id)
    if not room:
      return
    await self.broadcast(room_id, "history", {"events": room.history[-5:]})

  async def _finalize_hand(self, room):
    room.phase = "finishing"
    winner = next((pid for pid in room.turn_order if pid not in room.folded), None)
    summary = {
      "handId": room.hand_id,
      "winner": winner,
      "pot": room.pot,
      "warnings": room.anti_cheat_warnings[-3:],
    }
    db.p2p_history.append(summary)
    db.history["hand"].append(
      {
        "handId": room.hand_id,
        "winner": winner or "none",
        "pot": room.pot,
        "players": list(room.players.keys()),
        "metadata": {"phase": "p2p"},
        "warnings": summary["warnings"],
      }
    )
    winner_rating = db.ratings.get(winner, {"sr": 1500, "mr": 1500, "gr": 1500})
    if winner:
      updated = {
        "sr": winner_rating["sr"] + 5,
        "mr": winner_rating["mr"] + 3,
        "gr": winner_rating["gr"] + 2,
        "updated_at": db._now(),
      }
      db.ratings[winner] = updated
    for loser in room.players:
      if loser == winner:
        continue
      loser_rating = db.ratings.get(loser, {"sr": 1500, "mr": 1500, "gr": 1500})
      db.ratings[loser] = {
        "sr": max(1200, loser_rating["sr"] - 2),
        "mr": max(1200, loser_rating["mr"] - 1),
        "gr": max(1200, loser_rating["gr"] - 1),
        "updated_at": db._now(),
      }
    await self.broadcast(room.id, "showdown", summary)
    await self._start_next_hand(room.id)

  async def _start_next_hand(self, room_id: str):
    room = room_manager.reset_hand(room_id)
    if not room:
      return
    key_id = f"{room_id}:{room.hand_id}"
    create_card_key(key_id)
    tokens = []
    deals = random.sample(CARDS, len(room.turn_order)) if room.turn_order else []
    for idx, player_id in enumerate(room.turn_order):
      card = deals[idx]
      token = encrypt_card(f"{card}-{idx}", key_id)
      token["slot"] = f"seat-{idx}"
      tokens.append({"playerId": player_id, "cardToken": token})
    await self.broadcast(room_id, "secure_deal", {"handId": room.hand_id, "cards": tokens})
    await self.broadcast_state(room)


def request_participant(player_id: str, display_name: str, role: str) -> Participant:
  return Participant(id=player_id, display_name=display_name, role=role)


controller = P2PSyncController()


async def websocket_endpoint(websocket: WebSocket, room_id: str):
  session = await controller.connect(room_id, websocket)
  try:
    await controller.broadcast_room_state(room_id)
    while True:
      message = await websocket.receive_json()
      await controller.handle(session, message)
  except WebSocketDisconnect:
    await controller.disconnect(session)
