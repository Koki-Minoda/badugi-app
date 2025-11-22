from fastapi import APIRouter, Depends
from typing import Dict

from server.data_store import store
from server.auth import require_api_key

router = APIRouter(prefix="/profile", tags=["profile"])

@router.get("/")
async def read_profile(api_key: str = Depends(require_api_key)) -> Dict:
    profile = store.get_profile("hero")
    if not profile:
        return {"error": "No profile"}
    return profile

@router.post("/update")
async def update_profile(payload: Dict, api_key: str = Depends(require_api_key)) -> Dict:
    return store.update_profile("hero", payload)
