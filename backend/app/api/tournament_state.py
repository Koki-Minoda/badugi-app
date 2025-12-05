"""Tournament state save/resume/retire endpoints."""
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..dependencies.auth import get_current_user
from ..models import TournamentSnapshot, User
from ..schemas.tournament_snapshot import (
    TournamentResumeResponse,
    TournamentSaveRequest,
)

router = APIRouter(prefix="/tournament", tags=["tournament"])


def _upsert_snapshot(
    db: Session,
    user_id: int,
    snapshot_payload: dict,
) -> TournamentSnapshot:
    existing = (
        db.query(TournamentSnapshot)
        .filter(TournamentSnapshot.user_id == user_id)
        .one_or_none()
    )
    if existing:
        existing.snapshot = snapshot_payload
        existing.updated_at = datetime.utcnow()
        return existing
    new_entry = TournamentSnapshot(
        user_id=user_id,
        snapshot=snapshot_payload,
        updated_at=datetime.utcnow(),
    )
    db.add(new_entry)
    return new_entry


@router.post("/save")
def save_tournament_snapshot(
    payload: TournamentSaveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    snapshot_data = payload.snapshot.model_dump()
    _upsert_snapshot(db, current_user.id, snapshot_data)
    db.commit()
    return {"status": "ok"}


@router.post("/resume", response_model=TournamentResumeResponse)
def resume_tournament(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = (
        db.query(TournamentSnapshot)
        .filter(TournamentSnapshot.user_id == current_user.id)
        .one_or_none()
    )
    if not entry:
        return TournamentResumeResponse(hasSnapshot=False, snapshot=None)
    return TournamentResumeResponse(hasSnapshot=True, snapshot=entry.snapshot)


@router.post("/retire")
def retire_tournament(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = (
        db.query(TournamentSnapshot)
        .filter(TournamentSnapshot.user_id == current_user.id)
        .one_or_none()
    )
    if entry:
        db.delete(entry)
        db.commit()
    return {"status": "retired"}

