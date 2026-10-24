"""Generic hand history sync endpoints.

This complements the structured Badugi log endpoint. The generic endpoint keeps
full canonical hand records available for mixed-game history while the per-game
DB schema is still evolving.
"""
from collections import OrderedDict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException

from ..dependencies.auth import get_current_user
from ..models import User
from pydantic import BaseModel, Field

MAX_HISTORY_HANDS = 500


class GenericHandHistoryCreate(BaseModel):
    handId: str = Field(..., min_length=1)
    winner: Optional[str] = None
    variantId: Optional[str] = None
    data: Dict[str, Any] = Field(default_factory=dict)


router = APIRouter()
_history_hands: "OrderedDict[tuple[int, str], Dict[str, Any]]" = OrderedDict()


def _reset_generic_history() -> None:
    """Used by tests to clear the in-memory generic history buffer."""

    _history_hands.clear()


def purge_owner_history(owner_id: int) -> None:
    """Remove only the deleted account's process-local canonical history."""
    for key in list(_history_hands):
        if key[0] == owner_id:
            _history_hands.pop(key, None)


def _upsert_hand(record: GenericHandHistoryCreate, owner_id: int) -> Dict[str, Any]:
    item = record.model_dump()
    item["updatedAt"] = datetime.now(tz=timezone.utc).isoformat()
    key = (owner_id, record.handId)
    if key in _history_hands:
        _history_hands.pop(key)
    _history_hands[key] = item
    while len(_history_hands) > MAX_HISTORY_HANDS:
        _history_hands.popitem(last=False)
    return item


@router.post("/history/hand")
def post_hand_history(record: GenericHandHistoryCreate, user: User = Depends(get_current_user)):
    item = _upsert_hand(record, user.id)
    return {"stored": True, "handId": item["handId"]}


@router.get("/history/hand")
def list_hand_history(limit: int = 50, user: User = Depends(get_current_user)):
    safe_limit = max(1, min(limit, 200))
    items: List[Dict[str, Any]] = [
        item for (owner_id, _), item in reversed(_history_hands.items())
        if owner_id == user.id
    ][:safe_limit]
    return {"items": items}


@router.get("/history/hand/{hand_id}")
def get_hand_history(hand_id: str, user: User = Depends(get_current_user)):
    item = _history_hands.get((user.id, hand_id))
    if not item:
        raise HTTPException(status_code=404, detail="hand_not_found")
    return item
