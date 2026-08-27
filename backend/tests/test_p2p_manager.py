import asyncio
import time
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.core.security import create_access_token
from app.dependencies.auth import get_current_user
from app.api.p2p import RoomSockets
from app.main import app
from app.p2p.manager import (
    MAX_ACTIVE_ROOMS_PER_OWNER,
    MAX_COMMAND_RECEIPTS_PER_ROOM,
    COMMAND_RECEIPT_TTL_SECONDS,
    CommandReceipt,
    ROOM_TTL_SECONDS,
    P2PError,
    P2PRoomManager,
    badugi_rank,
    p2p_room_manager,
)


def test_badugi_rank_prefers_more_cards_then_lower_high_card():
    wheel = ["As", "2h", "3d", "4c"]
    five_high = ["2s", "3h", "4d", "5c"]
    paired_three_card = ["As", "Ah", "2d", "3c"]

    assert badugi_rank(wheel) > badugi_rank(five_high)
    assert badugi_rank(five_high) > badugi_rank(paired_three_card)


def _heads_up_room():
    manager = P2PRoomManager()
    room = manager.create_room(
        user_id="host",
        display_name="Host",
        starting_stack=1000,
        small_blind=10,
        big_blind=20,
    )
    manager.join_room(room.code, user_id="guest", display_name="Guest")
    return manager, room


def _check_through_round(manager, room):
    first = room.current_actor_id
    assert first
    manager.act(room.code, user_id=first, action="check")
    second = room.current_actor_id
    assert second and second != first
    manager.act(room.code, user_id=second, action="check")


def _draw_both(manager, room, selections=None):
    selections = selections or {"host": [], "guest": []}
    while room.phase.startswith("draw_"):
        user_id = room.current_actor_id
        assert user_id
        manager.draw(room.code, user_id=user_id, card_indexes=selections.get(user_id, []))


def test_heads_up_badugi_runs_three_draws_and_showdown_with_chip_conservation():
    manager, room = _heads_up_room()
    manager.ready(room.code, user_id="host")
    manager.ready(room.code, user_id="guest")

    assert room.phase == "bet_0"
    assert len(room.players["host"].hand) == 4
    assert len(room.players["guest"].hand) == 4
    assert room.pot == 30

    # Complete the blind round: dealer calls, big blind checks.
    first = room.current_actor_id
    manager.act(room.code, user_id=first, action="call")
    manager.act(room.code, user_id=room.current_actor_id, action="check")
    assert room.phase == "draw_1"

    _draw_both(manager, room, {"host": [0, 1], "guest": [0]})
    assert room.phase == "bet_1"
    _check_through_round(manager, room)
    assert room.phase == "draw_2"
    _draw_both(manager, room)
    _check_through_round(manager, room)
    assert room.phase == "draw_3"
    _draw_both(manager, room)
    _check_through_round(manager, room)

    assert room.phase == "showdown"
    assert room.showdown
    assert room.showdown["reason"] == "showdown"
    assert room.showdown["hands"].keys() == {"host", "guest"}
    assert sum(player.stack for player in room.players.values()) == 2000


def test_private_state_only_exposes_viewers_cards():
    manager, room = _heads_up_room()
    manager.ready(room.code, user_id="host")
    manager.ready(room.code, user_id="guest")

    host_state = manager.public_state(room, viewer_id="host")
    guest_state = manager.public_state(room, viewer_id="guest")

    assert host_state["hand"] == room.players["host"].hand
    assert guest_state["hand"] == room.players["guest"].hand
    assert host_state["hand"] != guest_state["hand"]
    assert all("hand" not in player for player in host_state["players"])


def test_room_rejects_spoofed_or_out_of_turn_actions():
    manager, room = _heads_up_room()
    manager.ready(room.code, user_id="host")
    manager.ready(room.code, user_id="guest")
    actor = room.current_actor_id
    other = "guest" if actor == "host" else "host"

    with pytest.raises(P2PError, match="not your turn"):
        manager.act(room.code, user_id=other, action="fold")
    with pytest.raises(P2PError, match="not in this room"):
        manager.act(room.code, user_id="spoofed", action="fold")


def test_post_draw_action_starts_left_of_dealer():
    manager, room = _heads_up_room()
    manager.ready(room.code, user_id="host")
    manager.ready(room.code, user_id="guest")
    manager.act(room.code, user_id=room.current_actor_id, action="call")
    manager.act(room.code, user_id=room.current_actor_id, action="check")
    _draw_both(manager, room)

    dealer = next(player for player in room.players.values() if player.seat == room.dealer_seat)
    assert room.current_actor_id != dealer.user_id


def test_draw_order_starts_left_of_dealer_and_rejects_early_dealer_draw():
    manager, room = _heads_up_room()
    manager.ready(room.code, user_id="host")
    manager.ready(room.code, user_id="guest")
    manager.act(room.code, user_id=room.current_actor_id, action="call")
    manager.act(room.code, user_id=room.current_actor_id, action="check")

    dealer = next(player for player in room.players.values() if player.seat == room.dealer_seat)
    assert room.current_actor_id != dealer.user_id
    with pytest.raises(P2PError, match="turn to draw"):
        manager.draw(room.code, user_id=dealer.user_id, card_indexes=[])


def test_heads_up_all_in_does_not_put_uncallable_chips_in_the_pot():
    manager, room = _heads_up_room()
    manager.ready(room.code, user_id="host")
    manager.ready(room.code, user_id="guest")
    actor = room.players[room.current_actor_id]
    opponent = manager._other_player(room, actor.user_id)
    assert opponent
    opponent.stack = 30

    before_total = sum(player.stack for player in room.players.values()) + room.pot
    manager.act(room.code, user_id=actor.user_id, action="raise", amount=500)
    assert room.current_bet == opponent.bet + opponent.stack
    manager.act(room.code, user_id=opponent.user_id, action="call")

    after_total = sum(player.stack for player in room.players.values()) + room.pot
    assert after_total == before_total
    assert len({player.bet for player in room.players.values()}) == 1


def test_next_match_resets_both_stacks_after_a_bust():
    manager, room = _heads_up_room()
    room.phase = "showdown"
    room.players["host"].stack = 2000
    room.players["guest"].stack = 0

    manager.ready(room.code, user_id="guest")
    assert room.players["guest"].stack == 0
    manager.ready(room.code, user_id="host")

    assert sum(player.stack for player in room.players.values()) + room.pot == 2000


def test_short_blind_cannot_win_uncalled_forced_chips():
    manager, room = _heads_up_room()
    room.players["host"].stack = 5
    room.players["guest"].stack = 395
    manager.ready(room.code, user_id="host")
    manager.ready(room.code, user_id="guest")

    assert room.current_actor_id == "host"
    manager.act(room.code, user_id="host", action="call")
    manager.act(room.code, user_id="guest", action="check")

    assert room.phase == "draw_1"
    assert room.pot == 10
    assert room.players["guest"].stack == 390
    assert room.history[-1]["event"] == "uncalled_refund"


def test_room_limit_and_expiry_bound_in_memory_rooms():
    manager = P2PRoomManager()
    rooms = [
        manager.create_room(user_id="host", display_name="Host")
        for _ in range(MAX_ACTIVE_ROOMS_PER_OWNER)
    ]
    with pytest.raises(P2PError, match="existing Friend Match"):
        manager.create_room(user_id="host", display_name="Host")

    rooms[0].updated_at -= ROOM_TTL_SECONDS + 1
    replacement = manager.create_room(user_id="host", display_name="Host")
    assert replacement.code != rooms[0].code


def test_command_receipts_have_ttl_and_per_room_upper_bound():
    manager, room = _heads_up_room()
    for index in range(MAX_COMMAND_RECEIPTS_PER_ROOM + 5):
        room.command_receipts[("host", f"command-{index}")] = CommandReceipt(
            created_at=time.time(),
            fingerprint=("ready", None, "waiting", "", 0, ()),
            state={"sequenceId": index},
        )
    manager._prune_command_receipts(room)
    assert len(room.command_receipts) == MAX_COMMAND_RECEIPTS_PER_ROOM
    assert ("host", "command-0") not in room.command_receipts

    oldest_key = next(iter(room.command_receipts))
    room.command_receipts[oldest_key].created_at -= COMMAND_RECEIPT_TTL_SECONDS + 1
    manager._prune_command_receipts(room)
    assert oldest_key not in room.command_receipts


def test_replaced_socket_cannot_mark_new_connection_disconnected():
    class FakeSocket:
        def __init__(self):
            self.closed = False

        async def accept(self, **_kwargs):
            return None

        async def close(self, **_kwargs):
            self.closed = True

    async def scenario():
        manager, room = _heads_up_room()
        sockets = RoomSockets()
        old_socket = FakeSocket()
        new_socket = FakeSocket()
        await sockets.connect(room, "host", old_socket)
        await sockets.connect(room, "host", new_socket)
        assert old_socket.closed
        assert await sockets.disconnect(room.code, "host", old_socket) is False
        assert await sockets.disconnect(room.code, "host", new_socket) is True

    asyncio.run(scenario())


@pytest.fixture(autouse=True)
def clear_runtime():
    p2p_room_manager.reset()
    app.dependency_overrides.clear()
    yield
    p2p_room_manager.reset()
    app.dependency_overrides.clear()


def _user(user_id, name):
    return SimpleNamespace(id=user_id, name=name, email=f"{name.lower()}@example.com")


def test_authenticated_rest_room_create_join_and_private_info():
    client = TestClient(app)
    app.dependency_overrides[get_current_user] = lambda: _user(1, "Host")
    created = client.post(
        "/api/p2p/rooms",
        json={"variantId": "badugi", "startingStack": 1000, "smallBlind": 10, "bigBlind": 20},
    )
    assert created.status_code == 200
    room_code = created.json()["roomCode"]
    assert len(room_code) == 6
    assert created.json()["players"][0]["displayName"] == "Host"

    app.dependency_overrides[get_current_user] = lambda: _user(2, "Guest")
    joined = client.post("/api/p2p/rooms/join", json={"roomCode": room_code})
    assert joined.status_code == 200
    assert [player["displayName"] for player in joined.json()["players"]] == ["Host", "Guest"]

    app.dependency_overrides[get_current_user] = lambda: _user(3, "Intruder")
    forbidden = client.get(f"/api/p2p/rooms/{room_code}")
    assert forbidden.status_code == 403


def test_authenticated_rest_fallback_runs_two_player_ready_draw_and_fold_flow():
    client = TestClient(app)
    host = _user(1, "Host")
    guest = _user(2, "Guest")

    app.dependency_overrides[get_current_user] = lambda: host
    created = client.post("/api/p2p/rooms", json={"variantId": "badugi"})
    room_code = created.json()["roomCode"]
    app.dependency_overrides[get_current_user] = lambda: guest
    assert client.post("/api/p2p/rooms/join", json={"roomCode": room_code}).status_code == 200

    assert client.post(
        f"/api/p2p/rooms/{room_code}/action",
        json={"type": "bet", "amount": "20"},
    ).status_code == 422
    assert client.post(
        f"/api/p2p/rooms/{room_code}/draw",
        json={"cardIndexes": [True]},
    ).status_code == 422

    app.dependency_overrides[get_current_user] = lambda: host
    host_ready = client.post(
        f"/api/p2p/rooms/{room_code}/ready",
        json={"commandId": "ready-host-0001", "handId": None, "expectedPhase": "waiting"},
    )
    assert host_ready.status_code == 200
    app.dependency_overrides[get_current_user] = lambda: guest
    started = client.post(
        f"/api/p2p/rooms/{room_code}/ready",
        json={"commandId": "ready-guest-001", "handId": None, "expectedPhase": "waiting"},
    )
    assert started.status_code == 200

    def state_for(user):
        app.dependency_overrides[get_current_user] = lambda: user
        response = client.get(f"/api/p2p/rooms/{room_code}/state")
        assert response.status_code == 200
        return response.json()

    host_state = state_for(host)
    guest_state = state_for(guest)
    assert len(host_state["hand"]) == len(guest_state["hand"]) == 4
    assert set(host_state["hand"]).isdisjoint(guest_state["hand"])
    assert all("hand" not in player for player in host_state["players"])
    app.dependency_overrides[get_current_user] = lambda: host
    private_response = client.get(f"/api/p2p/rooms/{room_code}/state")
    assert private_response.headers["cache-control"] == "private, no-store"

    actor, other = (
        (host, guest) if host_state["currentTurnPlayerId"] == "1" else (guest, host)
    )
    app.dependency_overrides[get_current_user] = lambda: actor
    action_command = {
        "commandId": "opening-call-001",
        "handId": host_state["handId"],
        "expectedPhase": "bet_0",
        "type": "call",
        "amount": 0,
    }
    called = client.post(
        f"/api/p2p/rooms/{room_code}/action",
        json=action_command,
    )
    assert called.status_code == 200
    room_after_call = p2p_room_manager.get_room(room_code)
    chips_after_call = (
        room_after_call.pot,
        tuple(player.stack for player in room_after_call.players.values()),
    )
    duplicate_call = client.post(
        f"/api/p2p/rooms/{room_code}/action",
        json=action_command,
    )
    assert duplicate_call.status_code == 200
    assert duplicate_call.json() == called.json()
    assert chips_after_call == (
        room_after_call.pot,
        tuple(player.stack for player in room_after_call.players.values()),
    )

    sequence_before_stale = room_after_call.sequence_id
    stale = client.post(
        f"/api/p2p/rooms/{room_code}/action",
        json={
            **action_command,
            "commandId": "stale-action-001",
            "handId": "OLD-HAND-1",
        },
    )
    assert stale.status_code == 409
    assert stale.json()["detail"]["code"] == "stale_command"
    assert room_after_call.sequence_id == sequence_before_stale

    stale_phase = client.post(
        f"/api/p2p/rooms/{room_code}/action",
        json={
            **action_command,
            "commandId": "stale-phase-0001",
            "expectedPhase": "draw_1",
        },
    )
    assert stale_phase.status_code == 409
    assert stale_phase.json()["detail"]["code"] == "stale_command"
    assert room_after_call.sequence_id == sequence_before_stale

    app.dependency_overrides[get_current_user] = lambda: other
    checked = client.post(
        f"/api/p2p/rooms/{room_code}/action",
        json={
            "commandId": "opening-check-01",
            "handId": called.json()["handId"],
            "expectedPhase": "bet_0",
            "type": "check",
            "amount": 0,
        },
    )
    assert checked.status_code == 200
    assert checked.json()["phase"] == "draw_1"

    for _ in range(2):
        host_state = state_for(host)
        drawer = host if "draw" in host_state["legalActions"] else guest
        app.dependency_overrides[get_current_user] = lambda drawer=drawer: drawer
        draw_command = {
            "commandId": f"draw-command-{_}",
            "handId": host_state["handId"],
            "expectedPhase": "draw_1",
            "cardIndexes": [0] if drawer is host else [],
        }
        drawn = client.post(
            f"/api/p2p/rooms/{room_code}/draw",
            json=draw_command,
        )
        assert drawn.status_code == 200
        if _ == 0:
            room_after_draw = p2p_room_manager.get_room(room_code)
            draw_state_after_ack = (
                tuple(room_after_draw.deck),
                tuple(
                    (player.user_id, tuple(player.hand), player.stack)
                    for player in room_after_draw.players.values()
                ),
                room_after_draw.pot,
                room_after_draw.sequence_id,
            )
            duplicate_draw = client.post(
                f"/api/p2p/rooms/{room_code}/draw",
                json=draw_command,
            )
            assert duplicate_draw.status_code == 200
            assert duplicate_draw.json() == drawn.json()
            assert draw_state_after_ack == (
                tuple(room_after_draw.deck),
                tuple(
                    (player.user_id, tuple(player.hand), player.stack)
                    for player in room_after_draw.players.values()
                ),
                room_after_draw.pot,
                room_after_draw.sequence_id,
            )
    assert drawn.json()["phase"] == "bet_1"

    host_state = state_for(host)
    bettor, folder = (
        (host, guest) if "bet" in host_state["legalActions"] else (guest, host)
    )
    app.dependency_overrides[get_current_user] = lambda: bettor
    assert client.post(
        f"/api/p2p/rooms/{room_code}/action",
        json={
            "commandId": "post-draw-bet-01",
            "handId": host_state["handId"],
            "expectedPhase": "bet_1",
            "type": "bet",
            "amount": 20,
        },
    ).status_code == 200
    app.dependency_overrides[get_current_user] = lambda: folder
    folded = client.post(
        f"/api/p2p/rooms/{room_code}/action",
        json={
            "commandId": "post-draw-fold-1",
            "handId": host_state["handId"],
            "expectedPhase": "bet_1",
            "type": "fold",
            "amount": 0,
        },
    )
    assert folded.status_code == 200
    assert folded.json()["phase"] == "showdown"
    assert folded.json()["showdown"]["reason"] == "fold"


def test_rest_fallback_state_requires_authentication():
    client = TestClient(app)
    response = client.get("/api/p2p/rooms/ABC234/state")
    assert response.status_code == 401


def test_lost_websocket_ack_retries_same_command_over_rest_without_mutation():
    client = TestClient(app)
    host = _user(1, "Host")
    guest = _user(2, "Guest")

    app.dependency_overrides[get_current_user] = lambda: host
    room_code = client.post("/api/p2p/rooms", json={"variantId": "badugi"}).json()["roomCode"]
    app.dependency_overrides[get_current_user] = lambda: guest
    assert client.post("/api/p2p/rooms/join", json={"roomCode": room_code}).status_code == 200

    for user, command_id in ((host, "ready-ws-host-1"), (guest, "ready-ws-guest1")):
        app.dependency_overrides[get_current_user] = lambda user=user: user
        assert client.post(
            f"/api/p2p/rooms/{room_code}/ready",
            json={"commandId": command_id, "handId": None, "expectedPhase": "waiting"},
        ).status_code == 200

    room = p2p_room_manager.get_room(room_code)
    actor_id = room.current_actor_id
    actor = host if actor_id == "1" else guest
    command = {
        "commandId": "ws-to-rest-call-1",
        "handId": room.hand_id,
        "expectedPhase": room.phase,
        "type": "call",
        "amount": 0,
    }
    token = create_access_token({"sub": actor_id})
    with client.websocket_connect(
        f"/ws/p2p/{room_code}", subprotocols=["mgx-auth", token]
    ) as websocket:
        assert websocket.receive_json()["event"] == "state"
        websocket.send_json({"event": "action", "payload": command})
        websocket_ack = websocket.receive_json()
        assert websocket_ack["event"] == "state"
        assert websocket_ack["commandId"] == command["commandId"]

    room_after_socket = p2p_room_manager.get_room(room_code)
    game_state_after_socket = (
        room_after_socket.pot,
        tuple(player.stack for player in room_after_socket.players.values()),
        tuple(room_after_socket.deck),
        tuple(tuple(player.hand) for player in room_after_socket.players.values()),
    )
    app.dependency_overrides[get_current_user] = lambda: actor
    retried = client.post(f"/api/p2p/rooms/{room_code}/action", json=command)
    assert retried.status_code == 200
    assert retried.json() == websocket_ack["payload"]
    assert game_state_after_socket == (
        room_after_socket.pot,
        tuple(player.stack for player in room_after_socket.players.values()),
        tuple(room_after_socket.deck),
        tuple(tuple(player.hand) for player in room_after_socket.players.values()),
    )


def test_websocket_requires_token_and_membership():
    client = TestClient(app)
    app.dependency_overrides[get_current_user] = lambda: _user(1, "Host")
    room_code = client.post("/api/p2p/rooms", json={"variantId": "badugi"}).json()["roomCode"]

    with client.websocket_connect(f"/ws/p2p/{room_code}") as websocket:
        with pytest.raises(WebSocketDisconnect) as closed:
            websocket.receive_json()
        assert closed.value.code == 4401

    outsider_token = create_access_token({"sub": "99"})
    with client.websocket_connect(
        f"/ws/p2p/{room_code}", subprotocols=["mgx-auth", outsider_token]
    ) as websocket:
        with pytest.raises(WebSocketDisconnect) as closed:
            websocket.receive_json()
        assert closed.value.code == 4401

    host_token = create_access_token({"sub": "1"})
    with client.websocket_connect(
        f"/ws/p2p/{room_code}", subprotocols=["mgx-auth", host_token]
    ) as websocket:
        state = websocket.receive_json()
        assert state["event"] == "state"
        assert state["payload"]["roomCode"] == room_code
        websocket.send_json({"event": "action", "payload": {"type": "bet", "amount": "bad"}})
        error = websocket.receive_json()
        assert error["event"] == "error"
        assert error["payload"]["code"] == "invalid_payload"
        websocket.send_json({"event": "sync", "payload": {}})
        assert websocket.receive_json()["event"] == "state"
