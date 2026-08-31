"""Durable server-authoritative Friend Match room snapshots."""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from . import Base


class P2PRoomState(Base):
    __tablename__ = "p2p_room_states"

    room_code: Mapped[str] = mapped_column(String(12), primary_key=True)
    owner_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    sequence_id: Mapped[int] = mapped_column(nullable=False, default=0)
    closed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    snapshot: Mapped[dict] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        index=True,
    )


class P2PStateReadLimit(Base):
    __tablename__ = "p2p_state_read_limits"

    room_code: Mapped[str] = mapped_column(String(12), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    window_started_at: Mapped[float] = mapped_column(Float, nullable=False)
    request_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[float] = mapped_column(Float, nullable=False)
