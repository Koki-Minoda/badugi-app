from fastapi.testclient import TestClient

from app.api.history import _reset_generic_history
from app.main import app

client = TestClient(app)


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
