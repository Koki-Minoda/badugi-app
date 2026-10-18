"""A queued P2P cleanup must leave the loop free to release DB connections."""
import asyncio

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api import p2p
from app.models import Base
from app.p2p.manager import P2PRoomManager
from app.p2p.persistence import SQLAlchemyRoomStore


def test_account_room_cleanup_allows_connection_finalizers_to_run(tmp_path, monkeypatch):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'pool.sqlite'}", pool_size=1,
        max_overflow=0, pool_timeout=0.25,
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    manager = P2PRoomManager()
    manager.attach_store(SQLAlchemyRoomStore(sessionmaker(bind=engine)))
    monkeypatch.setattr(p2p, "p2p_room_manager", manager)

    async def exercise():
        held = engine.connect()
        async def finish_other_request():
            await asyncio.sleep(0.02)
            held.close()
        finalizer = asyncio.create_task(finish_other_request())
        try:
            await p2p.terminate_user_p2p_sessions("absent-user")
        finally:
            await finalizer
            held.close()
        assert engine.pool.checkedout() == 0

    try:
        asyncio.run(exercise())
    finally:
        engine.dispose()
