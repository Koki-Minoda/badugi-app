"""Badugi hand log endpoints with DB persistence."""
from collections import deque
from datetime import datetime
from typing import Any, Deque, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import selectinload

from ..core import db
from ..models import HandAction, HandLog, HandResult, User
from ..dependencies.auth import get_current_user

MAX_RECENT_LOGS = 10


class BadugiHandAction(BaseModel):
    seat_index: int = Field(..., ge=0)
    player_id: Optional[str] = None
    action: str
    amount: Optional[int] = Field(None, ge=0)
    round: int = Field(..., ge=0)
    phase: str


class BadugiHandResult(BaseModel):
    seat_index: int = Field(..., ge=0)
    player_id: Optional[str] = None
    final_stack: int
    hand_label: Optional[str] = None
    is_winner: bool
    pot_share: int = Field(..., ge=0)


class BadugiHandLogCreate(BaseModel):
    hand_id: str
    table_id: Optional[str] = None
    tournament_id: Optional[str] = None
    level: Optional[int] = Field(None, ge=0)
    created_at: datetime
    actions: List[BadugiHandAction]
    results: List[BadugiHandResult]
    metadata: Optional[Dict[str, Any]] = None


class BadugiHandLogResponse(BaseModel):
    hand_id: str
    accepted: bool
    warnings: Optional[List[str]] = None
    error: Optional[str] = None


router = APIRouter()
# Temporary buffer powering GET /recent until the UI migrates to a DB-driven feed.
_recent_logs: Deque[tuple[int, BadugiHandLogCreate]] = deque(maxlen=MAX_RECENT_LOGS)


def _reset_recent_logs() -> None:
    """Used by tests to clear the in-memory recent buffer."""

    _recent_logs.clear()


def purge_owner_recent_logs(owner_id: int) -> None:
    """Preserve other owners when clearing a deleted account's fallback cache."""
    for entry in list(_recent_logs):
        if entry[0] == owner_id:
            try:
                _recent_logs.remove(entry)
            except ValueError:
                pass  # The bounded deque may already have evicted this entry.


@router.post("/badugi/hands", response_model=BadugiHandLogResponse)
def create_hand_log(payload: BadugiHandLogCreate, user: User = Depends(get_current_user)) -> BadugiHandLogResponse:
    try:
        session = db.SessionLocal()
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="db_unreachable")
    try:
        log = HandLog(
            owner_user_id=user.id,
            hand_id=payload.hand_id,
            table_id=payload.table_id,
            tournament_id=payload.tournament_id,
            level=payload.level,
            created_at=payload.created_at,
            metadata_json={**(payload.metadata or {}), "_owner_user_id": user.id},
        )
        for action in payload.actions:
            log.actions.append(
                HandAction(
                    seat_index=action.seat_index,
                    player_id=action.player_id,
                    action=action.action,
                    amount=action.amount,
                    round=action.round,
                    phase=action.phase,
                ),
            )
        for result in payload.results:
            log.results.append(
                HandResult(
                    seat_index=result.seat_index,
                    player_id=result.player_id,
                    final_stack=result.final_stack,
                    hand_label=result.hand_label,
                    is_winner=result.is_winner,
                    pot_share=result.pot_share,
                ),
            )
        session.add(log)
        session.commit()
        _recent_logs.append((user.id, payload))
        return BadugiHandLogResponse(hand_id=payload.hand_id, accepted=True)
    except SQLAlchemyError:
        session.rollback()
        raise HTTPException(status_code=503, detail="db_unreachable")
    finally:
        session.close()


@router.get("/badugi/hands/recent")
def list_recent_hand_logs(limit: int = 10, user: User = Depends(get_current_user)):
    session = db.SessionLocal()
    try:
        stmt = (
            select(HandLog)
            .where(HandLog.owner_user_id == user.id)
            .order_by(desc(HandLog.created_at))
            .limit(max(1, min(limit, MAX_RECENT_LOGS)))
        )
        logs = session.execute(stmt).scalars().all()
        if logs:
            return {"items": [log.to_dict(include_children=True) for log in logs]}
        return {"items": [payload for owner_id, payload in _recent_logs if owner_id == user.id][:max(1, min(limit, MAX_RECENT_LOGS))]}
    except SQLAlchemyError:
        return {"items": [payload for owner_id, payload in _recent_logs if owner_id == user.id][:max(1, min(limit, MAX_RECENT_LOGS))]}
    finally:
        session.close()


@router.get("/badugi/hands/by-table/{table_id}")
def get_hands_by_table(table_id: str, limit: int = 5, user: User = Depends(get_current_user)):
    session = db.SessionLocal()
    try:
        stmt = (
            select(HandLog)
            .options(selectinload(HandLog.actions), selectinload(HandLog.results))
            .where(HandLog.table_id == table_id, HandLog.owner_user_id == user.id)
            .order_by(desc(HandLog.created_at))
            .limit(max(1, min(limit, 20)))
        )
        logs = session.execute(stmt).scalars().all()
        return {"items": [log.to_dict(include_children=True) for log in logs]}
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="db_unreachable")
    finally:
        session.close()


@router.get("/badugi/hands/{hand_id}")
def get_hand_log(hand_id: str, user: User = Depends(get_current_user)):
    session = db.SessionLocal()
    try:
        stmt = (
            select(HandLog)
            .options(selectinload(HandLog.actions), selectinload(HandLog.results))
            .where(HandLog.hand_id == hand_id, HandLog.owner_user_id == user.id)
        )
        log = session.execute(stmt).scalar_one_or_none()
        if not log:
            raise HTTPException(status_code=404, detail="hand_not_found")
        return log.to_dict(include_children=True)
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="db_unreachable")
    finally:
        session.close()
