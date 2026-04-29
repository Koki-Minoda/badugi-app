from types import SimpleNamespace

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import close_all_sessions, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core import db
from app.dependencies.auth import get_current_user
from app.main import app
from app.models import Base

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


def test_actions_batch_insert_and_recent(monkeypatch):
    engine, SessionTesting = setup_sqlite(monkeypatch)
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1, name="demo")
    try:
        payload = {
            "actions": [
                {
                    "hand_id": "hand-1",
                    "player_id": "hero",
                    "seat_index": 0,
                    "phase": "BET",
                    "round": 0,
                    "action": "Call",
                    "paid": 10,
                },
                {
                    "hand_id": "hand-1",
                    "player_id": "hero",
                    "seat_index": 0,
                    "phase": "BET",
                    "round": 0,
                    "action": "Raise (All-in)",
                    "paid": 40,
                },
            ]
        }
        response = client.post(
            "/api/badugi/actions/batch",
            json=payload,
            headers=auth_headers(),
        )
        assert response.status_code == 200
        assert response.json()["inserted"] == 2

        recent = client.get(
            "/api/badugi/actions/recent",
            params={"player_id": "hero", "limit": 10},
            headers=auth_headers(),
        )
        assert recent.status_code == 200
        items = recent.json()["items"]
        assert len(items) == 2
        assert items[0]["player_id"] == "hero"
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        teardown_sqlite(engine, SessionTesting)


def test_actions_recent_requires_player_id(monkeypatch):
    engine, SessionTesting = setup_sqlite(monkeypatch)
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1, name="demo")
    try:
        response = client.get("/api/badugi/actions/recent", headers=auth_headers())
        assert response.status_code == 400
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        teardown_sqlite(engine, SessionTesting)


def test_actions_batch_requires_hand_id(monkeypatch):
    engine, SessionTesting = setup_sqlite(monkeypatch)
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1, name="demo")
    try:
        response = client.post(
            "/api/badugi/actions/batch",
            json={"actions": [{"action": "Call", "paid": 10}]},
            headers=auth_headers(),
        )
        assert response.status_code == 400
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        teardown_sqlite(engine, SessionTesting)
