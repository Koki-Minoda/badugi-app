from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.badugi_log import _reset_recent_logs
from app.core import db
from app.main import app
from app.models import Base

client = TestClient(app)


@pytest.fixture()
def sqlite_db(monkeypatch):
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    Base.metadata.create_all(bind=engine)
    SessionTesting = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    monkeypatch.setattr(db, "engine", engine)
    monkeypatch.setattr(db, "SessionLocal", SessionTesting)
    yield
    SessionTesting.close_all()
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
