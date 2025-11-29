"""ORM base definitions."""
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Root declarative base for all ORM models."""

    pass


from .user import User  # noqa: E402  (import after Base definition)
from .hand_log import HandAction, HandLog, HandResult  # noqa: E402

__all__ = ("Base", "User", "HandLog", "HandAction", "HandResult")
