"""Tournament analysis endpoints."""  # [tournament-feedback]
from fastapi import APIRouter, Depends

from ..core.openai_client import get_chatgpt_advice  # [tournament-feedback]
from ..dependencies.auth import get_current_user
from ..models import User
from ..schemas.analysis import WorstSpotPayload


router = APIRouter()  # [tournament-feedback]


@router.post("/advice")
def request_tournament_advice(
    payload: WorstSpotPayload,
    current_user: User = Depends(get_current_user),  # noqa: B008  # [tournament-feedback]
) -> dict:
    """Return ChatGPT advice for the provided WorstSpot."""  # [tournament-feedback]

    _ = current_user  # The dependency enforces authentication even if unused.
    worst_spot = payload.model_dump()
    return get_chatgpt_advice(worst_spot)

