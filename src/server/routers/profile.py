from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from server.schemas import ok
from server.storage import db

router = APIRouter()


class ProfileUpdateRequest(BaseModel):
  nickname: str
  avatar: Optional[str] = None
  country: Optional[str] = None
  settings: Optional[dict] = None


def get_profile(user_id: str):
  profile = db.users.get(user_id)
  if not profile:
    raise HTTPException(status_code=404, detail="User not found")
  rating = db.ratings.get(user_id, {"gr": 1500})
  return {
    "id": user_id,
    "nickname": profile["nickname"],
    "avatar": profile.get("avatar", "♦"),
    "country": profile.get("country", "JP"),
    "settings": profile.get("settings", {}),
    "rating": rating.get("gr", 1500),
  }


@router.get("/me")
def read_profile():
  return ok(get_profile("demo"))


@router.patch("/me")
def patch_profile(payload: ProfileUpdateRequest):
  profile = db.users.get("demo")
  if not profile:
    raise HTTPException(status_code=404, detail="User not found")
  profile["nickname"] = payload.nickname or profile["nickname"]
  if payload.avatar:
    profile["avatar"] = payload.avatar
  if payload.country:
    profile["country"] = payload.country
  if payload.settings:
    profile["settings"] = {**profile.get("settings", {}), **payload.settings}
  return ok(get_profile("demo"))
