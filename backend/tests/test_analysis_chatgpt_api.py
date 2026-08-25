import os  # [tournament-feedback]
import json
from types import SimpleNamespace  # [tournament-feedback]

os.environ.setdefault("BACKEND_DB_DRIVER", "sqlite")  # [tournament-feedback]
os.environ.setdefault("BACKEND_DB_NAME", ":memory:")  # [tournament-feedback]

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.db import get_db
from app.dependencies.auth import get_current_user  # [tournament-feedback]
from app.main import app
from app.api import analysis_chatgpt
from app.models import Base, PlayFeedbackResult


client = TestClient(app)
feedback_engine = create_engine(
    "sqlite+pysqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
FeedbackSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=feedback_engine)
Base.metadata.create_all(bind=feedback_engine)


def override_feedback_db():
    db = FeedbackSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def feedback_db_override():
    app.dependency_overrides[get_db] = override_feedback_db
    try:
        yield
    finally:
        app.dependency_overrides.pop(get_db, None)


def clear_feedback_results():
    with FeedbackSessionLocal() as db:
        db.query(PlayFeedbackResult).delete()
        db.commit()


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
        "keyHands": [
            {
                "situationId": "B-07",
                "reason": "large-result",
                "handId": "hand-9",
                "variantId": "badugi",
                "actionSeqRange": {"start": 3, "end": 5},
                "street": "BET",
                "position": "BTN",
                "heroAction": "call",
                "toCall": 40,
                "currentBet": 40,
                "pot": 240,
                "stackDepth": 800,
                "resultDelta": -120,
                "email": "hero@example.com",
            }
        ],
        "replayLinks": [
            {
                "situationId": "B-07",
                "handId": "hand-9",
                "variantId": "badugi",
                "actionSeqRange": {"start": 3, "end": 5},
                "replayTarget": {
                    "handId": "hand-9",
                    "actionSeqStart": 3,
                    "actionSeqEnd": 5,
                },
                "handExists": True,
            }
        ],
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
    clear_feedback_results()

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
    assert body["feedbackId"] is not None
    assert body["sessionKey"] == "cash:cash:mixed"
    assert body["storedAt"]
    assert captured["session_payload"]["promptContext"]["userName"] == "[redacted]"
    assert captured["session_payload"]["summary"]["topIssues"][0]["email"] == "[redacted]"
    assert captured["session_payload"]["summary"]["topIssues"][0]["displayName"] == "[redacted]"

    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=2, name="demo")
    try:
        results_response = client.get(
            "/api/analysis/play-feedback/results?session_key=cash:cash:mixed",
            headers=auth_headers(),
        )
    finally:
        app.dependency_overrides.pop(get_current_user, None)
    assert results_response.status_code == 200
    results = results_response.json()
    assert len(results) == 1
    assert results[0]["response"]["adviceJa"] == "セッション助言"
    assert results[0]["summary"]["hands"] == 30
    assert results[0]["keyHands"][0]["situationId"] == "B-07"
    assert results[0]["keyHands"][0]["email"] == "[redacted]"
    assert results[0]["replayLinks"][0]["handId"] == "hand-9"
    assert results[0]["replayLinks"][0]["handExists"] is True


def test_play_feedback_endpoint_requires_minimum_hands(monkeypatch):
    analysis_chatgpt._feedback_rate_limit.clear()
    clear_feedback_results()
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
    clear_feedback_results()
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


def test_play_feedback_accepts_standard_openai_api_key(monkeypatch):
    from app.core import openai_client

    captured = {}

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self):
            return json.dumps(
                {
                    "choices": [
                        {
                            "message": {
                                "content": json.dumps(
                                    {"adviceJa": "実キー経路", "adviceEn": "real key path"},
                                    ensure_ascii=False,
                                )
                            }
                        }
                    ]
                },
                ensure_ascii=False,
            ).encode("utf-8")

    def fake_urlopen(request, timeout):
        captured["authorization"] = request.headers.get("Authorization")
        captured["timeout"] = timeout
        return FakeResponse()

    monkeypatch.delenv("MGX_OPENAI_API_KEY", raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    response = openai_client.get_play_feedback_advice(sample_play_feedback())

    assert response["adviceJa"] == "実キー経路"
    assert captured["authorization"] == "Bearer test-key"
    assert captured["timeout"] == 60


def test_play_feedback_openai_payload_is_compacted(monkeypatch):
    from app.core import openai_client

    captured = {}
    payload = sample_play_feedback()
    payload["hands"] = [
        {
            "handId": f"hand-{idx}",
            "variantId": "badugi",
            "heroNet": -idx,
            "events": [{"type": "ACTION", "debug": "x" * 500}],
            "seats": [{"name": "Hero", "cards": ["AS", "2D", "3C", "4H"]}],
        }
        for idx in range(20)
    ]

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self):
            return json.dumps(
                {"output_text": json.dumps({"adviceJa": "圧縮済み", "adviceEn": "compact"})},
                ensure_ascii=False,
            ).encode("utf-8")

    def fake_urlopen(request, timeout):
        captured["wire_payload"] = json.loads(request.data.decode("utf-8"))
        return FakeResponse()

    monkeypatch.setenv("MGX_OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("MGX_OPENAI_API_MODE", "responses")
    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    response = openai_client.get_play_feedback_advice(payload)

    assert response["adviceJa"] == "圧縮済み"
    user_content = captured["wire_payload"]["input"][1]["content"]
    session_json = user_content.split("Session:\n", 1)[1]
    compact_session = json.loads(session_json)
    assert compact_session["compression"]["strategy"] == "summary_key_hands_v1"
    assert compact_session["compression"]["rawHandCount"] == 20
    assert len(compact_session["handSamples"]) == 8
    assert "events" not in compact_session["handSamples"][0]
    assert compact_session["keyHands"][0]["situationId"] == "B-07"
    assert compact_session["replayLinks"][0]["handId"] == "hand-9"
    assert compact_session["compression"]["replayLinkCount"] == 1


def test_play_feedback_parses_fenced_nested_responses_payload(monkeypatch):
    from app.core import openai_client

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self):
            content = """```json
{"adviceJa":{"良かった点":["バリューを取れた"],"改善点":["薄いコールを減らす"]},"adviceEn":{"Good":["Value bet"],"Improve":["Fold more"]}}
```"""
            return json.dumps(
                {
                    "output": [
                        {"type": "reasoning"},
                        {"type": "message", "content": [{"type": "output_text", "text": content}]},
                    ]
                },
                ensure_ascii=False,
            ).encode("utf-8")

    monkeypatch.setenv("MGX_OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("MGX_OPENAI_API_MODE", "responses")
    monkeypatch.setattr("urllib.request.urlopen", lambda request, timeout: FakeResponse())

    response = openai_client.get_play_feedback_advice(sample_play_feedback())

    assert "## 良かった点" in response["adviceJa"]
    assert "- バリューを取れた" in response["adviceJa"]
    assert "## Improve" in response["adviceEn"]


def test_openai_client_retries_transient_http_errors(monkeypatch):
    from app.core import openai_client
    import urllib.error

    attempts = {"count": 0}

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self):
            return json.dumps(
                {"output_text": json.dumps({"adviceJa": "成功", "adviceEn": "success"})},
                ensure_ascii=False,
            ).encode("utf-8")

    def fake_urlopen(request, timeout):
        attempts["count"] += 1
        if attempts["count"] == 1:
            raise urllib.error.HTTPError(request.full_url, 502, "Bad Gateway", {}, None)
        return FakeResponse()

    monkeypatch.setenv("MGX_OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("MGX_OPENAI_API_MODE", "responses")
    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    monkeypatch.setattr("time.sleep", lambda seconds: None)

    response = openai_client.get_play_feedback_advice(sample_play_feedback())

    assert attempts["count"] == 2
    assert response["adviceJa"] == "成功"
