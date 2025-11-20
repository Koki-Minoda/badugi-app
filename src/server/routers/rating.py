from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from server.storage import db
from server.schemas import ok, RatingUpdate

router = APIRouter()


@router.get("/me")
def get_rating():
  rating = db.ratings.get("demo")
  if not rating:
    raise HTTPException(status_code=404, detail="Rating not found")
  return ok(rating)


@router.post("/update")
def post_rating(payload: RatingUpdate):
  if payload.user_id != "demo":
    raise HTTPException(status_code=404, detail="User not found")
  db.ratings["demo"] = {
    "sr": payload.sr_after,
    "mr": payload.mr_after,
    "gr": payload.global_after,
    "updated_at": db._now(),
  }
  return ok({"stored": True})
