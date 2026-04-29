"""Badugi HUD stats endpoints."""
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..dependencies.auth import get_current_user
from ..models import BadugiHandAction, User

router = APIRouter()


@router.get("/badugi/stats")
def get_badugi_stats(
    player_id: Optional[str] = None,
    limit_hands: int = 200,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not player_id:
        raise HTTPException(status_code=400, detail="player_id_required")
    limit_hands = max(1, min(limit_hands, 2000))

    try:
        stmt = (
            select(BadugiHandAction)
            .where(
                BadugiHandAction.player_id == player_id,
                BadugiHandAction.phase == "BET",
            )
            .order_by(desc(BadugiHandAction.ts))
        )
        actions = db.execute(stmt).scalars().all()
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="db_unreachable")

    window_actions: List[BadugiHandAction] = []
    seen_hands = set()
    for action in actions:
        hand_id = action.hand_id
        if hand_id not in seen_hands and len(seen_hands) >= limit_hands:
            break
        seen_hands.add(hand_id)
        window_actions.append(action)

    hand_ids = list(seen_hands)
    if not hand_ids:
        return {
            "player_id": player_id,
            "hands": 0,
            "vpip": 0,
            "pfr": 0,
            "vpipRate": 0.0,
            "pfrRate": 0.0,
            "af": 0.0,
            "window": {"limit_hands": limit_hands, "distinct_hands": 0},
        }

    try:
        count_stmt = select(func.count(func.distinct(BadugiHandAction.hand_id))).where(
            BadugiHandAction.player_id == player_id,
            BadugiHandAction.hand_id.in_(hand_ids),
        )
        hands = db.execute(count_stmt).scalar_one() or 0
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="db_unreachable")

    vpip_hands = set()
    pfr_hands = set()
    aggro_paid = 0.0
    call_paid = 0.0
    for action in window_actions:
        if action.round != 0:
            continue
        if action.is_forced:
            continue
        if action.paid <= 0:
            continue
        action_type = (action.action_type or "").lower()
        if action_type in {"call", "bet", "raise"}:
            vpip_hands.add(action.hand_id)
        if action_type in {"bet", "raise"}:
            pfr_hands.add(action.hand_id)

    for action in window_actions:
        if action.is_forced or action.paid <= 0:
            continue
        action_type = (action.action_type or "").lower()
        if action_type in {"bet", "raise"}:
            aggro_paid += float(action.paid or 0)
        if action_type == "call":
            call_paid += float(action.paid or 0)

    vpip = len(vpip_hands)
    pfr = len(pfr_hands)
    vpip_rate = vpip / hands if hands else 0.0
    pfr_rate = pfr / hands if hands else 0.0
    af = aggro_paid if call_paid == 0 else aggro_paid / call_paid

    return {
        "player_id": player_id,
        "hands": hands,
        "vpip": vpip,
        "pfr": pfr,
        "vpipRate": vpip_rate,
        "pfrRate": pfr_rate,
        "af": af,
        "window": {"limit_hands": limit_hands, "distinct_hands": hands},
    }
