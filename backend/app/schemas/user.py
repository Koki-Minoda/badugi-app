"""Pydantic schemas for user payloads."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserPublic(BaseModel):
    """Publicly exposed subset of a user record.

    username is derived from the persisted name when available, otherwise the
    backend falls back to the email for display purposes.
    """

    id: int
    username: str | None = None
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
