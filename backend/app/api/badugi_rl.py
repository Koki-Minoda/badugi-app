"""Badugi RL decision endpoint.

Frontend ONNX is the primary inference path. This backend endpoint is a
comparison/future-extension path and intentionally uses the same schema v1
vector plus deterministic safe fallback semantics.
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator

from ..dependencies.auth import get_current_user
from ..models import User

VALID_ACTIONS = {"fold", "check", "call", "bet", "raise", "all_in"}
STATE_VECTOR_SIZE = 96
SCHEMA_VERSION = "badugi-observation-v1"
FALLBACK_ORDER = ["onnx", "ruleBased", "deterministicSafe"]
SAFE_ACTION_PRIORITY = ["check", "call", "fold", "bet", "raise", "all_in"]


class BadugiRLRequest(BaseModel):
    state_vector: List[float] = Field(..., description="96-dim Badugi observation schema v1 vector.")
    valid_actions: List[str] = Field(..., description="Subset of allowed actions.")
    schema_version: str = Field(default=SCHEMA_VERSION)
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

    @field_validator("schema_version")
    @classmethod
    def _validate_schema_version(cls, value: str) -> str:
        if value != SCHEMA_VERSION:
            raise ValueError(f"schema_version must be {SCHEMA_VERSION}.")
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
    source: str
    schema_version: str
    vector_size: int
    fallback_order: List[str]
    debug: Optional[Dict[str, Any]] = None


router = APIRouter()


def _deterministic_safe_policy(valid_actions: List[str]) -> BadugiRLResponse:
    ordered = [action for action in SAFE_ACTION_PRIORITY if action in valid_actions]
    ordered.extend(action for action in valid_actions if action not in ordered)
    chosen = ordered[0]
    scores = {action: 1.0 if action == chosen else 0.0 for action in valid_actions}
    return BadugiRLResponse(
        action=chosen,
        policy_scores=scores,
        source="deterministic-safe",
        schema_version=SCHEMA_VERSION,
        vector_size=STATE_VECTOR_SIZE,
        fallback_order=FALLBACK_ORDER,
        debug={
            "strategy": "backend_comparison_fallback",
            "primary_inference": "frontend_onnx",
            "actions_considered": ordered,
        },
    )


@router.post("/badugi/rl/decision", response_model=BadugiRLResponse)
def badugi_rl_decision(
    request: BadugiRLRequest,
    _: User = Depends(get_current_user),
) -> BadugiRLResponse:
    if not request.valid_actions:
        raise HTTPException(status_code=422, detail="valid_actions must not be empty.")
    return _deterministic_safe_policy(request.valid_actions)
