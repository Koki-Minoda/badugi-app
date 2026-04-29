from fastapi import APIRouter

from ..core.config import get_settings
from ..core import db as core_db

router = APIRouter()


@router.get("/health")
def health_check():
    """Primary health endpoint (nginx proxies /healthz -> /api/health)."""
    settings = get_settings()
    db_status = "ok" if core_db.check_db_connection() else "unreachable"
    return {
        "status": "ok",
        "env": settings.backend_env,
        "db": db_status,
    }
