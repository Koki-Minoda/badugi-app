from fastapi.testclient import TestClient

from app.core import db as core_db
from app.main import app

client = TestClient(app)


def test_health_endpoint_reports_db_unreachable(monkeypatch):
    monkeypatch.setattr(core_db, "check_db_connection", lambda: False)
    response = client.get("/api/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert "env" in payload
    assert payload["db"] == "unreachable"
