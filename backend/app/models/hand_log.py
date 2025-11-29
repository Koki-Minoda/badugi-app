"""Badugi hand log ORM models."""
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from . import Base


class HandLog(Base):
    """Represents a single Badugi hand log."""

    __tablename__ = "badugi_hand_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    hand_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    table_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    tournament_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    level: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        server_default=func.now(),
    )
    metadata_json: Mapped[Optional[Dict[str, Any]]] = mapped_column("metadata", JSON, nullable=True)

    actions: Mapped[List["HandAction"]] = relationship(
        back_populates="hand_log",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    results: Mapped[List["HandResult"]] = relationship(
        back_populates="hand_log",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def to_dict(self, include_children: bool = False) -> Dict[str, Any]:
        data = {
            "id": self.id,
            "hand_id": self.hand_id,
            "table_id": self.table_id,
            "tournament_id": self.tournament_id,
            "level": self.level,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "metadata": self.metadata_json,
        }
        if include_children:
            data["actions"] = [action.to_dict() for action in self.actions]
            data["results"] = [result.to_dict() for result in self.results]
        return data


class HandAction(Base):
    """Single action within a hand."""

    __tablename__ = "badugi_hand_actions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    hand_log_id: Mapped[int] = mapped_column(ForeignKey("badugi_hand_logs.id", ondelete="CASCADE"), index=True)
    seat_index: Mapped[int] = mapped_column(Integer)
    player_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    action: Mapped[str] = mapped_column(String(32))
    amount: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    round: Mapped[int] = mapped_column(Integer)
    phase: Mapped[str] = mapped_column(String(32))

    hand_log: Mapped[HandLog] = relationship(back_populates="actions")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "seat_index": self.seat_index,
            "player_id": self.player_id,
            "action": self.action,
            "amount": self.amount,
            "round": self.round,
            "phase": self.phase,
        }


class HandResult(Base):
    """Outcome for a seat after the hand resolves."""

    __tablename__ = "badugi_hand_results"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    hand_log_id: Mapped[int] = mapped_column(ForeignKey("badugi_hand_logs.id", ondelete="CASCADE"), index=True)
    seat_index: Mapped[int] = mapped_column(Integer)
    player_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    final_stack: Mapped[int] = mapped_column(Integer)
    hand_label: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    is_winner: Mapped[bool] = mapped_column(Boolean, default=False)
    pot_share: Mapped[int] = mapped_column(Integer)

    hand_log: Mapped[HandLog] = relationship(back_populates="results")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "seat_index": self.seat_index,
            "player_id": self.player_id,
            "final_stack": self.final_stack,
            "hand_label": self.hand_label,
            "is_winner": self.is_winner,
            "pot_share": self.pot_share,
        }
