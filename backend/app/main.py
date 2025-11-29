import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError

from .api.badugi_log import router as badugi_log_router
from .api.badugi_rl import router as badugi_rl_router
from .api.health import router as health_router
from .api.user import router as user_router
from .core.config import get_settings
from .core.db import engine
from .models import Base

settings = get_settings()
logger = logging.getLogger(__name__)

app = FastAPI(title="Badugi Multi-Game Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api")
app.include_router(user_router, prefix="/api")
app.include_router(badugi_rl_router, prefix="/api")
app.include_router(badugi_log_router, prefix="/api")


@app.on_event("startup")
def bootstrap_schema() -> None:
    """Attempt to create database tables on startup (safe if DB is offline)."""

    try:
        Base.metadata.create_all(bind=engine)
    except SQLAlchemyError as exc:
        logger.warning("Skipping metadata bootstrap; database unreachable: %s", exc)


@app.get("/")
def root():
    return {"message": "Badugi backend is running"}
