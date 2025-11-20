from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class SyncPayload(BaseModel):
    type: str
    data: dict


@router.post("/push")
def push_delta(payload: SyncPayload):
    if payload.type not in {"delta", "snapshot"}:
        raise HTTPException(status_code=400, detail="Unsupported payload type")
    return {"status": "received", "type": payload.type, "synced_at": payload.data.get("handId")}


@router.get("/pull")
def pull_state():
    return {
        "status": "ok",
        "serverTime": "2025-11-21T00:00:00Z",
        "latestTournamentSnapshot": {"stage": "local", "level": 8},
    }


@router.post("/autosync")
def autosync(payload: SyncPayload):
    return {"status": "queued", "payloadType": payload.type}
