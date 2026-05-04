import os  # [tournament-feedback]
from types import SimpleNamespace  # [tournament-feedback]

os.environ.setdefault("BACKEND_DB_DRIVER", "sqlite")  # [tournament-feedback]
os.environ.setdefault("BACKEND_DB_NAME", ":memory:")  # [tournament-feedback]

from fastapi.testclient import TestClient

from app.dependencies.auth import get_current_user  # [tournament-feedback]
from app.main import app
from app.api import analysis_chatgpt


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


def sample_play_feedback(hand_count=30):
    return {
        "schemaVersion": 1,
        "mode": "cash",
        "variantScope": "mixed",
        "minHands": 30,
        "handCount": hand_count,
        "heroSeat": 0,
        "summary": {
            "hands": hand_count,
            "vpip": 0.38,
            "pfr": 0.18,
            "showdownRate": 0.32,
            "allInRate": 0.04,
            "splitPotRate": 0.08,
            "netChips": 240,
            "variants": {"badugi": 18, "D01": 12},
            "topIssues": [
                {
                    "handId": "hand-9",
                    "type": "final_street_overcall",
                    "detail": "Called one bet too wide",
                    "displayName": "Hero Name",
                    "email": "hero@example.com",
                }
            ],
        },
        "promptContext": {
            "requestedOutput": ["良かった点", "悪かった点"],
            "userName": "Hero Name",
        },
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


def test_play_feedback_endpoint_returns_sanitized_payload(monkeypatch):
    captured = {}

    def fake_get_play_feedback_advice(session_payload):
        captured["session_payload"] = session_payload
        return {"adviceJa": "セッション助言", "adviceEn": "Session advice"}

    monkeypatch.setattr(
        "app.api.analysis_chatgpt.get_play_feedback_advice",
        fake_get_play_feedback_advice,
    )
    analysis_chatgpt._feedback_rate_limit.clear()
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=2, name="demo")
    try:
        response = client.post(
            "/api/analysis/play-feedback",
            json=sample_play_feedback(),
            headers=auth_headers(),
        )
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        analysis_chatgpt._feedback_rate_limit.clear()

    assert response.status_code == 200
    body = response.json()
    assert body["adviceJa"] == "セッション助言"
    assert body["adviceEn"] == "Session advice"
    assert body["source"] == "openai"
    assert body["acceptedHandCount"] == 30
    assert body["piiRemoved"] is True
    assert captured["session_payload"]["promptContext"]["userName"] == "[redacted]"
    assert captured["session_payload"]["summary"]["topIssues"][0]["email"] == "[redacted]"
    assert captured["session_payload"]["summary"]["topIssues"][0]["displayName"] == "[redacted]"


def test_play_feedback_endpoint_requires_minimum_hands(monkeypatch):
    analysis_chatgpt._feedback_rate_limit.clear()
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=3, name="demo")
    try:
        response = client.post(
            "/api/analysis/play-feedback",
            json=sample_play_feedback(hand_count=29),
            headers=auth_headers(),
        )
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        analysis_chatgpt._feedback_rate_limit.clear()

    assert response.status_code == 422


def test_play_feedback_endpoint_rate_limits(monkeypatch):
    monkeypatch.setattr(
        "app.api.analysis_chatgpt.get_play_feedback_advice",
        lambda session_payload: {"adviceJa": "ok", "adviceEn": "ok"},
    )
    analysis_chatgpt._feedback_rate_limit.clear()
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=4, name="demo")
    try:
        statuses = [
            client.post(
                "/api/analysis/play-feedback",
                json=sample_play_feedback(),
                headers=auth_headers(),
            ).status_code
            for _ in range(analysis_chatgpt.RATE_LIMIT_MAX_REQUESTS + 1)
        ]
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        analysis_chatgpt._feedback_rate_limit.clear()

    assert statuses[:-1] == [200] * analysis_chatgpt.RATE_LIMIT_MAX_REQUESTS
    assert statuses[-1] == 429
