import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient
from server.app import app

client = TestClient(app)


def test_openapi_contains_expected_routes():
    schema = client.get("/openapi.json").json()
    routes = set(schema.get("paths", {}).keys())
    expected = {"/profile/", "/history/", "/tournament/create", "/tasks/", "/ai-models/", "/sync/pull"}
    assert expected.issubset(routes)
