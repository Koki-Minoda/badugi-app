from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.dependencies.auth import get_current_user
from app.main import app

client = TestClient(app)

VALID_VECTOR = [0.1 for _ in range(96)]


@pytest.fixture(autouse=True)
def _auth_override():
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1, name="demo")
    try:
        yield
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_badugi_rl_decision_returns_deterministic_safe_action():
    payload = {
        "state_vector": VALID_VECTOR,
        "valid_actions": ["call", "fold", "raise"],
        "schema_version": "badugi-observation-v1",
        "hand_id": "H1",
    }
    response = client.post("/api/badugi/rl/decision", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["action"] == "call"
    assert data["source"] == "deterministic-safe"
    assert data["schema_version"] == "badugi-observation-v1"
    assert data["vector_size"] == 96
    assert data["fallback_order"] == ["onnx", "ruleBased", "deterministicSafe"]
    assert set(data["policy_scores"].keys()) == {"call", "fold", "raise"}
    assert data["policy_scores"]["call"] == 1.0
    assert all(score in {0.0, 1.0} for score in data["policy_scores"].values())


def test_badugi_rl_decision_requires_exact_vector_size():
    payload = {
        "state_vector": VALID_VECTOR[:-1],
        "valid_actions": ["call"],
    }
    response = client.post("/api/badugi/rl/decision", json=payload)
    assert response.status_code == 422


def test_badugi_rl_decision_requires_schema_v1():
    payload = {
        "state_vector": VALID_VECTOR,
        "valid_actions": ["check"],
        "schema_version": "legacy",
    }
    response = client.post("/api/badugi/rl/decision", json=payload)
    assert response.status_code == 422


def test_badugi_rl_decision_requires_non_empty_actions():
    payload = {
        "state_vector": VALID_VECTOR,
        "valid_actions": [],
    }
    response = client.post("/api/badugi/rl/decision", json=payload)
    assert response.status_code == 422
