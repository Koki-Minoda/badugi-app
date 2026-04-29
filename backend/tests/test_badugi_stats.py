from datetime import datetime, timedelta
from types import SimpleNamespace

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import close_all_sessions, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core import db
from app.dependencies.auth import get_current_user
from app.main import app
from app.models import BadugiHandAction, Base

client = TestClient(app)


def auth_headers():
    return {"Authorization": "Bearer demo-token"}


def setup_sqlite(monkeypatch):
    engine = create_engine(
        "sqlite+pysqlite://",
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    SessionTesting = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    monkeypatch.setattr(db, "engine", engine)
    monkeypatch.setattr(db, "SessionLocal", SessionTesting)
    return engine, SessionTesting


def teardown_sqlite(engine, session_factory):
    close_all_sessions()
    engine.dispose()


def test_badugi_stats_computation(monkeypatch):
    engine, SessionTesting = setup_sqlite(monkeypatch)
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1, name="demo")
    try:
        session = SessionTesting()
        base_ts = datetime.utcnow()
        session.add_all(
            [
                BadugiHandAction(
                    hand_id="h1",
                    player_id="hero",
                    seat_index=0,
                    phase="BET",
                    round=0,
                    action="Small Blind",
                    action_type="blind",
                    paid=5,
                    is_forced=True,
                    ts=base_ts,
                ),
                BadugiHandAction(
                    hand_id="h1",
                    player_id="hero",
                    seat_index=0,
                    phase="BET",
                    round=0,
                    action="Call",
                    action_type="call",
                    paid=10,
                    is_forced=False,
                    ts=base_ts + timedelta(seconds=1),
                ),
                BadugiHandAction(
                    hand_id="h1",
                    player_id="hero",
                    seat_index=0,
                    phase="BET",
                    round=0,
                    action="Raise",
                    action_type="raise",
                    paid=20,
                    is_forced=False,
                    ts=base_ts + timedelta(seconds=2),
                ),
                BadugiHandAction(
                    hand_id="h2",
                    player_id="hero",
                    seat_index=0,
                    phase="BET",
                    round=0,
                    action="Fold",
                    action_type="fold",
                    paid=0,
                    is_forced=False,
                    ts=base_ts + timedelta(seconds=3),
                ),
            ]
        )
        session.commit()
        session.close()

        response = client.get(
            "/api/badugi/stats",
            params={"player_id": "hero", "limit_hands": 200},
            headers=auth_headers(),
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["hands"] == 2
        assert payload["vpip"] == 1
        assert payload["pfr"] == 1
        assert payload["vpipRate"] == 0.5
        assert payload["pfrRate"] == 0.5
        assert payload["af"] == 2
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        teardown_sqlite(engine, SessionTesting)


def test_badugi_stats_requires_player_id(monkeypatch):
    engine, SessionTesting = setup_sqlite(monkeypatch)
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1, name="demo")
    try:
        response = client.get("/api/badugi/stats", headers=auth_headers())
        assert response.status_code == 400
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        teardown_sqlite(engine, SessionTesting)
