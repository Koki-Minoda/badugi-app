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


def test_websocket_ready_draw_showdown_and_next_hand():
  client = TestClient(app)
  create_resp = client.post(
    "/api/rooms/create",
    json={
      "owner_id": "hero",
      "max_players": 2,
      "mode": "friend",
      "metadata": {"startingStack": "2000", "variantId": "badugi"},
    },
  )
  assert create_resp.status_code == 200
  room_id = create_resp.json()["data"]["roomId"]
  client.post(
    "/api/rooms/join",
    json={"room_id": room_id, "player_id": "hero", "display_name": "Hero", "role": "player"},
  )
  client.post(
    "/api/rooms/join",
    json={"room_id": room_id, "player_id": "villain", "display_name": "Villain", "role": "player"},
  )

  with client.websocket_connect(f"/ws/room/{room_id}/play") as hero_ws, client.websocket_connect(
    f"/ws/room/{room_id}/play"
  ) as villain_ws:
    hero_ws.send_json({"event": "join_room", "payload": {"playerId": "hero", "displayName": "Hero"}})
    villain_ws.send_json({"event": "join_room", "payload": {"playerId": "villain", "displayName": "Villain"}})
    hero_ws.send_json({"event": "reaction", "payload": {"playerId": "hero", "type": "ready"}})

    saw_ready_state = False
    saw_secure_deal = False
    for _ in range(10):
      msg = hero_ws.receive_json()
      if msg.get("event") == "room_state":
        states = msg["payload"].get("playerStates", [])
        saw_ready_state = saw_ready_state or any(player["id"] == "hero" and player["ready"] for player in states)
      if msg.get("event") == "secure_deal":
        saw_secure_deal = True
    assert saw_ready_state
    assert saw_secure_deal

    hero_ws.send_json({"event": "action", "payload": {"playerId": "hero", "type": "draw"}})
    saw_draw_state = False
    for _ in range(6):
      msg = hero_ws.receive_json()
      if msg.get("event") == "updated_state" and msg["payload"].get("phase") == "draw":
        saw_draw_state = True
        break
    assert saw_draw_state

    villain_ws.send_json({"event": "action", "payload": {"playerId": "villain", "type": "fold"}})
    saw_showdown = False
    saw_next_hand = False
    for _ in range(10):
      msg = hero_ws.receive_json()
      if msg.get("event") == "showdown":
        saw_showdown = True
      if saw_showdown and msg.get("event") == "secure_deal":
        saw_next_hand = True
        break
    assert saw_showdown
    assert saw_next_hand


def test_websocket_reconnect_replays_recent_history():
  client = TestClient(app)
  create_resp = client.post("/api/rooms/create", json={"owner_id": "hero", "max_players": 2, "mode": "friend"})
  assert create_resp.status_code == 200
  room_id = create_resp.json()["data"]["roomId"]
  client.post(
    "/api/rooms/join",
    json={"room_id": room_id, "player_id": "hero", "display_name": "Hero", "role": "player"},
  )

  with client.websocket_connect(f"/ws/room/{room_id}/play") as ws:
    ws.send_json({"event": "join_room", "payload": {"playerId": "hero", "displayName": "Hero"}})
    ws.send_json({"event": "action", "payload": {"playerId": "hero", "type": "call", "amount": 20}})
    saw_update = False
    for _ in range(6):
      msg = ws.receive_json()
      if msg.get("event") == "updated_state" and msg["payload"].get("pot") == 20:
        saw_update = True
        break
    assert saw_update

  with client.websocket_connect(f"/ws/room/{room_id}/play") as reconnect_ws:
    reconnect_ws.send_json({"event": "join_room", "payload": {"playerId": "hero", "displayName": "Hero"}})
    saw_replay = False
    for _ in range(6):
      msg = reconnect_ws.receive_json()
      if msg.get("event") == "history":
        events = msg["payload"].get("events", [])
        saw_replay = any(event.get("action") == "call" and event.get("amount") == 20 for event in events)
        if saw_replay:
          break
    assert saw_replay
