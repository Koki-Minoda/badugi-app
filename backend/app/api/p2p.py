"""Authenticated REST and WebSocket API for private Badugi friend matches."""
from __future__ import annotations

import asyncio
from collections import defaultdict, deque
from dataclasses import dataclass, field
import math
import re
import threading
import time
from typing import Any, Callable

from fastapi import APIRouter, Depends, HTTPException, Response, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field, field_validator

from ..core.security import decode_access_token
from ..dependencies.auth import get_current_user
from ..models import User
from ..p2p.manager import P2PError, Room, p2p_room_manager


router = APIRouter(prefix="/p2p", tags=["p2p"])
ws_router = APIRouter()

STATE_READ_WINDOW_SECONDS = 10.0
STATE_READ_MAX_REQUESTS = 30
STATE_READ_BUCKET_TTL_SECONDS = 10 * 60
STATE_READ_MAX_BUCKETS = 4096


@dataclass
class _StateReadBucket:
    timestamps: deque[float] = field(default_factory=deque)
    last_seen: float = 0.0


class StateReadRateLimiter:
    """Bound authenticated room-state reads without unbounded key growth."""

    def __init__(
        self,
        *,
        max_requests: int = STATE_READ_MAX_REQUESTS,
        window_seconds: float = STATE_READ_WINDOW_SECONDS,
        bucket_ttl_seconds: float = STATE_READ_BUCKET_TTL_SECONDS,
        max_buckets: int = STATE_READ_MAX_BUCKETS,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.bucket_ttl_seconds = bucket_ttl_seconds
        self.max_buckets = max_buckets
        self._clock = clock
        self._buckets: dict[tuple[str, str], _StateReadBucket] = {}
        self._lock = threading.Lock()

    def reset(self) -> None:
        with self._lock:
            self._buckets.clear()

    def check(self, *, user_id: str, room_code: str) -> int | None:
        """Return Retry-After seconds when limited, otherwise consume one read."""

        now = self._clock()
        cutoff = now - self.window_seconds
        key = (user_id, room_code)
        with self._lock:
            self._prune(now)
            bucket = self._buckets.get(key)
            if bucket is None:
                if len(self._buckets) >= self.max_buckets:
                    oldest = min(self._buckets, key=lambda item: self._buckets[item].last_seen)
                    self._buckets.pop(oldest, None)
                bucket = _StateReadBucket()
                self._buckets[key] = bucket
            while bucket.timestamps and bucket.timestamps[0] <= cutoff:
                bucket.timestamps.popleft()
            bucket.last_seen = now
            if len(bucket.timestamps) >= self.max_requests:
                return max(1, math.ceil(bucket.timestamps[0] + self.window_seconds - now))
            bucket.timestamps.append(now)
            return None

    def _prune(self, now: float) -> None:
        stale_before = now - self.bucket_ttl_seconds
        for key in [
            key for key, bucket in self._buckets.items() if bucket.last_seen < stale_before
        ]:
            self._buckets.pop(key, None)


state_read_rate_limiter = StateReadRateLimiter()


class CreateRoomRequest(BaseModel):
    variantId: str = "badugi"
    startingStack: int = Field(2000, ge=200, le=1_000_000)
    smallBlind: int = Field(10, ge=1, le=100_000)
    bigBlind: int = Field(20, ge=1, le=200_000)
    ante: int = Field(0, ge=0, le=100_000)


class RoomCodeRequest(BaseModel):
    roomCode: str = Field(..., min_length=6, max_length=12)


class RoomCommandRequest(BaseModel):
    commandId: str = Field(..., min_length=8, max_length=64, pattern=r"^[A-Za-z0-9._:-]+$")
    handId: str | None = Field(..., max_length=32)
    expectedPhase: str = Field(..., min_length=3, max_length=16)


class RoomReadyRequest(RoomCommandRequest):
    pass


class RoomActionRequest(RoomCommandRequest):
    type: str = Field(..., min_length=1, max_length=16)
    amount: int = Field(0, ge=0, le=1_000_000, strict=True)


class RoomDrawRequest(RoomCommandRequest):
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
        "stale_command": status.HTTP_409_CONFLICT,
        "command_conflict": status.HTTP_409_CONFLICT,
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
    retry_after = state_read_rate_limiter.check(
        user_id=_user_id(user),
        room_code=room.code,
    )
    if retry_after is not None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"code": "state_rate_limited", "message": "Too many room state requests"},
            headers={
                "Retry-After": str(retry_after),
                "Cache-Control": "private, no-store",
                "Pragma": "no-cache",
            },
        )
    return _response(room, _user_id(user))


@router.post("/rooms/{room_code}/ready")
async def ready_room(
    room_code: str,
    payload: RoomReadyRequest,
    response: Response,
    user: User = Depends(get_current_user),
):
    _mark_private(response)
    try:
        result = p2p_room_manager.execute_command(
            room_code,
            user_id=_user_id(user),
            command_id=payload.commandId,
            hand_id=payload.handId,
            expected_phase=payload.expectedPhase,
            command_type="ready",
        )
    except P2PError as exc:
        raise _http_error(exc) from exc
    if not result.duplicate:
        await room_sockets.broadcast_state(result.room)
    return result.state


@router.post("/rooms/{room_code}/action")
async def act_in_room(
    room_code: str,
    payload: RoomActionRequest,
    response: Response,
    user: User = Depends(get_current_user),
):
    _mark_private(response)
    try:
        result = p2p_room_manager.execute_command(
            room_code,
            user_id=_user_id(user),
            command_id=payload.commandId,
            hand_id=payload.handId,
            expected_phase=payload.expectedPhase,
            command_type="action",
            action=payload.type,
            amount=payload.amount,
        )
    except P2PError as exc:
        raise _http_error(exc) from exc
    if not result.duplicate:
        await room_sockets.broadcast_state(result.room)
    return result.state


@router.post("/rooms/{room_code}/draw")
async def draw_in_room(
    room_code: str,
    payload: RoomDrawRequest,
    response: Response,
    user: User = Depends(get_current_user),
):
    _mark_private(response)
    try:
        result = p2p_room_manager.execute_command(
            room_code,
            user_id=_user_id(user),
            command_id=payload.commandId,
            hand_id=payload.handId,
            expected_phase=payload.expectedPhase,
            command_type="draw",
            card_indexes=payload.cardIndexes,
        )
    except P2PError as exc:
        raise _http_error(exc) from exc
    if not result.duplicate:
        await room_sockets.broadcast_state(result.room)
    return result.state


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

    async def send_state(
        self,
        room: Room,
        user_id: str,
        websocket: WebSocket,
        *,
        state: dict[str, Any] | None = None,
        command_id: str | None = None,
    ) -> None:
        await websocket.send_json(
            {
                "event": "state",
                "payload": state or p2p_room_manager.public_state(room, viewer_id=user_id),
                **({"commandId": command_id} if command_id else {}),
            }
        )

    async def broadcast_state(self, room: Room, *, exclude_user_id: str | None = None) -> None:
        connections = list(self._connections.get(room.code, {}).items())
        for user_id, websocket in connections:
            if user_id == exclude_user_id:
                continue
            try:
                await self.send_state(room, user_id, websocket)
            except (RuntimeError, WebSocketDisconnect):
                await self.disconnect(room.code, user_id, websocket)


room_sockets = RoomSockets()


async def terminate_user_p2p_sessions(user_id: str) -> None:
    """Remove a deleted account from all process-local rooms and sockets."""

    for room_code in p2p_room_manager.room_codes_for_user(user_id):
        try:
            room = p2p_room_manager.leave_room(room_code, user_id=user_id)
        except P2PError as exc:
            if exc.code == "room_missing":
                continue
            raise
        await room_sockets.close_user(room_code, user_id, reason="account_deleted")
        if room is None:
            await room_sockets.close_room(room_code, reason="owner_account_deleted")
        else:
            await room_sockets.broadcast_state(room)


async def _send_error(
    websocket: WebSocket,
    exc: P2PError,
    *,
    command_id: str | None = None,
) -> None:
    await websocket.send_json(
        {
            "event": "error",
            "payload": {"code": exc.code, "message": str(exc), "recoverable": True},
            **({"commandId": command_id} if command_id else {}),
        }
    )


def _command_metadata(payload: dict[str, Any]) -> tuple[str, str | None, str]:
    command_id = payload.get("commandId")
    hand_id = payload.get("handId")
    expected_phase = payload.get("expectedPhase")
    if (
        not isinstance(command_id, str)
        or not 8 <= len(command_id) <= 64
        or re.fullmatch(r"[A-Za-z0-9._:-]+", command_id) is None
    ):
        raise P2PError("invalid_payload", "commandId is invalid")
    if hand_id is not None and (not isinstance(hand_id, str) or len(hand_id) > 32):
        raise P2PError("invalid_payload", "handId must be a string or null")
    if not isinstance(expected_phase, str) or not 3 <= len(expected_phase) <= 16:
        raise P2PError("invalid_payload", "expectedPhase is invalid")
    return command_id, hand_id, expected_phase


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
                command_id = None
                if not isinstance(message, dict):
                    raise P2PError("invalid_payload", "WebSocket message must be an object")
                event = str(message.get("event") or "").lower()
                payload = message.get("payload") or {}
                if not isinstance(payload, dict):
                    raise P2PError("invalid_payload", "Event payload must be an object")
                if event == "ready":
                    command_id, hand_id, expected_phase = _command_metadata(payload)
                    result = p2p_room_manager.execute_command(
                        room.code,
                        user_id=user_id,
                        command_id=command_id,
                        hand_id=hand_id,
                        expected_phase=expected_phase,
                        command_type="ready",
                    )
                elif event == "action":
                    command_id, hand_id, expected_phase = _command_metadata(payload)
                    amount = payload.get("amount", 0)
                    if isinstance(amount, bool) or not isinstance(amount, int):
                        raise P2PError("invalid_payload", "Action amount must be an integer")
                    result = p2p_room_manager.execute_command(
                        room.code,
                        user_id=user_id,
                        command_id=command_id,
                        hand_id=hand_id,
                        expected_phase=expected_phase,
                        command_type="action",
                        action=str(payload.get("type") or ""),
                        amount=int(amount),
                    )
                elif event == "draw":
                    command_id, hand_id, expected_phase = _command_metadata(payload)
                    card_indexes = payload.get("cardIndexes", [])
                    if not isinstance(card_indexes, list) or any(
                        isinstance(index, bool) or not isinstance(index, int)
                        for index in card_indexes
                    ):
                        raise P2PError(
                            "invalid_payload", "cardIndexes must be an array of integers"
                        )
                    result = p2p_room_manager.execute_command(
                        room.code,
                        user_id=user_id,
                        command_id=command_id,
                        hand_id=hand_id,
                        expected_phase=expected_phase,
                        command_type="draw",
                        card_indexes=card_indexes,
                    )
                elif event in {"sync", "heartbeat"}:
                    room = p2p_room_manager.get_room(room.code)
                    await room_sockets.send_state(room, user_id, websocket)
                    continue
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
                await _send_error(websocket, exc, command_id=command_id)
                continue
            room = result.room
            await room_sockets.send_state(
                room,
                user_id,
                websocket,
                state=result.state,
                command_id=command_id,
            )
            if not result.duplicate:
                await room_sockets.broadcast_state(room, exclude_user_id=user_id)
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
