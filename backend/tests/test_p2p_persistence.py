import asyncio
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import Base
from app.p2p.manager import P2PRoomManager
from app.p2p.persistence import SQLAlchemyRoomStore
from app.p2p.manager import ROOM_TTL_SECONDS
from app.api.p2p import RoomSockets


def build_store(tmp_path):
    engine = create_engine(f"sqlite+pysqlite:///{tmp_path / 'p2p.db'}", future=True)
    Base.metadata.create_all(engine)
    return SQLAlchemyRoomStore(sessionmaker(bind=engine, expire_on_commit=False))


def test_room_survives_manager_restart_without_leaking_private_cards(tmp_path):
    store = build_store(tmp_path)
    first = P2PRoomManager()
    first.attach_store(store)
    room = first.create_room(user_id="1", display_name="Host")
    first.join_room(room.code, user_id="2", display_name="Guest")
    first.execute_command(
        room.code,
        user_id="1",
        command_id="ready-host-1",
        hand_id=None,
        expected_phase="waiting",
        command_type="ready",
    )
    guest_ready = first.execute_command(
        room.code,
        user_id="2",
        command_id="ready-guest-1",
        hand_id=None,
        expected_phase="waiting",
        command_type="ready",
    )

    restarted = P2PRoomManager()
    restarted.attach_store(store)
    recovered = restarted.get_room(room.code)
    host_state = restarted.public_state(recovered, viewer_id="1")
    guest_state = restarted.public_state(recovered, viewer_id="2")

    assert recovered.hand_id is not None
    assert len(host_state["hand"]) == 4
    assert len(guest_state["hand"]) == 4
    assert host_state["hand"] != guest_state["hand"]
    assert all("hand" not in player for player in host_state["players"])

    duplicate = restarted.execute_command(
        room.code,
        user_id="2",
        command_id="ready-guest-1",
        hand_id=None,
        expected_phase="waiting",
        command_type="ready",
    )
    assert duplicate.duplicate is True
    assert duplicate.state == guest_ready.state


def test_store_rejects_stale_snapshot_from_another_worker(tmp_path):
    store = build_store(tmp_path)
    manager = P2PRoomManager()
    manager.attach_store(store)
    room = manager.create_room(user_id="1", display_name="Host")
    stale = store.load(room.code)

    manager.join_room(room.code, user_id="2", display_name="Guest")

    stale.players["3"] = stale.players["1"]
    assert store.save(stale) is False
    latest = store.load(room.code)
    assert set(latest.players) == {"1", "2"}


def test_sequential_commands_converge_across_two_managers(tmp_path):
    store = build_store(tmp_path)
    first = P2PRoomManager()
    second = P2PRoomManager()
    first.attach_store(store)
    second.attach_store(store)
    room = first.create_room(user_id="1", display_name="Host")
    first.join_room(room.code, user_id="2", display_name="Guest")

    assert set(second.get_room(room.code).players) == {"1", "2"}
    first.execute_command(
        room.code,
        user_id="1",
        command_id="worker-one-ready",
        hand_id=None,
        expected_phase="waiting",
        command_type="ready",
    )
    assert second.get_room(room.code).players["1"].ready is True

    second.execute_command(
        room.code,
        user_id="2",
        command_id="worker-two-ready",
        hand_id=None,
        expected_phase="waiting",
        command_type="ready",
    )
    recovered = first.get_room(room.code)
    assert recovered.phase == "bet_0"
    assert recovered.hand_number == 1
    assert len(recovered.deck) == 44


def test_expired_uncached_room_is_pruned_from_database(tmp_path):
    store = build_store(tmp_path)
    first = P2PRoomManager()
    first.attach_store(store)
    room = first.create_room(user_id="expired-owner", display_name="Expired")

    stale = store.load(room.code)
    stale.updated_at -= ROOM_TTL_SECONDS + 1
    stale.sequence_id += 1
    assert store.save(stale) is True

    restarted = P2PRoomManager()
    restarted.attach_store(store)
    restarted.create_room(user_id="active-owner", display_name="Active")
    assert store.load(room.code) is None


def test_same_command_is_atomic_and_deduplicated_across_workers(tmp_path):
    store = build_store(tmp_path)
    first = P2PRoomManager()
    second = P2PRoomManager()
    first.attach_store(store)
    second.attach_store(store)
    room = first.create_room(user_id="1", display_name="Host")
    first.join_room(room.code, user_id="2", display_name="Guest")
    first.execute_command(
        room.code,
        user_id="1",
        command_id="atomic-ready-host",
        hand_id=None,
        expected_phase="waiting",
        command_type="ready",
    )
    second.execute_command(
        room.code,
        user_id="2",
        command_id="atomic-ready-guest",
        hand_id=None,
        expected_phase="waiting",
        command_type="ready",
    )
    started = store.load(room.code)
    actor_id = started.current_actor_id
    command = dict(
        code=room.code,
        user_id=actor_id,
        command_id="same-cross-worker-call",
        hand_id=started.hand_id,
        expected_phase=started.phase,
        command_type="action",
        action="call",
    )

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda manager: manager.execute_command(**command), [first, second]))

    assert sorted(result.duplicate for result in results) == [False, True]
    assert results[0].state == results[1].state
    latest = store.load(room.code)
    assert latest.sequence_id == results[0].state["sequenceId"]
    assert sum(player.stack for player in latest.players.values()) + latest.pot == 4000


def test_two_workers_survive_restart_and_complete_ten_hands(tmp_path):
    store = build_store(tmp_path)
    workers = [P2PRoomManager(), P2PRoomManager()]
    for worker in workers:
        worker.attach_store(store)
    room = workers[0].create_room(user_id="1", display_name="Host")
    workers[1].join_room(room.code, user_id="2", display_name="Guest")

    for hand_index in range(10):
        if hand_index == 5:
            workers = [P2PRoomManager(), P2PRoomManager()]
            for worker in workers:
                worker.attach_store(store)
        state = store.load(room.code)
        for player_index, user_id in enumerate(("1", "2")):
            workers[(hand_index + player_index) % 2].execute_command(
                room.code,
                user_id=user_id,
                command_id=f"ready-{hand_index}-{user_id}",
                hand_id=state.hand_id,
                expected_phase=state.phase,
                command_type="ready",
            )
            state = store.load(room.code)
        actor_id = state.current_actor_id
        workers[hand_index % 2].execute_command(
            room.code,
            user_id=actor_id,
            command_id=f"fold-{hand_index}-{actor_id}",
            hand_id=state.hand_id,
            expected_phase=state.phase,
            command_type="action",
            action="fold",
        )
        finished = store.load(room.code)
        assert finished.phase == "showdown"
        assert finished.hand_number == hand_index + 1
        assert sum(player.stack for player in finished.players.values()) == 4000


def test_durable_fanout_reaches_other_worker_and_owner_close_is_terminal(tmp_path):
    class FakeSocket:
        def __init__(self):
            self.messages = []
            self.close_code = None

        async def accept(self, **_kwargs):
            return None

        async def send_json(self, payload):
            self.messages.append(payload)

        async def close(self, *, code, reason):
            self.close_code = code

    async def scenario():
        store = build_store(tmp_path)
        first = P2PRoomManager()
        second = P2PRoomManager()
        first.attach_store(store)
        second.attach_store(store)
        room = first.create_room(user_id="1", display_name="Host")
        first.join_room(room.code, user_id="2", display_name="Guest")
        sockets = RoomSockets(second)
        socket = FakeSocket()
        remote_room = second.get_room(room.code)
        await sockets.connect(remote_room, "2", socket)
        await sockets.broadcast_state(remote_room)

        first.execute_command(
            room.code,
            user_id="1",
            command_id="fanout-ready-host",
            hand_id=None,
            expected_phase="waiting",
            command_type="ready",
        )
        await sockets.fanout_once()
        remote_state = socket.messages[-1]["payload"]
        assert remote_state["players"][0]["ready"] is True
        assert remote_state["hand"] == []
        assert all("hand" not in player for player in remote_state["players"])

        first.close_room(room.code, user_id="1")
        await sockets.fanout_once()
        assert socket.messages[-1]["event"] == "room_closed"
        assert socket.close_code == 4004

    asyncio.run(scenario())


def test_state_read_limit_is_shared_across_workers_and_scoped_per_user(tmp_path):
    store = build_store(tmp_path)
    arguments = dict(
        user_id="1",
        room_code="ROOM01",
        max_requests=4,
        window_seconds=10,
        bucket_ttl_seconds=60,
        max_buckets=16,
    )
    assert [store.consume_state_read(**arguments) for _ in range(4)] == [None] * 4
    assert store.consume_state_read(**arguments) >= 1
    assert store.consume_state_read(**{**arguments, "user_id": "2"}) is None

    bounded_path = tmp_path / "bounded"
    bounded_path.mkdir()
    bounded_store = build_store(bounded_path)
    bounded = {**arguments, "max_buckets": 1}
    assert bounded_store.consume_state_read(**bounded) is None
    assert bounded_store.consume_state_read(**{**bounded, "user_id": "2"}) >= 1
