from fastapi import APIRouter, HTTPException

from server.room_manager import Participant, room_manager
from server.schemas import RoomCreateRequest, RoomInfoResponse, RoomJoinRequest, RoomLeaveRequest, ok

router = APIRouter()


@router.post("/create")
def create_room(payload: RoomCreateRequest):
  try:
    room = room_manager.create_room(max_players=payload.max_players, metadata={"mode": payload.mode, **payload.metadata})
  except ValueError as exc:
    raise HTTPException(status_code=400, detail=str(exc))
  return ok(
    {
      "roomId": room.id,
      "phase": room.phase,
      "metadata": room.metadata,
      "maxPlayers": room.max_players,
    }
  )


@router.post("/join")
def join_room(payload: RoomJoinRequest):
  try:
    participant = Participant(
      id=payload.player_id,
      display_name=payload.display_name,
      seat=payload.seat_hint,
      role=payload.role,
    )
    room = room_manager.join_room(payload.room_id, participant)
  except KeyError:
    raise HTTPException(status_code=404, detail="Room not found")
  except RuntimeError as exc:
    raise HTTPException(status_code=400, detail=str(exc))
  return ok({"roomId": room.id, "players": [p.id for p in room.players.values()]})


@router.post("/leave")
def leave_room(payload: RoomLeaveRequest):
  room = room_manager.leave_room(payload.room_id, payload.player_id)
  if room is None:
    raise HTTPException(status_code=404, detail="room not found")
  return ok({"roomId": room.id, "players": [p.id for p in room.players.values()]})


@router.get("/info/{room_id}")
def get_room_info(room_id: str):
  room = room_manager.get_room(room_id)
  if not room:
    raise HTTPException(status_code=404, detail="room not found")
  response = RoomInfoResponse(
    room_id=room.id,
    phase=room.phase,
    players=[p.__dict__ for p in room.players.values()],
    spectators=[p.__dict__ for p in room.spectators.values()],
    metadata=room.metadata,
    sequence_id=room.sequence_id,
  )
  return ok(response.dict())


@router.get("/list")
def list_rooms():
  rooms = room_manager.list_rooms()
  return ok(
    [
      {
        "roomId": r.id,
        "phase": r.phase,
        "players": len(r.players),
        "spectators": len(r.spectators),
        "metadata": r.metadata,
      }
      for r in rooms
    ]
  )
