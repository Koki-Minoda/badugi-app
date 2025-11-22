from fastapi import APIRouter, Depends
from typing import Dict

from server.data_store import store
from server.auth import require_api_key

router = APIRouter(prefix="/ai-models", tags=["ai-models"])

@router.get("/")
async def list_models(api_key: str = Depends(require_api_key)) -> Dict:
    return {"models": store.list_ai_models()}
