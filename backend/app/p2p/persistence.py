"""Database persistence and optimistic multi-worker coordination for P2P rooms."""
from __future__ import annotations

from contextlib import contextmanager
from typing import Callable, Iterator, TypeVar

import math
import time

from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from ..models import P2PRoomState, P2PStateReadLimit
from .manager import CommandReceipt, Player, Room


MutationResult = TypeVar("MutationResult")
MAX_MUTATION_RETRIES = 8


def room_to_snapshot(room: Room) -> dict:
    return {
        "code": room.code,
        "owner_id": room.owner_id,
        "starting_stack": room.starting_stack,
        "small_blind": room.small_blind,
        "big_blind": room.big_blind,
        "ante": room.ante,
        "created_at": room.created_at,
        "updated_at": room.updated_at,
        "players": {
            user_id: {
                "user_id": player.user_id,
                "display_name": player.display_name,
                "seat": player.seat,
                "stack": player.stack,
                "ready": player.ready,
                "connected": False,
                "bet": player.bet,
                "folded": player.folded,
                "hand": list(player.hand),
            }
            for user_id, player in room.players.items()
        },
        "phase": room.phase,
        "sequence_id": room.sequence_id,
        "hand_number": room.hand_number,
        "dealer_seat": room.dealer_seat,
        "deck": list(room.deck),
        "pot": room.pot,
        "current_bet": room.current_bet,
        "current_actor_id": room.current_actor_id,
        "acted": sorted(room.acted),
        "pending_draw": sorted(room.pending_draw),
        "history": list(room.history),
        "showdown": room.showdown,
        "command_receipts": [
            {
                "user_id": user_id,
                "command_id": command_id,
                "created_at": receipt.created_at,
                "fingerprint": list(receipt.fingerprint),
                "state": receipt.state,
            }
            for (user_id, command_id), receipt in room.command_receipts.items()
        ],
        "closed": room.closed,
    }


def room_from_snapshot(snapshot: dict) -> Room:
    def freeze(value):
        if isinstance(value, list):
            return tuple(freeze(entry) for entry in value)
        return value

    room = Room(
        code=str(snapshot["code"]),
        owner_id=str(snapshot["owner_id"]),
        starting_stack=int(snapshot["starting_stack"]),
        small_blind=int(snapshot["small_blind"]),
        big_blind=int(snapshot["big_blind"]),
        ante=int(snapshot.get("ante", 0)),
        created_at=float(snapshot.get("created_at", 0)),
        updated_at=float(snapshot.get("updated_at", 0)),
    )
    room.players = {
        str(user_id): Player(**player)
        for user_id, player in (snapshot.get("players") or {}).items()
    }
    room.phase = str(snapshot.get("phase", "waiting"))
    room.sequence_id = int(snapshot.get("sequence_id", 0))
    room.hand_number = int(snapshot.get("hand_number", 0))
    room.dealer_seat = int(snapshot.get("dealer_seat", 0))
    room.deck = list(snapshot.get("deck") or [])
    room.pot = int(snapshot.get("pot", 0))
    room.current_bet = int(snapshot.get("current_bet", 0))
    room.current_actor_id = snapshot.get("current_actor_id")
    room.acted = set(snapshot.get("acted") or [])
    room.pending_draw = set(snapshot.get("pending_draw") or [])
    room.history = list(snapshot.get("history") or [])
    room.showdown = snapshot.get("showdown")
    room.command_receipts = {
        (str(entry["user_id"]), str(entry["command_id"])): CommandReceipt(
            created_at=float(entry["created_at"]),
            fingerprint=freeze(entry.get("fingerprint") or []),
            state=dict(entry.get("state") or {}),
        )
        for entry in snapshot.get("command_receipts") or []
    }
    room.closed = bool(snapshot.get("closed", False))
    return room


class SQLAlchemyRoomStore:
    """Persist snapshots and reject stale writes from another worker."""

    def __init__(self, session_factory: sessionmaker):
        self._session_factory = session_factory

    @contextmanager
    def _session(self) -> Iterator[Session]:
        session = self._session_factory()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def load(self, room_code: str) -> Room | None:
        with self._session() as session:
            row = session.get(P2PRoomState, room_code.strip().upper())
            return room_from_snapshot(row.snapshot) if row else None

    def load_many(self, room_codes: list[str]) -> dict[str, Room]:
        if not room_codes:
            return {}
        with self._session() as session:
            rows = session.scalars(
                select(P2PRoomState).where(P2PRoomState.room_code.in_(room_codes)),
            )
            return {row.room_code: room_from_snapshot(row.snapshot) for row in rows}

    def exists(self, room_code: str) -> bool:
        return self.load(room_code) is not None

    def save(self, room: Room) -> bool:
        with self._session() as session:
            row = session.execute(
                select(P2PRoomState)
                .where(P2PRoomState.room_code == room.code)
                .with_for_update(),
            ).scalar_one_or_none()
            if row is None:
                session.add(P2PRoomState(
                    room_code=room.code,
                    owner_id=room.owner_id,
                    sequence_id=room.sequence_id,
                    closed=room.closed,
                    snapshot=room_to_snapshot(room),
                ))
                return True
            if room.sequence_id <= row.sequence_id:
                return False
            row.owner_id = room.owner_id
            row.sequence_id = room.sequence_id
            row.closed = room.closed
            row.snapshot = room_to_snapshot(room)
            return True

    def mutate(
        self,
        room_code: str,
        mutation: Callable[[Room], MutationResult],
    ) -> tuple[Room, MutationResult]:
        """Atomically apply a mutation with portable compare-and-swap retries."""

        normalized = room_code.strip().upper()
        for _ in range(MAX_MUTATION_RETRIES):
            with self._session() as session:
                row = session.get(P2PRoomState, normalized)
                if row is None or row.closed:
                    from .manager import P2PError

                    raise P2PError("room_missing", "Room not found")
                base_sequence = row.sequence_id
                room = room_from_snapshot(row.snapshot)
                result = mutation(room)
                values = {
                    "owner_id": room.owner_id,
                    "sequence_id": room.sequence_id,
                    "closed": room.closed,
                    "snapshot": room_to_snapshot(room),
                }
                applied = session.execute(
                    update(P2PRoomState)
                    .where(
                        P2PRoomState.room_code == normalized,
                        P2PRoomState.sequence_id == base_sequence,
                    )
                    .values(**values),
                )
                if applied.rowcount == 1:
                    return room, result
                session.rollback()
        from .manager import P2PError

        raise P2PError("state_conflict", "Room is busy; retry the command")

    def delete(self, room_code: str) -> None:
        with self._session() as session:
            row = session.get(P2PRoomState, room_code.strip().upper())
            if row:
                session.delete(row)

    def room_codes_for_user(self, user_id: str) -> list[str]:
        with self._session() as session:
            rows = session.scalars(
                select(P2PRoomState).where(P2PRoomState.closed.is_(False)),
            )
            return [
                row.room_code
                for row in rows
                if str(user_id) in (row.snapshot.get("players") or {})
            ]

    def active_owner_count(self, user_id: str) -> int:
        with self._session() as session:
            return len(list(session.scalars(
                select(P2PRoomState).where(
                    P2PRoomState.owner_id == str(user_id),
                    P2PRoomState.closed.is_(False),
                ),
            )))

    def prune_expired(self, cutoff_timestamp: float) -> int:
        """Delete closed or inactive snapshots even when no worker cached them."""
        with self._session() as session:
            rows = list(session.scalars(select(P2PRoomState)))
            expired = [
                row
                for row in rows
                if float((row.snapshot or {}).get("updated_at", 0)) < cutoff_timestamp
            ]
            for row in expired:
                session.delete(row)
            return len(expired)

    def consume_state_read(
        self,
        *,
        user_id: str,
        room_code: str,
        max_requests: int,
        window_seconds: float,
        bucket_ttl_seconds: float,
        max_buckets: int,
    ) -> int | None:
        """Consume a shared fixed-window read allowance across all workers."""

        now = time.time()
        cutoff = now - window_seconds
        normalized = room_code.strip().upper()
        for _ in range(MAX_MUTATION_RETRIES):
            try:
                with self._session() as session:
                    incremented = session.execute(
                        update(P2PStateReadLimit)
                        .where(
                            P2PStateReadLimit.room_code == normalized,
                            P2PStateReadLimit.user_id == str(user_id),
                            P2PStateReadLimit.window_started_at > cutoff,
                            P2PStateReadLimit.request_count < max_requests,
                        )
                        .values(
                            request_count=P2PStateReadLimit.request_count + 1,
                            updated_at=now,
                        ),
                    )
                    if incremented.rowcount == 1:
                        return None
                    reset = session.execute(
                        update(P2PStateReadLimit)
                        .where(
                            P2PStateReadLimit.room_code == normalized,
                            P2PStateReadLimit.user_id == str(user_id),
                            P2PStateReadLimit.window_started_at <= cutoff,
                        )
                        .values(window_started_at=now, request_count=1, updated_at=now),
                    )
                    if reset.rowcount == 1:
                        return None
                    row = session.get(P2PStateReadLimit, (normalized, str(user_id)))
                    if row is not None:
                        return max(1, math.ceil(row.window_started_at + window_seconds - now))
                    session.execute(
                        delete(P2PStateReadLimit).where(
                            P2PStateReadLimit.updated_at < now - bucket_ttl_seconds,
                        ),
                    )
                    count = session.scalar(select(func.count()).select_from(P2PStateReadLimit)) or 0
                    if count >= max_buckets:
                        return max(1, math.ceil(window_seconds))
                    session.add(P2PStateReadLimit(
                        room_code=normalized,
                        user_id=str(user_id),
                        window_started_at=now,
                        request_count=1,
                        updated_at=now,
                    ))
                    session.flush()
                    return None
            except IntegrityError:
                continue
        return max(1, math.ceil(window_seconds))
