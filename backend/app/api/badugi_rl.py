"""Badugi RL decision endpoint."""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator

from ..dependencies.auth import get_current_user
from ..models import User

VALID_ACTIONS = {"fold", "check", "call", "bet", "raise", "all_in"}
STATE_VECTOR_SIZE = 22


class BadugiRLRequest(BaseModel):
    state_vector: List[float] = Field(..., description="22-dim state vector from the RL env.")
    valid_actions: List[str] = Field(..., description="Subset of allowed actions.")
    hand_id: Optional[str] = None
    table_id: Optional[str] = None
    tournament_id: Optional[str] = None
    seat_index: Optional[int] = Field(None, ge=0)

    @field_validator("valid_actions")
    @classmethod
    def _validate_actions(cls, value: List[str]) -> List[str]:
        if not value:
            raise ValueError("valid_actions must contain at least one item.")
        invalid = [action for action in value if action not in VALID_ACTIONS]
        if invalid:
            raise ValueError(f"Unsupported actions: {invalid}")
        return value

    @model_validator(mode="after")
    def _validate_state_vector(self):
        vector = self.state_vector or []
        if len(vector) != STATE_VECTOR_SIZE:
            raise ValueError(f"state_vector must have length {STATE_VECTOR_SIZE}.")
        return self


class BadugiRLResponse(BaseModel):
    action: str
    policy_scores: Dict[str, float]
    debug: Optional[Dict[str, Any]] = None


router = APIRouter()


def _deterministic_stub_policy(valid_actions: List[str]) -> BadugiRLResponse:
    ordered = sorted(valid_actions)
    chosen = ordered[0]
    scores = {action: 1.0 if action == chosen else 0.0 for action in ordered}
    return BadugiRLResponse(
        action=chosen,
        policy_scores=scores,
        debug={"strategy": "lexicographic_stub", "actions_considered": ordered},
    )


@router.post("/badugi/rl/decision", response_model=BadugiRLResponse)
def badugi_rl_decision(
    request: BadugiRLRequest,
    _: User = Depends(get_current_user),
) -> BadugiRLResponse:
    if not request.valid_actions:
        raise HTTPException(status_code=422, detail="valid_actions must not be empty.")
    return _deterministic_stub_policy(request.valid_actions)
