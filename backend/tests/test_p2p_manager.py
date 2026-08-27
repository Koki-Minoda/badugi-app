import asyncio
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
