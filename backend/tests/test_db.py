from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.core import db as core_db
from app.core.db import check_db_connection
from app.dependencies.auth import get_current_user
from app.main import app

client = TestClient(app)


def test_check_db_connection_reports_false_without_server(monkeypatch):
    monkeypatch.setattr(core_db, "check_db_connection", lambda: False)
    assert check_db_connection() is False


def test_health_reports_db_unreachable(monkeypatch):
    monkeypatch.setattr(core_db, "check_db_connection", lambda: False)
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["db"] == "unreachable"


def test_users_endpoint_returns_empty_payload_without_db(monkeypatch):
    monkeypatch.setenv("MGX_ADMIN_USERNAMES", "demo-admin")
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(
        id=1,
        name="demo-admin",
        email="demo-admin@example.com",
    )
    try:
        response = client.get("/api/users")
        assert response.status_code == 200
        body = response.json()
        assert body == {"items": []}
    finally:
        app.dependency_overrides.pop(get_current_user, None)
