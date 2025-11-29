from fastapi import APIRouter

from ..core.config import get_settings
from ..core.db import check_db_connection

router = APIRouter()


@router.get("/health")
def health_check():
    settings = get_settings()
    db_status = "ok" if check_db_connection() else "unreachable"
    return {
        "status": "ok",
        "env": settings.backend_env,
        "db": db_status,
    }
