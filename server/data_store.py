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
        self.users: Dict[str, Dict] = {}
        self.users_by_email: Dict[str, str] = {}
        self.api_keys: Dict[str, str] = {}
        self.api_keys_by_user: Dict[str, str] = {}

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

    def create_user(self, user_id: str, email: str, password_hash: str) -> Dict:
        payload = {
            "id": user_id,
            "email": email,
            "password_hash": password_hash,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        self.users[user_id] = payload
        self.users_by_email[email] = user_id
        return payload

    def get_user_by_email(self, email: str) -> Optional[Dict]:
        user_id = self.users_by_email.get(email)
        return self.users.get(user_id) if user_id else None

    def get_user_by_id(self, user_id: str) -> Optional[Dict]:
        return self.users.get(user_id)

    def register_api_key(self, api_key: str, user_id: str) -> None:
        existing_key = self.api_keys_by_user.get(user_id)
        if existing_key and existing_key in self.api_keys:
            del self.api_keys[existing_key]
        self.api_keys[api_key] = user_id
        self.api_keys_by_user[user_id] = api_key

    def revoke_api_key(self, api_key: str) -> None:
        if api_key in self.api_keys:
            user_id = self.api_keys[api_key]
            del self.api_keys[api_key]
            if self.api_keys_by_user.get(user_id) == api_key:
                del self.api_keys_by_user[user_id]

    def resolve_user_id_for_api_key(self, api_key: str) -> Optional[str]:
        return self.api_keys.get(api_key)

store = DataStore()
