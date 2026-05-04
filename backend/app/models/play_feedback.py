"""Play feedback persistence models."""
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from . import Base


class PlayFeedbackResult(Base):
    """Stored AI/fallback feedback for a cash or tournament session."""

    __tablename__ = "play_feedback_results"

    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, "sqlite"),
        primary_key=True,
        autoincrement=True,
    )
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    session_key: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    mode: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    variant_scope: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    tournament_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    hand_count: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[str] = mapped_column(String(32), nullable=False)
    pii_removed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    payload: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    response: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(),
        nullable=False,
        default=func.now(),
        server_default=func.now(),
        index=True,
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "userId": self.user_id,
            "sessionKey": self.session_key,
            "mode": self.mode,
            "variantScope": self.variant_scope,
            "tournamentId": self.tournament_id,
            "handCount": self.hand_count,
            "source": self.source,
            "piiRemoved": self.pii_removed,
            "payload": self.payload,
            "response": self.response,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }
