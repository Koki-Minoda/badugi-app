from fastapi import APIRouter, HTTPException
from typing import Dict

from server.storage import db
from server.schemas import ok, TournamentSnapshot

router = APIRouter()


@router.post("/snapshot")
def store_snapshot(payload: TournamentSnapshot):
  db.snapshots[payload.sessionId] = payload.dict() | {"stored_at": db._now()}
  return ok({"stored": True})


@router.get("/resume/{session_id}")
def resume(session_id: str):
  snapshot = db.snapshots.get(session_id)
  if not snapshot:
    raise HTTPException(status_code=404, detail="Snapshot not found")
  return ok(snapshot)
