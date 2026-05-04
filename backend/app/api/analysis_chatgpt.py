"""Tournament and session analysis endpoints."""  # [tournament-feedback]
from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..core.openai_client import get_chatgpt_advice, get_play_feedback_advice  # [tournament-feedback]
from ..dependencies.auth import get_current_user
from ..models import PlayFeedbackResult, User
from ..schemas.analysis import (
    PlayFeedbackPayload,
    PlayFeedbackResponse,
    PlayFeedbackStoredResult,
    WorstSpotPayload,
)


router = APIRouter()  # [tournament-feedback]
RATE_LIMIT_WINDOW_SECONDS = 60
RATE_LIMIT_MAX_REQUESTS = 6
_feedback_rate_limit: dict[str, list[float]] = {}
PII_KEYS = {
    "email",
    "mail",
    "password",
    "token",
    "authToken",
    "accessToken",
    "refreshToken",
    "displayName",
    "userName",
    "username",
    "name",
}
PII_KEYS_LOWER = {key.lower() for key in PII_KEYS}


def _rate_limit_key(current_user: User) -> str:
    return str(getattr(current_user, "id", "anonymous"))


def _enforce_feedback_rate_limit(current_user: User) -> None:
    now = time.time()
    key = _rate_limit_key(current_user)
    recent = [
        timestamp
        for timestamp in _feedback_rate_limit.get(key, [])
        if now - timestamp < RATE_LIMIT_WINDOW_SECONDS
    ]
    if len(recent) >= RATE_LIMIT_MAX_REQUESTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many feedback requests. Please wait before trying again.",
        )
    recent.append(now)
    _feedback_rate_limit[key] = recent


def _scrub_pii(value: Any) -> Any:
    if isinstance(value, dict):
        scrubbed: dict[str, Any] = {}
        for key, item in value.items():
            if key in PII_KEYS or key.lower() in PII_KEYS_LOWER:
                scrubbed[key] = "[redacted]"
            else:
                scrubbed[key] = _scrub_pii(item)
        return scrubbed
    if isinstance(value, list):
        return [_scrub_pii(item) for item in value]
    return value


def _build_feedback_session_key(payload: PlayFeedbackPayload) -> str:
    tournament = payload.summary.model_dump().get("tournament") or {}
    tournament_id = tournament.get("tournamentId") if isinstance(tournament, dict) else None
    return ":".join(
        [
            payload.mode,
            str(tournament_id or "cash"),
            payload.variantScope or "mixed",
        ]
    )


def _extract_tournament_id(payload: PlayFeedbackPayload) -> str | None:
    tournament = payload.summary.model_dump().get("tournament") or {}
    if isinstance(tournament, dict):
        value = tournament.get("tournamentId")
        return str(value) if value else None
    return None


@router.post("/advice")
def request_tournament_advice(
    payload: WorstSpotPayload,
    current_user: User = Depends(get_current_user),  # noqa: B008  # [tournament-feedback]
) -> dict:
    """Return ChatGPT advice for the provided WorstSpot."""  # [tournament-feedback]

    _ = current_user  # The dependency enforces authentication even if unused.
    worst_spot = payload.model_dump()
    return get_chatgpt_advice(worst_spot)


@router.post("/play-feedback", response_model=PlayFeedbackResponse)
def request_play_feedback(
    payload: PlayFeedbackPayload,
    current_user: User = Depends(get_current_user),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> PlayFeedbackResponse:
    """Return ChatGPT-style feedback for a 30+ hand cash or tournament session."""

    _enforce_feedback_rate_limit(current_user)
    if payload.handCount < payload.minHands:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least minHands completed hands are required for play feedback.",
        )

    sanitized = _scrub_pii(payload.model_dump())
    advice = get_play_feedback_advice(sanitized)
    source = "fallback"
    if advice.get("adviceJa") and advice.get("adviceEn"):
        fallback_prefix = "セッション解析は受け付けました。"
        source = "fallback" if advice["adviceJa"].startswith(fallback_prefix) else "openai"
    response_payload = PlayFeedbackResponse(
        adviceJa=advice.get("adviceJa", ""),
        adviceEn=advice.get("adviceEn", ""),
        source=source,
        acceptedHandCount=payload.handCount,
        piiRemoved=True,
    )
    session_key = _build_feedback_session_key(payload)
    result = PlayFeedbackResult(
        user_id=getattr(current_user, "id", None),
        session_key=session_key,
        mode=payload.mode,
        variant_scope=payload.variantScope,
        tournament_id=_extract_tournament_id(payload),
        hand_count=payload.handCount,
        source=source,
        pii_removed=True,
        payload=sanitized,
        response=response_payload.model_dump(exclude_none=True),
    )
    try:
        db.add(result)
        db.commit()
        db.refresh(result)
        response_payload.feedbackId = result.id
        response_payload.sessionKey = session_key
        response_payload.storedAt = result.created_at.isoformat() if result.created_at else None
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to store play feedback result.",
        ) from exc
    return response_payload


@router.get("/play-feedback/results", response_model=list[PlayFeedbackStoredResult])
def list_play_feedback_results(
    session_key: str | None = None,
    limit: int = 20,
    current_user: User = Depends(get_current_user),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> list[PlayFeedbackStoredResult]:
    """Return stored feedback results for the authenticated user."""

    safe_limit = max(1, min(limit, 100))
    query = (
        db.query(PlayFeedbackResult)
        .filter(PlayFeedbackResult.user_id == getattr(current_user, "id", None))
        .order_by(PlayFeedbackResult.created_at.desc(), PlayFeedbackResult.id.desc())
    )
    if session_key:
        query = query.filter(PlayFeedbackResult.session_key == session_key)
    rows = query.limit(safe_limit).all()
    return [
        PlayFeedbackStoredResult(
            id=row.id,
            sessionKey=row.session_key,
            mode=row.mode,
            variantScope=row.variant_scope,
            tournamentId=row.tournament_id,
            handCount=row.hand_count,
            source=row.source,
            piiRemoved=row.pii_removed,
            response=row.response,
            createdAt=row.created_at.isoformat() if row.created_at else None,
        )
        for row in rows
    ]
