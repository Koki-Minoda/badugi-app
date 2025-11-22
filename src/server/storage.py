from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List


class InMemoryStore:
  def __init__(self):
    self.users: Dict[str, Dict[str, Any]] = {
      "demo": {
        "id": "demo",
        "nickname": "DemoPlayer",
        "avatar": "♠",
        "country": "JP",
        "settings": {
          "bgm_on": True,
          "se_on": True,
          "theme": "neo-felt",
          "card_skin": "classic",
        },
      }
    }
    self.tokens: Dict[str, str] = {"demo-token": "demo"}
    self.ratings: Dict[str, Dict[str, Any]] = {
      "demo": {"sr": 1500, "mr": 1500, "gr": 1500, "updated_at": self._now()}
    }
    self.history: Dict[str, List[Dict[str, Any]]] = {
      "hand": [],
      "tournament": [],
      "mixed": [],
    }
    self.snapshots: Dict[str, Dict[str, Any]] = {}
    self.rl_buffer: List[Dict[str, Any]] = []
    self.p2p_history: List[Dict[str, Any]] = []
    self.ai_models: Dict[str, Dict[str, Any]] = {
      "badugi_v2": {"version": "badugi_v2", "tier": "iron", "size": "12MB"},
      "generic_v1": {"version": "generic_v1", "tier": "standard", "size": "8MB"},
    }

  @staticmethod
  def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


db = InMemoryStore()
