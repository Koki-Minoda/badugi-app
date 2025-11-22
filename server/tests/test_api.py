import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient
from server.app import app

client = TestClient(app)
API_KEY = "spec21-secret-token"

def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json().get("status") == "ok"


def test_profile_requires_api_key():
    resp = client.get("/profile/")
    assert resp.status_code == 422 or resp.status_code == 403


def test_profile_flow():
    resp = client.get("/profile/", headers={"x-api-key": API_KEY})
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("rating") == 1500
    resp = client.post("/profile/update", headers={"x-api-key": API_KEY}, json={"displayName": "Hero++"})
    assert resp.status_code == 200
    assert resp.json().get("displayName") == "Hero++"


def test_sync_push_pull():
    pull = client.get("/sync/pull", headers={"x-api-key": API_KEY})
    assert pull.status_code == 200
    assert "profile" in pull.json()
    push = client.post("/sync/push", headers={"x-api-key": API_KEY}, json={"historyEntry": {"note": "test"}, "timestamp": "now"})
    assert push.status_code == 200
