from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

class DataStore:
    def __init__(self):
        self.profiles: Dict[str, Dict] = {
            "hero": {
                "id": "hero",
                "displayName": "Hero",
                "rating": 1500,
                "unlockedStages": ["store"],
                "features": ["mixed"],
                "version": 1,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
            }
        }
        self.history: Dict[str, List[Dict]] = {"hero": []}
        self.tournaments: Dict[str, Dict] = {}
        self.tasks: List[Dict] = [
            {"id": "sync-profile", "title": "Sync profile data", "status": "ready"},
            {"id": "upload-history", "title": "Upload hand history", "status": "ready"},
        ]
        self.ai_models: List[Dict] = [
            {"id": "onnx-prophet", "tier": "world", "description": "Spec18 ONNX policy"},
            {"id": "onnx-iron", "tier": "iron", "description": "Lightweight ONNX"},
        ]

    def get_profile(self, user_id: str) -> Optional[Dict]:
        return self.profiles.get(user_id)

    def update_profile(self, user_id: str, patch: Dict) -> Dict:
        current = self.profiles.setdefault(user_id, {"id": user_id, "version": 0})
        current.update(patch)
        current["version"] = current.get("version", 0) + 1
        current["updatedAt"] = datetime.now(timezone.utc).isoformat()
        return current

    def list_history(self, user_id: str, limit: int = 20) -> List[Dict]:
        return list(reversed(self.history.get(user_id, [])))[:limit]

    def append_history(self, user_id: str, entry: Dict) -> Dict:
        self.history.setdefault(user_id, []).append({**entry, "timestamp": datetime.now(timezone.utc).isoformat()})
        return entry

    def save_tournament(self, session: Dict) -> Dict:
        session_id = session["id"]
        self.tournaments[session_id] = session
        return session

    def get_tournament(self, session_id: str) -> Optional[Dict]:
        return self.tournaments.get(session_id)

    def add_task(self, task: Dict):
        self.tasks.append(task)
        return task

    def list_tasks(self) -> List[Dict]:
        return list(self.tasks)

    def list_ai_models(self) -> List[Dict]:
        return list(self.ai_models)

store = DataStore()
