"""Database persistence and optimistic multi-worker coordination for P2P rooms."""
from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from ..models import P2PRoomState
from .manager import CommandReceipt, Player, Room


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
            return room_from_snapshot(row.snapshot) if row and not row.closed else None

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
