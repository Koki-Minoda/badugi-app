"""Authenticated REST and WebSocket API for private Badugi friend matches."""
from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field, field_validator

from ..core.security import decode_access_token
from ..dependencies.auth import get_current_user
from ..models import User
from ..p2p.manager import P2PError, Room, p2p_room_manager


router = APIRouter(prefix="/p2p", tags=["p2p"])
ws_router = APIRouter()


class CreateRoomRequest(BaseModel):
    variantId: str = "badugi"
    startingStack: int = Field(2000, ge=200, le=1_000_000)
    smallBlind: int = Field(10, ge=1, le=100_000)
    bigBlind: int = Field(20, ge=1, le=200_000)
    ante: int = Field(0, ge=0, le=100_000)


class RoomCodeRequest(BaseModel):
    roomCode: str = Field(..., min_length=6, max_length=12)


class RoomActionRequest(BaseModel):
    type: str = Field(..., min_length=1, max_length=16)
    amount: int = Field(0, ge=0, le=1_000_000, strict=True)


class RoomDrawRequest(BaseModel):
    cardIndexes: list[int] = Field(default_factory=list, max_length=4)

    @field_validator("cardIndexes", mode="before")
    @classmethod
    def validate_card_indexes(cls, value):
        if not isinstance(value, list) or any(
            isinstance(index, bool) or not isinstance(index, int) for index in value
        ):
            raise ValueError("cardIndexes must be an array of integers")
        return value


def _user_id(user: User) -> str:
    return str(user.id)


def _display_name(user: User) -> str:
    return (user.name or user.email or f"Player {user.id}").strip()


def _http_error(exc: P2PError) -> HTTPException:
    code_to_status = {
        "room_missing": status.HTTP_404_NOT_FOUND,
        "not_in_room": status.HTTP_403_FORBIDDEN,
        "room_unavailable": status.HTTP_409_CONFLICT,
        "active_room_limit": status.HTTP_409_CONFLICT,
    }
    return HTTPException(
        status_code=code_to_status.get(exc.code, status.HTTP_400_BAD_REQUEST),
        detail={"code": exc.code, "message": str(exc)},
    )


def _response(room: Room, user_id: str) -> dict[str, Any]:
    return p2p_room_manager.public_state(room, viewer_id=user_id)


def _mark_private(response: Response) -> None:
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["Pragma"] = "no-cache"


def _viewer_room(room_code: str, user: User) -> Room:
    room = p2p_room_manager.get_room(room_code)
    if _user_id(user) not in room.players:
        raise P2PError("not_in_room", "Player is not in this room")
    return room


@router.post("/rooms")
def create_room(
    payload: CreateRoomRequest,
    response: Response,
    user: User = Depends(get_current_user),
):
    _mark_private(response)
    if payload.variantId.lower() != "badugi":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "unsupported_variant", "message": "Friend Match currently supports Badugi only"},
        )
    try:
        room = p2p_room_manager.create_room(
            user_id=_user_id(user),
            display_name=_display_name(user),
            starting_stack=payload.startingStack,
            small_blind=payload.smallBlind,
            big_blind=payload.bigBlind,
            ante=payload.ante,
        )
    except P2PError as exc:
        raise _http_error(exc) from exc
    return _response(room, _user_id(user))


@router.post("/rooms/join")
def join_room(
    payload: RoomCodeRequest,
    response: Response,
    user: User = Depends(get_current_user),
):
    _mark_private(response)
    try:
        room = p2p_room_manager.join_room(
            payload.roomCode,
            user_id=_user_id(user),
            display_name=_display_name(user),
        )
    except P2PError as exc:
        raise _http_error(exc) from exc
    return _response(room, _user_id(user))


@router.get("/rooms/{room_code}")
def get_room(room_code: str, response: Response, user: User = Depends(get_current_user)):
    _mark_private(response)
    try:
        room = _viewer_room(room_code, user)
    except P2PError as exc:
        raise _http_error(exc) from exc
    return _response(room, _user_id(user))


@router.get("/rooms/{room_code}/state")
def get_room_state(
    room_code: str,
    response: Response,
    user: User = Depends(get_current_user),
):
    """Return only the authenticated viewer's authoritative room state."""
    _mark_private(response)
    try:
        room = _viewer_room(room_code, user)
    except P2PError as exc:
        raise _http_error(exc) from exc
    return _response(room, _user_id(user))


@router.post("/rooms/{room_code}/ready")
async def ready_room(
    room_code: str,
    response: Response,
    user: User = Depends(get_current_user),
):
    _mark_private(response)
    try:
        room = p2p_room_manager.ready(room_code, user_id=_user_id(user))
    except P2PError as exc:
        raise _http_error(exc) from exc
    await room_sockets.broadcast_state(room)
    return _response(room, _user_id(user))


@router.post("/rooms/{room_code}/action")
async def act_in_room(
    room_code: str,
    payload: RoomActionRequest,
    response: Response,
    user: User = Depends(get_current_user),
):
    _mark_private(response)
    try:
        room = p2p_room_manager.act(
            room_code,
            user_id=_user_id(user),
            action=payload.type,
            amount=payload.amount,
        )
    except P2PError as exc:
        raise _http_error(exc) from exc
    await room_sockets.broadcast_state(room)
    return _response(room, _user_id(user))


@router.post("/rooms/{room_code}/draw")
async def draw_in_room(
    room_code: str,
    payload: RoomDrawRequest,
    response: Response,
    user: User = Depends(get_current_user),
):
    _mark_private(response)
    try:
        room = p2p_room_manager.draw(
            room_code,
            user_id=_user_id(user),
            card_indexes=payload.cardIndexes,
        )
    except P2PError as exc:
        raise _http_error(exc) from exc
    await room_sockets.broadcast_state(room)
    return _response(room, _user_id(user))


@router.post("/rooms/leave")
async def leave_room(payload: RoomCodeRequest, user: User = Depends(get_current_user)):
    user_id = _user_id(user)
    try:
        room = p2p_room_manager.leave_room(payload.roomCode, user_id=user_id)
    except P2PError as exc:
        raise _http_error(exc) from exc
    await room_sockets.close_user(payload.roomCode.upper(), user_id, reason="left_room")
    if room is None:
        await room_sockets.close_room(payload.roomCode.upper(), reason="owner_left")
    else:
        await room_sockets.broadcast_state(room)
    return {"roomCode": payload.roomCode.upper(), "closed": room is None}


class RoomSockets:
    def __init__(self) -> None:
        self._connections: dict[str, dict[str, WebSocket]] = defaultdict(dict)
        self._lock = asyncio.Lock()

    async def connect(self, room: Room, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept(subprotocol="mgx-auth")
        async with self._lock:
            previous = self._connections[room.code].get(user_id)
            self._connections[room.code][user_id] = websocket
        if previous and previous is not websocket:
            await previous.close(code=4001, reason="replaced_by_reconnect")

    async def disconnect(self, room_code: str, user_id: str, websocket: WebSocket) -> bool:
        removed_current = False
        async with self._lock:
            if self._connections.get(room_code, {}).get(user_id) is websocket:
                self._connections[room_code].pop(user_id, None)
                removed_current = True
            if not self._connections.get(room_code):
                self._connections.pop(room_code, None)
        return removed_current

    async def close_user(self, room_code: str, user_id: str, *, reason: str) -> None:
        async with self._lock:
            websocket = self._connections.get(room_code, {}).pop(user_id, None)
            if not self._connections.get(room_code):
                self._connections.pop(room_code, None)
        if websocket:
            await websocket.close(code=1000, reason=reason)

    async def close_room(self, room_code: str, *, reason: str) -> None:
        async with self._lock:
            connections = list(self._connections.pop(room_code, {}).values())
        for websocket in connections:
            try:
                await websocket.send_json({"event": "room_closed", "payload": {"reason": reason}})
                await websocket.close(code=4004, reason=reason)
            except (RuntimeError, WebSocketDisconnect):
                pass

    async def send_state(self, room: Room, user_id: str, websocket: WebSocket) -> None:
        await websocket.send_json(
            {"event": "state", "payload": p2p_room_manager.public_state(room, viewer_id=user_id)}
        )

    async def broadcast_state(self, room: Room) -> None:
        connections = list(self._connections.get(room.code, {}).items())
        for user_id, websocket in connections:
            try:
                await self.send_state(room, user_id, websocket)
            except (RuntimeError, WebSocketDisconnect):
                await self.disconnect(room.code, user_id, websocket)


room_sockets = RoomSockets()


async def _send_error(websocket: WebSocket, exc: P2PError) -> None:
    await websocket.send_json(
        {
            "event": "error",
            "payload": {"code": exc.code, "message": str(exc), "recoverable": True},
        }
    )


@ws_router.websocket("/ws/p2p/{room_code}")
async def friend_match_socket(
    websocket: WebSocket,
    room_code: str,
):
    try:
        offered_protocols = [
            value.strip()
            for value in websocket.headers.get("sec-websocket-protocol", "").split(",")
            if value.strip()
        ]
        if len(offered_protocols) != 2 or offered_protocols[0] != "mgx-auth":
            raise ValueError("missing authentication protocol")
        token = offered_protocols[1]
        claims = decode_access_token(token)
        user_id = str(claims.get("sub") or "")
        if not user_id:
            raise ValueError("missing subject")
        room = p2p_room_manager.get_room(room_code)
        if user_id not in room.players:
            raise P2PError("not_in_room", "Player is not in this room")
    except (ValueError, P2PError):
        offered_auth_protocol = (
            "mgx-auth"
            if websocket.headers.get("sec-websocket-protocol", "")
            .split(",")[0]
            .strip()
            == "mgx-auth"
            else None
        )
        await websocket.accept(subprotocol=offered_auth_protocol)
        await websocket.close(code=4401, reason="authentication_failed")
        return

    await room_sockets.connect(room, user_id, websocket)
    room = p2p_room_manager.set_connected(room.code, user_id=user_id, connected=True)
    await room_sockets.broadcast_state(room)
    try:
        while True:
            try:
                message = await websocket.receive_json()
            except ValueError:
                await _send_error(
                    websocket,
                    P2PError("invalid_payload", "WebSocket message must be valid JSON"),
                )
                continue
            try:
                if not isinstance(message, dict):
                    raise P2PError("invalid_payload", "WebSocket message must be an object")
                event = str(message.get("event") or "").lower()
                payload = message.get("payload") or {}
                if not isinstance(payload, dict):
                    raise P2PError("invalid_payload", "Event payload must be an object")
                if event == "ready":
                    room = p2p_room_manager.ready(room.code, user_id=user_id)
                elif event == "action":
                    amount = payload.get("amount", 0)
                    if isinstance(amount, bool) or not isinstance(amount, int):
                        raise P2PError("invalid_payload", "Action amount must be an integer")
                    room = p2p_room_manager.act(
                        room.code,
                        user_id=user_id,
                        action=str(payload.get("type") or ""),
                        amount=int(amount),
                    )
                elif event == "draw":
                    card_indexes = payload.get("cardIndexes", [])
                    if not isinstance(card_indexes, list) or any(
                        isinstance(index, bool) or not isinstance(index, int)
                        for index in card_indexes
                    ):
                        raise P2PError(
                            "invalid_payload", "cardIndexes must be an array of integers"
                        )
                    room = p2p_room_manager.draw(
                        room.code,
                        user_id=user_id,
                        card_indexes=card_indexes,
                    )
                elif event in {"sync", "heartbeat"}:
                    room = p2p_room_manager.get_room(room.code)
                elif event == "leave":
                    room_after_leave = p2p_room_manager.leave_room(room.code, user_id=user_id)
                    await room_sockets.disconnect(room.code, user_id, websocket)
                    if room_after_leave is None:
                        await room_sockets.close_room(room.code, reason="owner_left")
                    else:
                        await room_sockets.broadcast_state(room_after_leave)
                    await websocket.close(code=1000, reason="left_room")
                    return
                else:
                    raise P2PError("invalid_event", f"Unsupported event: {event}")
            except P2PError as exc:
                await _send_error(websocket, exc)
                continue
            await room_sockets.broadcast_state(room)
    except WebSocketDisconnect:
        pass
    finally:
        removed_current = await room_sockets.disconnect(room.code, user_id, websocket)
        if removed_current:
            try:
                room = p2p_room_manager.set_connected(room.code, user_id=user_id, connected=False)
                await room_sockets.broadcast_state(room)
            except P2PError:
                pass
