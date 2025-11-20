from fastapi import APIRouter, HTTPException

from server.storage import db
from server.schemas import ok, RLBufferEntry

router = APIRouter()


@router.get("/model/latest")
def latest_model():
  model = db.ai_models["badugi_v2"]
  return ok(model)


@router.get("/model/{version}")
def fetch_model(version: str):
  model = db.ai_models.get(version)
  if not model:
    raise HTTPException(status_code=404, detail="Model not found")
  return ok(model)


@router.post("/rl/buffer")
def ingest_rl(entry: RLBufferEntry):
  db.rl_buffer.append(entry.dict() | {"stored_at": db._now()})
  return ok({"stored": True})


@router.get("/rl/buffer/stats")
def rl_stats():
  return ok({"records": len(db.rl_buffer)})
