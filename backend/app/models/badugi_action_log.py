"""Badugi action log entries (ActionLog persistence)."""
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import BigInteger, Boolean, DateTime, Float, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from . import Base


class BadugiHandAction(Base):
    """Single ActionLog entry persisted from the frontend."""

    __tablename__ = "badugi_action_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    hand_id: Mapped[str] = mapped_column(String(64), index=True)
    player_id: Mapped[str] = mapped_column(String(64), index=True)
    seat_index: Mapped[Optional[int]] = mapped_column(nullable=True)
    phase: Mapped[str] = mapped_column(String(32), index=True)
    round: Mapped[int] = mapped_column(default=0)
    action: Mapped[str] = mapped_column(String(64))
    action_type: Mapped[str] = mapped_column(String(32), index=True)
    paid: Mapped[float] = mapped_column(Float, default=0)
    to_call: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_forced: Mapped[bool] = mapped_column(Boolean, default=False)
    stack_before: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    stack_after: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    bet_before: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    bet_after: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    seq: Mapped[int] = mapped_column(default=0)
    ts: Mapped[datetime] = mapped_column(
        DateTime(),
        nullable=False,
        default=func.now(),
        server_default=func.now(),
        index=True,
    )
    metadata_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        "metadata",
        JSON,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(),
        nullable=False,
        default=func.now(),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(),
        nullable=False,
        default=func.now(),
        server_default=func.now(),
        onupdate=func.now(),
    )
