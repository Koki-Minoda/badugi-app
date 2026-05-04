"""Tournament and session analysis endpoints."""  # [tournament-feedback]
from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from ..core.openai_client import get_chatgpt_advice, get_play_feedback_advice  # [tournament-feedback]
from ..dependencies.auth import get_current_user
from ..models import User
from ..schemas.analysis import PlayFeedbackPayload, PlayFeedbackResponse, WorstSpotPayload


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

    return PlayFeedbackResponse(
        adviceJa=advice.get("adviceJa", ""),
        adviceEn=advice.get("adviceEn", ""),
        source=source,
        acceptedHandCount=payload.handCount,
        piiRemoved=True,
    )
