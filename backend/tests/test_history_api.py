from types import SimpleNamespace

import pytest

from app.dependencies.auth import get_current_user
from fastapi.testclient import TestClient

from app.api.history import _reset_generic_history
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def authenticated_owner():
    previous = app.dependency_overrides.copy()
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=101)
    _reset_generic_history()
    yield
    app.dependency_overrides.clear()
    app.dependency_overrides.update(previous)
    _reset_generic_history()



def test_post_and_get_generic_hand_history():
    _reset_generic_history()
    payload = {
        "handId": "mixed-hand-1",
        "winner": "Hero",
        "variantId": "D01",
        "data": {
            "handId": "mixed-hand-1",
            "variantId": "D01",
            "seats": [{"seat": 0, "name": "Hero"}],
        },
    }

    response = client.post("/api/history/hand", json=payload)
    assert response.status_code == 200
    assert response.json() == {"stored": True, "handId": "mixed-hand-1"}

    get_response = client.get("/api/history/hand/mixed-hand-1")
    assert get_response.status_code == 200
    data = get_response.json()
    assert data["variantId"] == "D01"
    assert data["data"]["seats"][0]["name"] == "Hero"


def test_generic_hand_history_upserts_by_hand_id():
    _reset_generic_history()
    first = {"handId": "same-hand", "winner": "Hero", "variantId": "badugi", "data": {}}
    second = {"handId": "same-hand", "winner": "Villain", "variantId": "D02", "data": {}}

    assert client.post("/api/history/hand", json=first).status_code == 200
    assert client.post("/api/history/hand", json=second).status_code == 200

    response = client.get("/api/history/hand")
    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 1
    assert items[0]["winner"] == "Villain"
    assert items[0]["variantId"] == "D02"


def test_anonymous_history_reads_and_writes_are_rejected():
    app.dependency_overrides.pop(get_current_user)
    for response in (
        client.post("/api/history/hand", json={"handId": "private", "data": {}}),
        client.get("/api/history/hand"),
        client.get("/api/history/hand/private"),
    ):
        assert response.status_code == 401


def test_history_is_isolated_between_owners_even_with_same_hand_id():
    first = {"handId": "shared-id", "winner": "Owner A", "data": {"private": "A"}}
    assert client.post("/api/history/hand", json=first).status_code == 200
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=202)
    assert client.get("/api/history/hand").json()["items"] == []
    assert client.get("/api/history/hand/shared-id").status_code == 404
    second = {"handId": "shared-id", "winner": "Owner B", "data": {"private": "B"}}
    assert client.post("/api/history/hand", json=second).status_code == 200
    assert client.get("/api/history/hand/shared-id").json()["data"] == {"private": "B"}
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=101)
    assert client.get("/api/history/hand/shared-id").json()["data"] == {"private": "A"}
    assert [item["winner"] for item in client.get("/api/history/hand").json()["items"]] == ["Owner A"]
