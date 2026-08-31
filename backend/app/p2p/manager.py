"""Server-authoritative, durably persisted heads-up Badugi friend matches."""
from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from itertools import combinations
import secrets
import string
import threading
import time
from typing import Any, Callable, Protocol, TypeVar


RANKS = "A23456789TJQK"
SUITS = "shdc"
DECK = tuple(f"{rank}{suit}" for rank in RANKS for suit in SUITS)
ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
BETTING_PHASES = ("bet_0", "bet_1", "bet_2", "bet_3")
DRAWING_PHASES = ("draw_1", "draw_2", "draw_3")
ROOM_TTL_SECONDS = 6 * 60 * 60
MAX_ACTIVE_ROOMS_PER_OWNER = 3
COMMAND_RECEIPT_TTL_SECONDS = 10 * 60
MAX_COMMAND_RECEIPTS_PER_ROOM = 256
StoreResult = TypeVar("StoreResult")


class P2PError(RuntimeError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


class RoomStore(Protocol):
    def load(self, room_code: str) -> "Room | None": ...
    def load_many(self, room_codes: list[str]) -> dict[str, "Room"]: ...
    def exists(self, room_code: str) -> bool: ...
    def save(self, room: "Room") -> bool: ...
    def mutate(
        self,
        room_code: str,
        mutation: Callable[["Room"], StoreResult],
    ) -> tuple["Room", StoreResult]: ...
    def delete(self, room_code: str) -> None: ...
    def room_codes_for_user(self, user_id: str) -> list[str]: ...
    def active_owner_count(self, user_id: str) -> int: ...
    def prune_expired(self, cutoff_timestamp: float) -> int: ...
    def consume_state_read(
        self,
        *,
        user_id: str,
        room_code: str,
        max_requests: int,
        window_seconds: float,
        bucket_ttl_seconds: float,
        max_buckets: int,
    ) -> int | None: ...


def _rank_value(card: str) -> int:
    return RANKS.index(card[0]) + 1


def badugi_rank(cards: list[str]) -> tuple[int, tuple[int, ...]]:
    """Return a comparable rank where the largest tuple is the best hand."""

    best: tuple[int, tuple[int, ...]] | None = None
    for size in range(1, min(4, len(cards)) + 1):
        for subset in combinations(cards, size):
            ranks = [_rank_value(card) for card in subset]
            suits = [card[1] for card in subset]
            if len(set(ranks)) != size or len(set(suits)) != size:
                continue
            # More cards win.  Within equal size, lower high cards win.
            key = (size, tuple(-rank for rank in sorted(ranks, reverse=True)))
            if best is None or key > best:
                best = key
    return best or (0, ())


@dataclass
class Player:
    user_id: str
    display_name: str
    seat: int
    stack: int
    ready: bool = False
    connected: bool = False
    bet: int = 0
    folded: bool = False
    hand: list[str] = field(default_factory=list)


@dataclass
class CommandReceipt:
    created_at: float
    fingerprint: tuple[Any, ...]
    state: dict[str, Any]


@dataclass
class CommandResult:
    room: "Room"
    state: dict[str, Any]
    duplicate: bool


@dataclass
class Room:
    code: str
    owner_id: str
    starting_stack: int
    small_blind: int
    big_blind: int
    ante: int
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    players: dict[str, Player] = field(default_factory=dict)
    phase: str = "waiting"
    sequence_id: int = 0
    hand_number: int = 0
    dealer_seat: int = 0
    deck: list[str] = field(default_factory=list)
    pot: int = 0
    current_bet: int = 0
    current_actor_id: str | None = None
    acted: set[str] = field(default_factory=set)
    pending_draw: set[str] = field(default_factory=set)
    history: list[dict[str, Any]] = field(default_factory=list)
    showdown: dict[str, Any] | None = None
    command_receipts: dict[tuple[str, str], CommandReceipt] = field(default_factory=dict)
    closed: bool = False

    @property
    def hand_id(self) -> str | None:
        return f"{self.code}-{self.hand_number}" if self.hand_number else None


class P2PRoomManager:
    def __init__(self) -> None:
        self._rooms: dict[str, Room] = {}
        self._lock = threading.RLock()
        self._rng = secrets.SystemRandom()
        self._store: RoomStore | None = None

    def attach_store(self, store: RoomStore | None) -> None:
        with self._lock:
            self._store = store

    @property
    def has_shared_store(self) -> bool:
        return self._store is not None

    def consume_state_read(self, **kwargs) -> int | None:
        if not self._store:
            return None
        return self._store.consume_state_read(**kwargs)

    def _persist(self, room: Room) -> None:
        if not self._store:
            return
        if self._store.save(room):
            return
        latest = self._store.load(room.code)
        if latest is not None:
            self._rooms[room.code] = latest
        raise P2PError(
            "state_conflict",
            "Room state changed on another server; retry with the latest sequence",
        )

    def reset(self) -> None:
        with self._lock:
            self._rooms.clear()

    def room_codes_for_user(self, user_id: str) -> list[str]:
        """Return active room codes containing a user."""

        with self._lock:
            self._prune_expired_rooms()
            codes = {
                room.code
                for room in self._rooms.values()
                if not room.closed and user_id in room.players
            }
            if self._store:
                codes.update(self._store.room_codes_for_user(user_id))
            return sorted(codes)

    def refresh_rooms(self, room_codes: list[str]) -> dict[str, Room]:
        """Load durable snapshots in one query for process-local socket fanout."""

        normalized = sorted({code.strip().upper() for code in room_codes if code.strip()})
        with self._lock:
            if not self._store:
                return {code: self._rooms[code] for code in normalized if code in self._rooms}
            durable = self._store.load_many(normalized)
            for code, room in durable.items():
                cached = self._rooms.get(code)
                if cached is None or room.sequence_id > cached.sequence_id or room.closed:
                    self._rooms[code] = room
            return {
                code: self._rooms[code]
                for code in normalized
                if code in durable and code in self._rooms and not self._rooms[code].closed
            }

    def create_room(
        self,
        *,
        user_id: str,
        display_name: str,
        starting_stack: int = 2000,
        small_blind: int = 10,
        big_blind: int = 20,
        ante: int = 0,
    ) -> Room:
        if starting_stack < big_blind * 10:
            raise P2PError("invalid_stack", "Starting stack must be at least 10 big blinds")
        if small_blind <= 0 or big_blind < small_blind or ante < 0:
            raise P2PError("invalid_blinds", "Invalid blind or ante configuration")
        with self._lock:
            self._prune_expired_rooms()
            owner_room_count = sum(
                1
                for room in self._rooms.values()
                if room.owner_id == user_id and not room.closed
            )
            if self._store:
                owner_room_count = max(owner_room_count, self._store.active_owner_count(user_id))
            if owner_room_count >= MAX_ACTIVE_ROOMS_PER_OWNER:
                raise P2PError(
                    "active_room_limit",
                    "Leave an existing Friend Match room before creating another",
                )
            code = self._new_code()
            room = Room(
                code=code,
                owner_id=user_id,
                starting_stack=starting_stack,
                small_blind=small_blind,
                big_blind=big_blind,
                ante=ante,
            )
            room.players[user_id] = Player(user_id, display_name, 0, starting_stack)
            self._rooms[code] = room
            self._persist(room)
            return room

    def get_room(self, code: str) -> Room:
        normalized = code.strip().upper()
        with self._lock:
            self._prune_expired_rooms()
            room = self._rooms.get(normalized)
            if self._store:
                persisted = self._store.load(normalized)
                if persisted and (room is None or persisted.sequence_id > room.sequence_id):
                    room = persisted
                    self._rooms[normalized] = room
            if not room or room.closed:
                raise P2PError("room_missing", "Room not found")
            return room

    def join_room(self, code: str, *, user_id: str, display_name: str) -> Room:
        with self._lock:
            if self._store:
                room, _ = self._store.mutate(
                    code,
                    lambda persisted: self._join_room_on_snapshot(
                        persisted,
                        user_id=user_id,
                        display_name=display_name,
                    ),
                )
                self._rooms[room.code] = room
                return room
            room = self.get_room(code)
            self._join_room_on_snapshot(room, user_id=user_id, display_name=display_name)
            return room

    def _join_room_on_snapshot(
        self,
        room: Room,
        *,
        user_id: str,
        display_name: str,
    ) -> None:
        if user_id in room.players:
            if room.players[user_id].display_name != display_name:
                room.players[user_id].display_name = display_name
                self._record(room, "player_profile_updated", user_id=user_id)
            return
        if len(room.players) >= 2 or room.phase != "waiting":
            raise P2PError("room_unavailable", "Room is full or already playing")
        room.players[user_id] = Player(user_id, display_name, 1, room.starting_stack)
        self._record(room, "player_joined", user_id=user_id)

    def leave_room(self, code: str, *, user_id: str) -> Room | None:
        with self._lock:
            if self._store:
                room, _ = self._store.mutate(
                    code,
                    lambda persisted: self._leave_room_on_snapshot(
                        persisted,
                        user_id=user_id,
                    ),
                )
                self._rooms[room.code] = room
                return None if room.closed else room
            room = self.get_room(code)
            self._leave_room_on_snapshot(room, user_id=user_id)
            self._persist(room)
            return None if room.closed else room

    def _leave_room_on_snapshot(self, room: Room, *, user_id: str) -> None:
        if user_id not in room.players:
            raise P2PError("not_in_room", "Player is not in this room")
        if room.phase not in {"waiting", "showdown"}:
            other = self._other_player(room, user_id)
            if other:
                self._finish_hand(room, winner_ids=[other.user_id], reason="opponent_left")
        room.players.pop(user_id, None)
        self._record(room, "player_left", user_id=user_id)
        if not room.players or user_id == room.owner_id:
            room.closed = True
            self._record(room, "room_closed", user_id=user_id)
            return
        room.phase = "waiting"

    def close_room(self, code: str, *, user_id: str) -> None:
        """Close a room explicitly, restricted to its owner."""

        with self._lock:
            if self._store:
                room, _ = self._store.mutate(
                    code,
                    lambda persisted: self._close_room_on_snapshot(
                        persisted,
                        user_id=user_id,
                    ),
                )
                self._rooms[room.code] = room
                return
            room = self.get_room(code)
            self._close_room_on_snapshot(room, user_id=user_id)
            self._persist(room)

    def _close_room_on_snapshot(self, room: Room, *, user_id: str) -> None:
        if room.owner_id != user_id:
            raise P2PError("not_room_owner", "Only the room owner can close this room")
        self._leave_room_on_snapshot(room, user_id=user_id)

    def set_connected(self, code: str, *, user_id: str, connected: bool) -> Room:
        with self._lock:
            room = self.get_room(code)
            player = self._player(room, user_id)
            player.connected = connected
            self._bump(room)
            self._persist(room)
            return room

    def ready(self, code: str, *, user_id: str, persist: bool = True) -> Room:
        with self._lock:
            room = self.get_room(code)
            self._ready_on_room(room, user_id=user_id)
            if persist:
                self._persist(room)
            return room

    def _ready_on_room(self, room: Room, *, user_id: str) -> None:
        if room.phase not in {"waiting", "showdown"}:
            raise P2PError("hand_in_progress", "The current hand is still in progress")
        player = self._player(room, user_id)
        player.ready = True
        self._record(room, "ready", user_id=user_id)
        if len(room.players) == 2 and all(player.ready for player in room.players.values()):
            self._start_hand(room)

    def act(self, code: str, *, user_id: str, action: str, amount: int = 0, persist: bool = True) -> Room:
        with self._lock:
            room = self.get_room(code)
            self._act_on_room(room, user_id=user_id, action=action, amount=amount)
            if persist:
                self._persist(room)
            return room

    def _act_on_room(self, room: Room, *, user_id: str, action: str, amount: int = 0) -> None:
        player = self._player(room, user_id)
        action = action.strip().lower()
        if room.phase not in BETTING_PHASES:
            raise P2PError("invalid_phase", "Betting action is not available now")
        if room.current_actor_id != user_id:
            raise P2PError("out_of_turn", "It is not your turn")
        legal = self.legal_actions(room, user_id)
        if action not in legal:
            raise P2PError("illegal_action", f"{action} is not legal in this state")
        to_call = max(0, room.current_bet - player.bet)
        if action == "fold":
            player.folded = True
            opponent = self._other_player(room, user_id)
            self._record(room, action, user_id=user_id, amount=0)
            self._finish_hand(
                room,
                winner_ids=[opponent.user_id] if opponent else [],
                reason="fold",
            )
            return
        if action == "check":
            paid = 0
        elif action == "call":
            paid = self._pay(room, player, to_call)
        else:
            minimum = to_call + room.big_blind
            requested = max(minimum, int(amount or 0))
            opponent = self._other_player(room, user_id)
            if opponent:
                # Heads-up has no side pot. Never accept chips the opponent
                # cannot match; excess all-in chips stay in the bettor's stack.
                maximum_target = opponent.bet + opponent.stack
                requested = min(requested, max(0, maximum_target - player.bet))
            paid = self._pay(room, player, requested)
            room.current_bet = max(room.current_bet, player.bet)
            room.acted = {user_id}
        if action in {"check", "call"}:
            room.acted.add(user_id)
        self._record(room, action, user_id=user_id, amount=paid)
        if self._betting_round_complete(room):
            self._refund_uncalled_bet(room)
            self._advance_from_betting(room)
        else:
            room.current_actor_id = self._other_player(room, user_id).user_id
            self._bump(room)

    def draw(self, code: str, *, user_id: str, card_indexes: list[int], persist: bool = True) -> Room:
        with self._lock:
            room = self.get_room(code)
            self._draw_on_room(room, user_id=user_id, card_indexes=card_indexes)
            if persist:
                self._persist(room)
            return room

    def _draw_on_room(self, room: Room, *, user_id: str, card_indexes: list[int]) -> None:
        player = self._player(room, user_id)
        if room.phase not in DRAWING_PHASES:
            raise P2PError("invalid_phase", "Drawing is not available now")
        if room.current_actor_id != user_id:
            raise P2PError("out_of_turn", "It is not your turn to draw")
        if user_id not in room.pending_draw:
            raise P2PError("already_drew", "Draw action was already submitted")
        indexes = sorted(set(card_indexes))
        if len(indexes) > 4 or any(index < 0 or index >= len(player.hand) for index in indexes):
            raise P2PError("invalid_draw", "Invalid card selection")
        kept = [card for index, card in enumerate(player.hand) if index not in indexes]
        replacements = [room.deck.pop() for _ in indexes]
        player.hand = kept + replacements
        room.pending_draw.remove(user_id)
        self._record(room, "draw", user_id=user_id, amount=len(indexes))
        if not room.pending_draw:
            round_number = int(room.phase[-1])
            room.phase = f"bet_{round_number}"
            self._reset_betting_round(room)
        else:
            room.current_actor_id = next(iter(room.pending_draw))
            self._bump(room)

    def execute_command(
        self,
        code: str,
        *,
        user_id: str,
        command_id: str,
        hand_id: str | None,
        expected_phase: str,
        command_type: str,
        action: str = "",
        amount: int = 0,
        card_indexes: list[int] | None = None,
    ) -> CommandResult:
        """Validate, deduplicate and apply one client command atomically."""

        with self._lock:
            if self._store:
                room, result = self._store.mutate(
                    code,
                    lambda persisted: self._execute_command_on_room(
                        persisted,
                        user_id=user_id,
                        command_id=command_id,
                        hand_id=hand_id,
                        expected_phase=expected_phase,
                        command_type=command_type,
                        action=action,
                        amount=amount,
                        card_indexes=card_indexes,
                    ),
                )
                self._rooms[room.code] = room
                return CommandResult(room, result.state, result.duplicate)
            room = self.get_room(code)
            return self._execute_command_on_room(
                room,
                user_id=user_id,
                command_id=command_id,
                hand_id=hand_id,
                expected_phase=expected_phase,
                command_type=command_type,
                action=action,
                amount=amount,
                card_indexes=card_indexes,
            )

    def _execute_command_on_room(
        self,
        room: Room,
        *,
        user_id: str,
        command_id: str,
        hand_id: str | None,
        expected_phase: str,
        command_type: str,
        action: str = "",
        amount: int = 0,
        card_indexes: list[int] | None = None,
    ) -> CommandResult:
        """Apply one command to a caller-supplied authoritative snapshot."""

        self._rooms[room.code] = room
        with self._lock:
            self._player(room, user_id)
            self._prune_command_receipts(room)
            normalized_type = command_type.strip().lower()
            normalized_action = action.strip().lower()
            normalized_indexes = tuple(sorted(set(card_indexes or [])))
            fingerprint = (
                normalized_type,
                hand_id,
                expected_phase,
                normalized_action,
                int(amount),
                normalized_indexes,
            )
            receipt_key = (user_id, command_id)
            receipt = room.command_receipts.get(receipt_key)
            if receipt is not None:
                if receipt.fingerprint != fingerprint:
                    raise P2PError(
                        "command_conflict",
                        "commandId was already used for a different command",
                    )
                return CommandResult(room, deepcopy(receipt.state), True)

            if room.hand_id != hand_id or room.phase != expected_phase:
                raise P2PError(
                    "stale_command",
                    "The hand or phase changed before this command was applied",
                )

            if normalized_type == "ready":
                self._ready_on_room(room, user_id=user_id)
            elif normalized_type == "action":
                self._act_on_room(
                    room,
                    user_id=user_id,
                    action=normalized_action,
                    amount=amount,
                )
            elif normalized_type == "draw":
                self._draw_on_room(
                    room,
                    user_id=user_id,
                    card_indexes=list(normalized_indexes),
                )
            else:
                raise P2PError("invalid_command", "Unsupported command type")

            state = self.public_state(room, viewer_id=user_id)
            state["acknowledgedCommandId"] = command_id
            room.command_receipts[receipt_key] = CommandReceipt(
                created_at=time.time(),
                fingerprint=fingerprint,
                state=deepcopy(state),
            )
            self._prune_command_receipts(room)
            return CommandResult(room, state, False)

    def legal_actions(self, room: Room, user_id: str) -> list[str]:
        if room.phase in DRAWING_PHASES:
            return ["draw"] if user_id == room.current_actor_id else []
        if room.phase not in BETTING_PHASES or room.current_actor_id != user_id:
            return []
        player = self._player(room, user_id)
        to_call = max(0, room.current_bet - player.bet)
        if to_call:
            actions = ["fold", "call"]
            if player.stack > to_call:
                actions.append("raise")
            return actions
        actions = ["check"]
        if player.stack > 0:
            actions.append("bet")
        return actions

    def public_state(self, room: Room, *, viewer_id: str | None = None) -> dict[str, Any]:
        with self._lock:
            viewer = room.players.get(viewer_id or "")
            to_call = max(0, room.current_bet - viewer.bet) if viewer else 0
            return {
                "roomCode": room.code,
                "viewerId": viewer_id,
                "ownerId": room.owner_id,
                "variantId": "badugi",
                "phase": room.phase,
                "sequenceId": room.sequence_id,
                "handId": room.hand_id,
                "handNumber": room.hand_number,
                "dealerSeat": room.dealer_seat,
                "pot": room.pot,
                "currentBet": room.current_bet,
                "toCall": to_call,
                "currentTurnPlayerId": room.current_actor_id,
                "legalActions": self.legal_actions(room, viewer_id) if viewer else [],
                "hand": list(viewer.hand) if viewer else [],
                "players": [
                    {
                        "id": player.user_id,
                        "displayName": player.display_name,
                        "seat": player.seat,
                        "stack": player.stack,
                        "bet": player.bet,
                        "ready": player.ready,
                        "connected": player.connected,
                        "folded": player.folded,
                        "cardCount": len(player.hand),
                    }
                    for player in sorted(room.players.values(), key=lambda entry: entry.seat)
                ],
                "showdown": room.showdown,
                "history": room.history[-20:],
                "config": {
                    "startingStack": room.starting_stack,
                    "smallBlind": room.small_blind,
                    "bigBlind": room.big_blind,
                    "ante": room.ante,
                },
            }

    def _new_code(self) -> str:
        for _ in range(100):
            code = "".join(self._rng.choice(ROOM_ALPHABET) for _ in range(6))
            if code not in self._rooms and not (self._store and self._store.exists(code)):
                return code
        raise P2PError("room_code_exhausted", "Could not allocate a room code")

    def _prune_expired_rooms(self) -> None:
        now = time.time()
        if self._store:
            self._store.prune_expired(now - ROOM_TTL_SECONDS)
        expired = [
            code
            for code, room in self._rooms.items()
            if room.closed
            or (
                now - room.updated_at > ROOM_TTL_SECONDS
                and not any(player.connected for player in room.players.values())
            )
        ]
        for code in expired:
            room = self._rooms.pop(code, None)
            if self._store and room and not room.closed:
                self._store.delete(code)

    @staticmethod
    def _prune_command_receipts(room: Room) -> None:
        cutoff = time.time() - COMMAND_RECEIPT_TTL_SECONDS
        expired = [
            key
            for key, receipt in room.command_receipts.items()
            if receipt.created_at < cutoff
        ]
        for key in expired:
            room.command_receipts.pop(key, None)
        while len(room.command_receipts) > MAX_COMMAND_RECEIPTS_PER_ROOM:
            room.command_receipts.pop(next(iter(room.command_receipts)))

    @staticmethod
    def _player(room: Room, user_id: str) -> Player:
        player = room.players.get(user_id)
        if not player:
            raise P2PError("not_in_room", "Player is not in this room")
        return player

    @staticmethod
    def _other_player(room: Room, user_id: str) -> Player | None:
        return next((player for player in room.players.values() if player.user_id != user_id), None)

    def _start_hand(self, room: Room) -> None:
        if any(player.stack <= 0 for player in room.players.values()):
            for player in room.players.values():
                player.stack = room.starting_stack
        room.hand_number += 1
        if room.hand_number > 1:
            room.dealer_seat = 1 - room.dealer_seat
        room.deck = list(DECK)
        self._rng.shuffle(room.deck)
        room.pot = 0
        room.current_bet = 0
        room.showdown = None
        room.acted.clear()
        room.pending_draw.clear()
        for player in room.players.values():
            player.ready = False
            player.folded = False
            player.bet = 0
            player.hand = [room.deck.pop() for _ in range(4)]
            self._pay(room, player, room.ante)
        dealer = next(player for player in room.players.values() if player.seat == room.dealer_seat)
        opponent = self._other_player(room, dealer.user_id)
        self._pay(room, dealer, room.small_blind)
        if opponent:
            self._pay(room, opponent, room.big_blind)
        room.current_bet = max(player.bet for player in room.players.values())
        room.phase = "bet_0"
        room.current_actor_id = dealer.user_id
        self._record(room, "hand_started", user_id=None, amount=0)

    @staticmethod
    def _pay(room: Room, player: Player, amount: int) -> int:
        paid = max(0, min(int(amount), player.stack))
        player.stack -= paid
        player.bet += paid
        room.pot += paid
        return paid

    def _betting_round_complete(self, room: Room) -> bool:
        active = [player for player in room.players.values() if not player.folded]
        if any(player.stack == 0 for player in active):
            return len(room.acted) == len(active) and len({player.bet for player in active if player.stack > 0}) <= 1
        return len(room.acted) == len(active) and len({player.bet for player in active}) == 1

    def _refund_uncalled_bet(self, room: Room) -> None:
        active = [player for player in room.players.values() if not player.folded]
        if len(active) != 2 or active[0].bet == active[1].bet:
            return
        higher, lower = sorted(active, key=lambda player: player.bet, reverse=True)
        refund = higher.bet - lower.bet
        higher.bet -= refund
        higher.stack += refund
        room.pot -= refund
        room.current_bet = lower.bet
        self._record(room, "uncalled_refund", user_id=higher.user_id, amount=refund)

    def _advance_from_betting(self, room: Room) -> None:
        round_number = int(room.phase[-1])
        if round_number >= 3:
            self._finish_showdown(room)
            return
        room.phase = f"draw_{round_number + 1}"
        room.pending_draw = {player.user_id for player in room.players.values() if not player.folded}
        first = next(player for player in room.players.values() if player.seat != room.dealer_seat)
        room.current_actor_id = first.user_id
        room.acted.clear()
        self._bump(room)

    def _reset_betting_round(self, room: Room) -> None:
        for player in room.players.values():
            player.bet = 0
        room.current_bet = 0
        room.acted.clear()
        first = next(player for player in room.players.values() if player.seat != room.dealer_seat)
        room.current_actor_id = first.user_id
        self._bump(room)

    def _finish_showdown(self, room: Room) -> None:
        active = [player for player in room.players.values() if not player.folded]
        if not active:
            self._finish_hand(room, winner_ids=[], reason="showdown")
            return
        best = max(badugi_rank(player.hand) for player in active)
        winners = [player.user_id for player in active if badugi_rank(player.hand) == best]
        self._finish_hand(room, winner_ids=winners, reason="showdown", reveal=True)

    def _finish_hand(
        self,
        room: Room,
        *,
        winner_ids: list[str],
        reason: str,
        reveal: bool = False,
    ) -> None:
        pot = room.pot
        if winner_ids:
            share, remainder = divmod(pot, len(winner_ids))
            for index, user_id in enumerate(winner_ids):
                room.players[user_id].stack += share + (1 if index < remainder else 0)
        room.phase = "showdown"
        room.current_actor_id = None
        room.pending_draw.clear()
        room.acted.clear()
        room.showdown = {
            "reason": reason,
            "winnerIds": winner_ids,
            "pot": pot,
            "hands": {
                player.user_id: list(player.hand)
                for player in room.players.values()
            } if reveal else {},
        }
        room.pot = 0
        for player in room.players.values():
            player.bet = 0
            player.ready = False
        self._record(room, "hand_finished", user_id=None, amount=pot)

    def _record(self, room: Room, event: str, *, user_id: str | None, amount: int = 0) -> None:
        sequence = self._bump(room)
        room.history.append(
            {
                "sequenceId": sequence,
                "event": event,
                "playerId": user_id,
                "amount": amount,
                "phase": room.phase,
                "handId": room.hand_id,
                "timestamp": time.time(),
            }
        )
        room.history = room.history[-200:]

    @staticmethod
    def _bump(room: Room) -> int:
        room.sequence_id += 1
        room.updated_at = time.time()
        return room.sequence_id


p2p_room_manager = P2PRoomManager()
