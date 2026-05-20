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


def teardown_sqlite(engine):
    close_all_sessions()
    engine.dispose()


def test_cpu_decision_metadata_persists_in_badugi_action_log(monkeypatch):
    engine, session_factory = setup_sqlite(monkeypatch)
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1, name="demo")
    try:
        metadata = {
            "sessionId": "qa-session-telemetry",
            "mode": "cash",
            "variantId": "D01",
            "actorSeat": 2,
            "isCpu": True,
            "decisionSource": "heuristic",
            "fallbackReason": None,
            "legalActions": ["fold", "call", "raise"],
            "selectedAction": "raise",
            "finalAction": "raise",
            "cpuPolicy": "standard",
            "aiTier": "standard",
            "street": "BET",
            "drawRound": 1,
            "betRound": 1,
            "toCall": 20,
            "canRaise": True,
            "handStrengthBucket": "strong",
            "madeBadugi": True,
            "patState": "pat",
            "drawCount": 0,
            "streetStrengthEstimate": 0.91,
            "aggressionOpportunity": True,
            "valueBetOpportunity": True,
            "showdownEquityBucket": "strong",
        }
        response = client.post(
            "/api/badugi/actions/batch",
            json={
                "actions": [
                    {
                        "hand_id": "cpu-telemetry-hand-1",
                        "player_id": "cpu-seat-2",
                        "seat_index": 2,
                        "phase": "BET",
                        "round": 1,
                        "action": "Raise",
                        "paid": 20,
                        "metadata": metadata,
                    }
                ]
            },
            headers=auth_headers(),
        )
        assert response.status_code == 200
        assert response.json()["inserted"] == 1

        session = session_factory()
        try:
            row = session.query(BadugiHandAction).filter_by(hand_id="cpu-telemetry-hand-1").one()
            assert row.metadata_json["sessionId"] == "qa-session-telemetry"
            assert row.metadata_json["isCpu"] is True
            assert row.metadata_json["decisionSource"] == "heuristic"
            assert row.metadata_json["legalActions"] == ["fold", "call", "raise"]
            assert row.metadata_json["madeBadugi"] is True
            assert row.metadata_json["patState"] == "pat"
            assert row.metadata_json["drawCount"] == 0
            assert row.metadata_json["valueBetOpportunity"] is True
            assert row.metadata_json["showdownEquityBucket"] == "strong"
            assert "rawStateVector" not in row.metadata_json
            assert "holeCards" not in row.metadata_json
        finally:
            session.close()
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        teardown_sqlite(engine)
