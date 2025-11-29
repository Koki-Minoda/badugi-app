from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker

from app.core import db
from app.main import app
from app.models import Base, HandAction, HandLog, HandResult

client = TestClient(app)


@pytest.fixture()
def sqlite_db(monkeypatch):
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    Base.metadata.create_all(bind=engine)
    SessionTesting = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    monkeypatch.setattr(db, "engine", engine)
    monkeypatch.setattr(db, "SessionLocal", SessionTesting)
    yield engine
    SessionTesting.close_all()
    engine.dispose()


def _payload(hand_id: str = "hand-db-1"):
    return {
        "hand_id": hand_id,
        "table_id": "table-A",
        "created_at": datetime.now(tz=timezone.utc).isoformat(),
        "actions": [
            {"seat_index": 0, "player_id": "p1", "action": "bet", "amount": 25, "round": 0, "phase": "BET"},
            {"seat_index": 1, "player_id": "p2", "action": "fold", "amount": 0, "round": 0, "phase": "BET"},
        ],
        "results": [
            {"seat_index": 0, "player_id": "p1", "final_stack": 150, "hand_label": "A-2-3-4", "is_winner": True, "pot_share": 50},
            {"seat_index": 1, "player_id": "p2", "final_stack": 90, "hand_label": None, "is_winner": False, "pot_share": 0},
        ],
    }


def test_post_persists_hand_log(sqlite_db):
    response = client.post("/api/badugi/hands", json=_payload("persist-1"))
    assert response.status_code == 200
    assert response.json()["accepted"] is True

    session = db.SessionLocal()
    try:
        log = session.query(HandLog).filter_by(hand_id="persist-1").one()
        assert len(log.actions) == 2
        assert len(log.results) == 2
    finally:
        session.close()


def test_get_hand_log_by_id(sqlite_db):
    client.post("/api/badugi/hands", json=_payload("persist-2"))
    response = client.get("/api/badugi/hands/persist-2")
    assert response.status_code == 200
    body = response.json()
    assert body["hand_id"] == "persist-2"
    assert len(body["actions"]) == 2
    assert len(body["results"]) == 2


def test_post_handles_db_unreachable(monkeypatch):
    def _raise_session():
        raise SQLAlchemyError("db down")

    monkeypatch.setattr(db, "SessionLocal", _raise_session)

    response = client.post("/api/badugi/hands", json=_payload("fail-1"))
    assert response.status_code == 200
    body = response.json()
    assert body["accepted"] is False
    assert body["error"] == "db_unreachable"
