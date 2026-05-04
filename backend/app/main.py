import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from .api.badugi_log import router as badugi_log_router
from .api.badugi_actions import router as badugi_actions_router
from .api.badugi_rl import router as badugi_rl_router
from .api.badugi_stats import router as badugi_stats_router
from .api.health import router as health_router
from .api.history import router as history_router
from .api.user import router as user_router
from .api.tournament_state import router as tournament_state_router
from .api.analysis_chatgpt import router as analysis_router  # [tournament-feedback]
from .api.auth import router as auth_router
from .api.variants import router as variants_router
from .core.config import get_settings
from .core.db import engine


settings = get_settings()
logger = logging.getLogger(__name__)


def bootstrap_schema() -> None:
    """Migrations-first bootstrap: local-only create_all + non-local migration checks."""

    env = (settings.backend_env or "local").lower()
    if env == "local":
        from .models import Base

        try:
            Base.metadata.create_all(bind=engine)
        except SQLAlchemyError as exc:
            logger.warning("Skipping metadata bootstrap; database unreachable: %s", exc)
        return

    if env == "test":
        return

    _assert_migrations_up_to_date()


def _assert_migrations_up_to_date() -> None:
    backend_dir = Path(__file__).resolve().parents[1]
    alembic_ini = backend_dir / "alembic.ini"
    script_location = backend_dir / "alembic"

    try:
        from alembic.config import Config
        from alembic.script import ScriptDirectory
    except Exception as exc:
        logger.warning("Alembic unavailable; cannot verify migration status: %s", exc)
        return

    try:
        config = Config(str(alembic_ini))
        config.set_main_option("script_location", str(script_location))
        head_revision = ScriptDirectory.from_config(config).get_current_head()
    except Exception as exc:
        logger.warning("Failed to resolve alembic head revision: %s", exc)
        return

    try:
        with engine.connect() as connection:
            inspector = inspect(connection)
            if not inspector.has_table("alembic_version"):
                logger.error(
                    "Database migration table alembic_version does not exist. "
                    "Run migrations before startup.",
                )
                current_revision = None
            else:
                current_revision = connection.execute(
                    text("SELECT version_num FROM alembic_version"),
                ).scalar_one_or_none()
    except SQLAlchemyError as exc:
        logger.error("Failed to read alembic current revision: %s", exc)
        raise RuntimeError("Database migration status check failed.") from exc

    if current_revision != head_revision:
        logger.error(
            "Database migration is not up to date. current=%s head=%s",
            current_revision,
            head_revision,
        )
        raise RuntimeError("Database migration required before startup.")


app = FastAPI(title="Badugi Multi-Game Backend", version="0.1.0")
app.add_event_handler("startup", bootstrap_schema)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api")
app.include_router(history_router, prefix="/api")
app.include_router(user_router, prefix="/api")
app.include_router(badugi_rl_router, prefix="/api")
app.include_router(badugi_log_router, prefix="/api")
app.include_router(badugi_actions_router, prefix="/api")
app.include_router(badugi_stats_router, prefix="/api")
app.include_router(tournament_state_router, prefix="/api")
app.include_router(analysis_router, prefix="/api/analysis", tags=["analysis"])  # [tournament-feedback]
app.include_router(auth_router, prefix="/api")
app.include_router(variants_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "Badugi backend is running"}
