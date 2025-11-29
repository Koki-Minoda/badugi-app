"""Badugi hand log endpoints with DB persistence."""
from collections import deque
from datetime import datetime
from typing import Any, Deque, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import selectinload

from ..core import db
from ..models import HandAction, HandLog, HandResult

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
_recent_logs: Deque[BadugiHandLogCreate] = deque(maxlen=MAX_RECENT_LOGS)


def _reset_recent_logs() -> None:
    """Used by tests to clear the in-memory recent buffer."""

    _recent_logs.clear()


@router.post("/badugi/hands", response_model=BadugiHandLogResponse)
def create_hand_log(payload: BadugiHandLogCreate) -> BadugiHandLogResponse:
    session = db.SessionLocal()
    try:
        log = HandLog(
            hand_id=payload.hand_id,
            table_id=payload.table_id,
            tournament_id=payload.tournament_id,
            level=payload.level,
            created_at=payload.created_at,
            metadata_json=payload.metadata,
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
        _recent_logs.append(payload)
        return BadugiHandLogResponse(hand_id=payload.hand_id, accepted=True)
    except SQLAlchemyError:
        session.rollback()
        return BadugiHandLogResponse(hand_id=payload.hand_id, accepted=False, error="db_unreachable")
    finally:
        session.close()


@router.get("/badugi/hands/{hand_id}")
def get_hand_log(hand_id: str):
    session = db.SessionLocal()
    try:
        stmt = (
            select(HandLog)
            .options(selectinload(HandLog.actions), selectinload(HandLog.results))
            .where(HandLog.hand_id == hand_id)
        )
        log = session.execute(stmt).scalar_one_or_none()
        if not log:
            raise HTTPException(status_code=404, detail="hand_not_found")
        return log.to_dict(include_children=True)
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="db_unreachable")
    finally:
        session.close()


@router.get("/badugi/hands/by-table/{table_id}")
def get_hands_by_table(table_id: str, limit: int = 5):
    session = db.SessionLocal()
    try:
        stmt = (
            select(HandLog)
            .options(selectinload(HandLog.actions), selectinload(HandLog.results))
            .where(HandLog.table_id == table_id)
            .order_by(desc(HandLog.created_at))
            .limit(max(1, min(limit, 20)))
        )
        logs = session.execute(stmt).scalars().all()
        return {"items": [log.to_dict(include_children=True) for log in logs]}
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="db_unreachable")
    finally:
        session.close()


@router.get("/badugi/hands/recent")
def list_recent_hand_logs() -> Dict[str, List[BadugiHandLogCreate]]:
    return {"items": list(_recent_logs)}
