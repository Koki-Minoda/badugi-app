from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

VALID_VECTOR = [0.1 for _ in range(22)]


def test_badugi_rl_decision_returns_deterministic_action():
    payload = {
        "state_vector": VALID_VECTOR,
        "valid_actions": ["call", "fold", "raise"],
        "hand_id": "H1",
    }
    response = client.post("/api/badugi/rl/decision", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["action"] == "call"  # lexicographically smallest
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


def test_badugi_rl_decision_requires_non_empty_actions():
    payload = {
        "state_vector": VALID_VECTOR,
        "valid_actions": [],
    }
    response = client.post("/api/badugi/rl/decision", json=payload)
    assert response.status_code == 422
