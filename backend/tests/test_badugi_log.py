from datetime import datetime, timezone

from types import SimpleNamespace

import pytest

from app.dependencies.auth import get_current_user
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import close_all_sessions, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.badugi_log import _reset_recent_logs
from app.core import db
from app.main import app
from app.models import Base

client = TestClient(app)


@pytest.fixture(autouse=True)
def owner():
    previous = app.dependency_overrides.copy()
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1)
    _reset_recent_logs()
    yield
    app.dependency_overrides.clear()
    app.dependency_overrides.update(previous)
    _reset_recent_logs()


@pytest.fixture()
def sqlite_db(monkeypatch):
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
    yield
    close_all_sessions()
    engine.dispose()


def _sample_hand_payload(hand_id: str = "hand-001"):
    return {
        "hand_id": hand_id,
        "created_at": datetime.now(tz=timezone.utc).isoformat(),
        "actions": [
            {
                "seat_index": 0,
                "player_id": "p1",
                "action": "bet",
                "amount": 10,
                "round": 0,
                "phase": "BET",
            }
        ],
        "results": [
            {
                "seat_index": 0,
                "player_id": "p1",
                "final_stack": 120,
                "hand_label": "4-card A-4-7-K",
                "is_winner": True,
                "pot_share": 50,
            }
        ],
    }


def test_post_badugi_hand_log_accepts_payload(sqlite_db):
    _reset_recent_logs()
    payload = _sample_hand_payload()
    response = client.post("/api/badugi/hands", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["hand_id"] == payload["hand_id"]
    assert data["accepted"] is True


def test_recent_endpoint_returns_logged_hand(sqlite_db):
    _reset_recent_logs()
    payload = _sample_hand_payload(hand_id="hand-xyz")
    client.post("/api/badugi/hands", json=payload)
    response = client.get("/api/badugi/hands/recent")
    assert response.status_code == 200
    items = response.json().get("items", [])
    assert any(entry["hand_id"] == "hand-xyz" for entry in items)


def test_invalid_payload_missing_hand_id_returns_422():
    _reset_recent_logs()
    payload = _sample_hand_payload()
    payload.pop("hand_id")
    response = client.post("/api/badugi/hands", json=payload)
    assert response.status_code == 422


def test_structured_history_requires_authentication(sqlite_db):
    app.dependency_overrides.pop(get_current_user)
    assert client.post("/api/badugi/hands", json=_sample_hand_payload()).status_code == 401
    for path in ("recent", "by-table/shared-table", "private-hand"):
        assert client.get(f"/api/badugi/hands/{path}").status_code == 401


def test_structured_history_owner_cannot_be_forged(sqlite_db):
    payload = _sample_hand_payload("private-hand")
    payload.update(table_id="shared-table", metadata={"_owner_user_id": 2})
    assert client.post("/api/badugi/hands", json=payload).status_code == 200
    assert len(client.get("/api/badugi/hands/recent").json()["items"]) == 1
    assert len(client.get("/api/badugi/hands/by-table/shared-table").json()["items"]) == 1
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=2)
    assert client.get("/api/badugi/hands/recent").json()["items"] == []
    assert client.get("/api/badugi/hands/by-table/shared-table").json()["items"] == []
    assert client.get("/api/badugi/hands/private-hand").status_code == 404


def test_unowned_legacy_history_is_not_exposed(sqlite_db):
    from app.models import HandLog
    with db.SessionLocal() as session:
        session.add(HandLog(hand_id="legacy", table_id="old-table", created_at=datetime.now(timezone.utc)))
        session.commit()
    assert client.get("/api/badugi/hands/recent").json()["items"] == []
    assert client.get("/api/badugi/hands/by-table/old-table").json()["items"] == []
    assert client.get("/api/badugi/hands/legacy").status_code == 404


def test_recent_fallback_keeps_owner_scope(sqlite_db, monkeypatch):
    from sqlalchemy.exc import SQLAlchemyError
    payload = _sample_hand_payload("cached")
    assert client.post("/api/badugi/hands", json=payload).status_code == 200
    class UnavailableSession:
        def execute(self, statement):
            raise SQLAlchemyError("unavailable")
        def close(self):
            pass
    monkeypatch.setattr(db, "SessionLocal", UnavailableSession)
    assert len(client.get("/api/badugi/hands/recent").json()["items"]) == 1
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=2)
    assert client.get("/api/badugi/hands/recent").json()["items"] == []
