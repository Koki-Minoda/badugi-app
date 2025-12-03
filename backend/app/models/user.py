"""User model definition."""
from datetime import datetime

from sqlalchemy import func, String
from sqlalchemy.orm import Mapped, mapped_column

from . import Base


class User(Base):
    """Minimal user record placeholder."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # ★ ここを length 指定付きの String に修正！！
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
