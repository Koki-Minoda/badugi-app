from datetime import datetime
from fastapi import APIRouter

from server.storage import db
from server.schemas import ok, HandHistory, MixedRecord

router = APIRouter()


@router.get("/hand")
def list_hands():
  return ok(db.history["hand"][-50:])


@router.post("/hand")
def post_hand(record: HandHistory):
  db.history["hand"].append(record.dict() | {"created_at": db._now()})
  return ok({"stored": True})


@router.post("/tournament")
def post_tournament(record: dict):
  db.history["tournament"].append(record | {"created_at": db._now()})
  return ok({"stored": True})


@router.post("/mixed")
def post_mixed(record: MixedRecord):
  db.history["mixed"].append(record.dict() | {"created_at": db._now()})
  return ok({"stored": True})
