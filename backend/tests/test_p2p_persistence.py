from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import Base
from app.p2p.manager import P2PRoomManager
from app.p2p.persistence import SQLAlchemyRoomStore
from app.p2p.manager import ROOM_TTL_SECONDS


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
