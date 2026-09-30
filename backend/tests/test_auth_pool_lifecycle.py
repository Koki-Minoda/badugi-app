"""Regressions for production QueuePool exhaustion during nightly QM."""
import asyncio
from types import SimpleNamespace
from unittest.mock import MagicMock

from fastapi import Response
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.api import auth
from app.dependencies import auth as auth_dependency
from app.models import Base, User


def test_authenticated_endpoint_can_borrow_the_only_connection(tmp_path, monkeypatch):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'auth.sqlite'}",
        pool_size=1, max_overflow=0, pool_timeout=0.05,
    )
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine)
    with sessions() as session:
        user = User(email="pool@example.com", name="Pool", hashed_password="hash")
        session.add(user)
        session.commit()
        user_id = user.id
    monkeypatch.setattr(auth_dependency, "decode_access_token", lambda _: {"sub": str(user_id)})
    try:
        with sessions() as request_session:
            identity = auth_dependency.get_current_user("test-token", request_session)
            # P2P persistence borrows its own connection before the dependency
            # finalizer runs. This used to time out with authentication holding it.
            with engine.connect() as connection:
                assert connection.execute(text("SELECT 1")).scalar_one() == 1
            assert identity.id == user_id
            assert identity.email == "pool@example.com"
            assert identity.created_at is not None
            # Endpoints with their own SQL can still reuse the dependency session.
            assert request_session.get(User, user_id).name == "Pool"
    finally:
        engine.dispose()


def test_account_password_and_sql_work_do_not_block_the_event_loop(monkeypatch):
    from app.api import p2p

    def verify_off_loop(*_args):
        try:
            asyncio.get_running_loop()
        except RuntimeError:
            return True
        raise AssertionError("password verification blocks the server event loop")

    async def terminate(_user_id):
        pass

    monkeypatch.setattr(auth, "verify_password", verify_off_loop)
    monkeypatch.setattr(p2p, "terminate_user_p2p_sessions", terminate)
    session = MagicMock()
    result = asyncio.run(auth.delete_account(
        auth.DeleteAccountRequest(password="test"), Response(),
        SimpleNamespace(id=7, hashed_password="hash"), session,
    ))
    assert result == {"deleted": True}
    session.commit.assert_called_once()
