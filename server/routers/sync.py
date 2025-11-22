from fastapi import APIRouter, Depends
from typing import Dict

from server.auth import require_api_key
from server.data_store import store

router = APIRouter(prefix="/sync", tags=["sync"])

@router.get("/pull")
async def pull_state(api_key: str = Depends(require_api_key)) -> Dict:
    return {
        "profile": store.get_profile("hero"),
        "history": store.list_history("hero", limit=20),
        "tournaments": list(store.tournaments.values()),
    }

@router.post("/push")
async def push_state(payload: Dict, api_key: str = Depends(require_api_key)) -> Dict:
    store.append_history("hero", payload.get("historyEntry", {}))
    return {"status": "synced", "timestamp": payload.get("timestamp")}
