from fastapi.testclient import TestClient

from server.main import app
from server.storage import db


def test_room_rest_and_join():
  client = TestClient(app)
  create_resp = client.post("/api/rooms/create", json={"owner_id": "tester", "max_players": 2, "mode": "ring"})
  assert create_resp.status_code == 200
  room_id = create_resp.json()["data"]["roomId"]
  join_resp = client.post(
    "/api/rooms/join",
    json={"room_id": room_id, "player_id": "guest", "display_name": "Guest", "role": "player"},
  )
  assert join_resp.status_code == 200
  info_resp = client.get(f"/api/rooms/info/{room_id}")
  assert info_resp.status_code == 200
  assert info_resp.json()["data"]["room_id"] == room_id


def test_websocket_action_triggers_showdown():
  client = TestClient(app)
  create_resp = client.post("/api/rooms/create", json={"owner_id": "tester", "max_players": 2, "mode": "ring"})
  assert create_resp.status_code == 200
  room_id = create_resp.json()["data"]["roomId"]
  # Pre-join second player so that the controller has multiple actors.
  client.post(
    "/api/rooms/join",
    json={"room_id": room_id, "player_id": "villain", "display_name": "Villain", "role": "player"},
  )

  with client.websocket_connect(f"/ws/room/{room_id}/play") as ws:
    ws.send_json({"event": "join_room", "payload": {"playerId": "hero", "displayName": "Hero"}})
    seen = set()
    for _ in range(6):
      msg = ws.receive_json()
      event_type = msg.get("event")
      if event_type == "heartbeat":
        continue
      seen.add(event_type)
      if event_type == "secure_deal":
        break
    assert "room_state" in seen
    assert "secure_deal" in seen
    ws.send_json({"event": "action", "payload": {"playerId": "hero", "type": "fold"}})
    showdown_seen = False
    for _ in range(6):
      msg = ws.receive_json()
      if msg.get("event") == "showdown":
        showdown_seen = True
        break
    assert showdown_seen

  assert db.p2p_history, "P2P history should capture the resolved hand"
