"""Generic hand history sync endpoints.

This complements the structured Badugi log endpoint. The generic endpoint keeps
full canonical hand records available for mixed-game history while the per-game
DB schema is still evolving.
"""
from collections import OrderedDict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

MAX_HISTORY_HANDS = 500


class GenericHandHistoryCreate(BaseModel):
    handId: str = Field(..., min_length=1)
    winner: Optional[str] = None
    variantId: Optional[str] = None
    data: Dict[str, Any] = Field(default_factory=dict)


router = APIRouter()
_history_hands: "OrderedDict[str, Dict[str, Any]]" = OrderedDict()


def _reset_generic_history() -> None:
    """Used by tests to clear the in-memory generic history buffer."""

    _history_hands.clear()


def _upsert_hand(record: GenericHandHistoryCreate) -> Dict[str, Any]:
    item = record.model_dump()
    item["updatedAt"] = datetime.now(tz=timezone.utc).isoformat()
    if record.handId in _history_hands:
        _history_hands.pop(record.handId)
    _history_hands[record.handId] = item
    while len(_history_hands) > MAX_HISTORY_HANDS:
        _history_hands.popitem(last=False)
    return item


@router.post("/history/hand")
def post_hand_history(record: GenericHandHistoryCreate):
    item = _upsert_hand(record)
    return {"stored": True, "handId": item["handId"]}


@router.get("/history/hand")
def list_hand_history(limit: int = 50):
    safe_limit = max(1, min(limit, 200))
    items: List[Dict[str, Any]] = list(reversed(_history_hands.values()))[:safe_limit]
    return {"items": items}


@router.get("/history/hand/{hand_id}")
def get_hand_history(hand_id: str):
    item = _history_hands.get(hand_id)
    if not item:
        raise HTTPException(status_code=404, detail="hand_not_found")
    return item
