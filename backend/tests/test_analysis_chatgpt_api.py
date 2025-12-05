import os  # [tournament-feedback]
from types import SimpleNamespace  # [tournament-feedback]

os.environ.setdefault("BACKEND_DB_DRIVER", "sqlite")  # [tournament-feedback]
os.environ.setdefault("BACKEND_DB_NAME", ":memory:")  # [tournament-feedback]

from fastapi.testclient import TestClient

from app.dependencies.auth import get_current_user  # [tournament-feedback]
from app.main import app


client = TestClient(app)


def auth_headers():
    return {"Authorization": "Bearer demo-token"}


def sample_worst_spot():
    return {
        "handId": "hand-42",
        "street": "predraw",
        "action": "RAISE",
        "chipDelta": -120,
        "heroHand": ["3D", "TS", "AC", "2H"],
        "drawnCards": 1,
        "potSize": 240,
        "opponentAggression": "high",
        "actionHistory": [
            {"street": "predraw", "action": "BET", "amount": 40, "drawCount": None},
            {"street": "draw", "action": "DRAW", "amount": 0, "drawCount": 2},
        ],
    }


def test_advice_endpoint_returns_payload(monkeypatch):
    captured = {}

    # [tournament-feedback] Stub the OpenAI client to avoid real calls.
    def fake_get_chatgpt_advice(worst_spot):
        captured["worst_spot"] = worst_spot
        return {"adviceJa": "テスト助言", "adviceEn": "Test"}  # [tournament-feedback]

    monkeypatch.setattr("app.api.analysis_chatgpt.get_chatgpt_advice", fake_get_chatgpt_advice)

    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1, name="demo")  # [tournament-feedback]
    try:
        response = client.post(
            "/api/analysis/advice",
            json=sample_worst_spot(),
            headers=auth_headers(),
        )
    finally:
        app.dependency_overrides.pop(get_current_user, None)  # [tournament-feedback]

    assert response.status_code == 200
    body = response.json()
    assert body["adviceJa"] == "テスト助言"  # [tournament-feedback]
    assert body["adviceEn"] == "Test"  # [tournament-feedback]
    assert captured["worst_spot"]["handId"] == "hand-42"


def test_advice_endpoint_requires_auth():
    response = client.post("/api/analysis/advice", json=sample_worst_spot())
    assert response.status_code == 401
