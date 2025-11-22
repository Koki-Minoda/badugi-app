from fastapi import APIRouter, Depends
from typing import Dict

from server.data_store import store
from server.auth import require_api_key

router = APIRouter(prefix="/tasks", tags=["tasks"])

@router.get("/")
async def list_tasks(api_key: str = Depends(require_api_key)) -> Dict:
    return {"tasks": store.list_tasks()}

@router.post("/enqueue")
async def enqueue_task(payload: Dict, api_key: str = Depends(require_api_key)) -> Dict:
    created = store.add_task(payload)
    return {"task": created}
