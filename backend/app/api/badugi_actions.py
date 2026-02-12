"""Badugi ActionLog persistence endpoints."""
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, validator
from sqlalchemy import desc, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..dependencies.auth import get_current_user
from ..models import BadugiHandAction, User


def normalize_action_type(label: str) -> str:
    lower = str(label or "").lower()
    if lower.startswith("raise"):
        return "raise"
    if lower.startswith("bet"):
        return "bet"
    if lower.startswith("call"):
        return "call"
    if "all-in" in lower:
        return "all-in"
    if lower.startswith("check"):
        return "check"
    if lower.startswith("fold"):
        return "fold"
    if lower.startswith("draw"):
        return "draw"
    if lower.startswith("collect"):
        return "collect"
    if lower.startswith("ante"):
        return "ante"
    if lower.startswith("blind"):
        return "blind"
    if lower.startswith("pat"):
        return "pat"
    return lower.strip() or "action"


class BadugiActionEntry(BaseModel):
    hand_id: Optional[str] = None
    player_id: Optional[str] = None
    seat_index: Optional[int] = Field(None, ge=0)
    phase: str = "BET"
    round: int = Field(0, ge=0)
    action: str
    action_type: Optional[str] = None
    paid: float = Field(0, ge=0)
    to_call: Optional[float] = Field(None, ge=0)
    is_forced: bool = False
    stack_before: Optional[float] = Field(None, ge=0)
    stack_after: Optional[float] = Field(None, ge=0)
    bet_before: Optional[float] = Field(None, ge=0)
    bet_after: Optional[float] = Field(None, ge=0)
    seq: Optional[int] = Field(None, ge=0)
    ts: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None

    @validator("action_type", pre=True, always=True)
    def _normalize_action_type(cls, value, values):  # noqa: N805
        if value:
            return normalize_action_type(value)
        return normalize_action_type(values.get("action"))


class BadugiActionBatchRequest(BaseModel):
    actions: List[BadugiActionEntry]


class BadugiActionBatchResponse(BaseModel):
    inserted: int


router = APIRouter()


@router.post("/badugi/actions/batch", response_model=BadugiActionBatchResponse)
def save_action_batch(
    payload: BadugiActionBatchRequest,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BadugiActionBatchResponse:
    actions = payload.actions or []
    if not actions:
        return BadugiActionBatchResponse(inserted=0)
    if any(not action.hand_id for action in actions):
        raise HTTPException(status_code=400, detail="hand_id_required")

    entries = []
    for idx, action in enumerate(actions):
        seq = action.seq if action.seq is not None else idx
        entries.append(
            BadugiHandAction(
                hand_id=action.hand_id,
                player_id=action.player_id or "unknown",
                seat_index=action.seat_index,
                phase=action.phase,
                round=action.round,
                action=action.action,
                action_type=normalize_action_type(action.action_type or action.action),
                paid=max(0, action.paid or 0),
                to_call=action.to_call,
                is_forced=bool(action.is_forced),
                stack_before=action.stack_before,
                stack_after=action.stack_after,
                bet_before=action.bet_before,
                bet_after=action.bet_after,
                seq=seq,
                ts=action.ts or datetime.utcnow(),
                metadata_json=action.metadata,
            )
        )
    try:
        db.add_all(entries)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=503, detail="db_unreachable")

    return BadugiActionBatchResponse(inserted=len(entries))


@router.get("/badugi/actions/recent")
def list_recent_actions(
    player_id: Optional[str] = None,
    limit: int = 200,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not player_id:
        raise HTTPException(status_code=400, detail="player_id_required")
    limit = max(1, min(limit, 500))
    try:
        stmt = (
            select(BadugiHandAction)
            .where(BadugiHandAction.player_id == player_id)
            .order_by(desc(BadugiHandAction.ts))
            .limit(limit)
        )
        actions = db.execute(stmt).scalars().all()
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="db_unreachable")

    return {
        "items": [
            {
                "hand_id": action.hand_id,
                "player_id": action.player_id,
                "seat_index": action.seat_index,
                "phase": action.phase,
                "round": action.round,
                "action": action.action,
                "action_type": action.action_type,
                "paid": action.paid,
                "to_call": action.to_call,
                "is_forced": action.is_forced,
                "stack_before": action.stack_before,
                "stack_after": action.stack_after,
                "bet_before": action.bet_before,
                "bet_after": action.bet_after,
                "seq": action.seq,
                "ts": action.ts.isoformat() if action.ts else None,
                "metadata": action.metadata_json,
            }
            for action in actions
        ]
    }
