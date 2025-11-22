from fastapi import APIRouter, Depends
from typing import Dict

from server.data_store import store
from server.auth import require_api_key

router = APIRouter(prefix="/history", tags=["history"])

@router.get("/")
async def read_history(limit: int = 20, api_key: str = Depends(require_api_key)) -> Dict:
    entries = store.list_history("hero", limit=limit)
    return {"items": entries}

@router.post("/append")
async def append_history(payload: Dict, api_key: str = Depends(require_api_key)) -> Dict:
    entry = store.append_history("hero", payload)
    return {"saved": entry}
