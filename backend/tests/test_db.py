from fastapi.testclient import TestClient

from app.core.db import check_db_connection
from app.main import app

client = TestClient(app)


def test_check_db_connection_reports_false_without_server():
    assert check_db_connection() is False


def test_health_reports_db_unreachable():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["db"] == "unreachable"


def test_users_endpoint_returns_empty_payload_without_db():
    response = client.get("/api/users")
    assert response.status_code == 200
    body = response.json()
    assert body == {"items": []}
