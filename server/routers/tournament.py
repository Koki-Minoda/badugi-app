from fastapi import APIRouter, HTTPException, Depends
from typing import Dict

from server.data_store import store
from server.auth import require_api_key

router = APIRouter(prefix="/tournament", tags=["tournament"])

@router.post("/create")
async def create_tournament(payload: Dict, api_key: str = Depends(require_api_key)) -> Dict:
    if not payload.get("stageId"):
        raise HTTPException(status_code=400, detail="stageId is required")
    session = payload.copy()
    session.setdefault("id", f"session-{len(store.tournaments) + 1}")
    session.setdefault("remainingPlayers", payload.get("entrants", 0))
    session["status"] = "active"
    stored = store.save_tournament(session)
    return {"session": stored}

@router.get("/{session_id}")
async def get_tournament(session_id: str, api_key: str = Depends(require_api_key)) -> Dict:
    session = store.get_tournament(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="session not found")
    return {"session": session}

@router.post("/{session_id}/resume")
async def resume_tournament(session_id: str, payload: Dict, api_key: str = Depends(require_api_key)) -> Dict:
    session = store.get_tournament(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="session not found")
    session["cursor"] = payload.get("cursor", session.get("cursor", 0) + 1)
    store.save_tournament(session)
    return {"session": session}
