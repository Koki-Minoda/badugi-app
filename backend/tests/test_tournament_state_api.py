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


def sample_client_snapshot():
    return {
        "version": 1,
        "savedAt": "2026-08-27T04:00:00.000Z",
        "stageId": "local",
        "variantId": "badugi",
        "config": {"id": "local-mtt", "stageId": "local"},
        "tournamentState": {
            "config": {"id": "local-mtt", "stageId": "local"},
            "players": {"hero-player": {"id": "hero-player", "stack": 760}},
            "tables": [],
            "levelIndex": 1,
            "isFinished": False,
        },
        "hero": {"playerId": "hero-player", "stack": 760},
        "hud": {
            "handsPlayedThisLevel": 2,
            "nextBreakLabel": "L5後 · 7分",
            "breakState": None,
        },
    }


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


def test_resume_without_snapshot_returns_false(monkeypatch):
    engine, SessionTesting = setup_sqlite(monkeypatch)
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1, name="demo")
    try:
        response = client.post("/api/tournament/resume", headers=auth_headers())
        assert response.status_code == 200
        payload = response.json()
        assert payload["hasSnapshot"] is False
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        teardown_sqlite(engine, SessionTesting)


def test_save_resume_and_retire_flow(monkeypatch):
    engine, SessionTesting = setup_sqlite(monkeypatch)
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1, name="demo")
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
        app.dependency_overrides.pop(get_current_user, None)
        teardown_sqlite(engine, SessionTesting)


def test_save_and_resume_lossless_product_client_snapshot(monkeypatch):
    engine, SessionTesting = setup_sqlite(monkeypatch)
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=2, name="player")
    try:
        snapshot = sample_client_snapshot()
        saved = client.post(
            "/api/tournament/save",
            json={"snapshot": snapshot},
            headers=auth_headers(),
        )
        assert saved.status_code == 200

        resumed = client.post("/api/tournament/resume", headers=auth_headers())
        assert resumed.status_code == 200
        assert resumed.json() == {"hasSnapshot": True, "snapshot": snapshot}
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        teardown_sqlite(engine, SessionTesting)


def test_rejects_oversized_product_client_snapshot(monkeypatch):
    engine, SessionTesting = setup_sqlite(monkeypatch)
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=3, name="player")
    try:
        snapshot = sample_client_snapshot()
        snapshot["tournamentState"]["padding"] = "x" * 2_000_000
        response = client.post(
            "/api/tournament/save",
            json={"snapshot": snapshot},
            headers=auth_headers(),
        )
        assert response.status_code == 422
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        teardown_sqlite(engine, SessionTesting)
