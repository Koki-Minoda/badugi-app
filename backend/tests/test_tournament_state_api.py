from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core import db
from app.main import app
from app.models import Base

client = TestClient(app)


def auth_headers():
    return {"Authorization": "Bearer demo-token"}


def sample_snapshot():
    return {
        "tournamentId": "store-mtt",
        "level": 2,
        "heroPlayerId": "hero-player",
        "players": [
            {"playerId": "hero-player", "name": "Hero", "stack": 480, "isBust": False},
            {"playerId": "cpu-1", "name": "CPU 1", "stack": 0, "isBust": True},
        ],
        "tables": [
            {
                "tableId": "table-1",
                "seats": [
                    {"seatIndex": 0, "playerId": "hero-player"},
                    {"seatIndex": 1, "playerId": None},
                ],
            }
        ],
        "currentState": {"status": "waiting_for_next_hand", "lastHandId": "hand-10"},
    }


def setup_sqlite(monkeypatch):
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    Base.metadata.create_all(bind=engine)
    SessionTesting = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    monkeypatch.setattr(db, "engine", engine)
    monkeypatch.setattr(db, "SessionLocal", SessionTesting)
    return engine, SessionTesting


def teardown_sqlite(engine, session_factory):
    session_factory.close_all()
    engine.dispose()


def test_resume_without_snapshot_returns_false(monkeypatch):
    engine, SessionTesting = setup_sqlite(monkeypatch)
    try:
        response = client.post("/api/tournament/resume", headers=auth_headers())
        assert response.status_code == 200
        payload = response.json()
        assert payload["hasSnapshot"] is False
    finally:
        teardown_sqlite(engine, SessionTesting)


def test_save_resume_and_retire_flow(monkeypatch):
    engine, SessionTesting = setup_sqlite(monkeypatch)
    try:
        response = client.post(
            "/api/tournament/save",
            json={"snapshot": sample_snapshot()},
            headers=auth_headers(),
        )
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

        resume = client.post("/api/tournament/resume", headers=auth_headers())
        assert resume.status_code == 200
        resume_payload = resume.json()
        assert resume_payload["hasSnapshot"] is True
        assert resume_payload["snapshot"]["tournamentId"] == "store-mtt"

        retire = client.post("/api/tournament/retire", headers=auth_headers())
        assert retire.status_code == 200
        assert retire.json()["status"] == "retired"

        resume_after_retire = client.post(
            "/api/tournament/resume", headers=auth_headers()
        )
        assert resume_after_retire.status_code == 200
        assert resume_after_retire.json()["hasSnapshot"] is False
    finally:
        teardown_sqlite(engine, SessionTesting)

