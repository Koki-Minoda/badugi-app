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
from .api.p2p import router as p2p_router, ws_router as p2p_ws_router
from .core.config import get_settings
from .core.db import SessionLocal, engine
from .p2p.manager import p2p_room_manager


settings = get_settings()
logger = logging.getLogger(__name__)


def bootstrap_schema() -> None:
    """Migrations-first bootstrap: local create_all, production upgrade + check."""

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

    _upgrade_database_to_head()
    _assert_migrations_up_to_date()


def _alembic_config():
    from alembic.config import Config

    backend_dir = Path(__file__).resolve().parents[1]
    config = Config(str(backend_dir / "alembic.ini"))
    config.set_main_option("script_location", str(backend_dir / "alembic"))
    return config


def _upgrade_database_to_head() -> None:
    """Apply committed migrations before accepting production traffic."""

    try:
        from alembic import command

        command.upgrade(_alembic_config(), "head")
    except Exception as exc:
        logger.exception("Database migration failed during backend startup")
        raise RuntimeError("Database migration failed during startup.") from exc


def _assert_migrations_up_to_date() -> None:
    try:
        from alembic.script import ScriptDirectory
    except Exception as exc:
        logger.exception("Alembic unavailable; cannot verify migration status")
        raise RuntimeError("Alembic is required outside local/test environments.") from exc

    try:
        config = _alembic_config()
        head_revision = ScriptDirectory.from_config(config).get_current_head()
    except Exception as exc:
        logger.exception("Failed to resolve alembic head revision")
        raise RuntimeError("Failed to resolve database migration head.") from exc

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


def configure_p2p_persistence() -> None:
    """Enable durable room recovery outside isolated test runs."""

    if (settings.backend_env or "local").lower() == "test":
        p2p_room_manager.attach_store(None)
        return
    from .p2p.persistence import SQLAlchemyRoomStore

    p2p_room_manager.attach_store(SQLAlchemyRoomStore(SessionLocal))


app.add_event_handler("startup", configure_p2p_persistence)

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
app.include_router(p2p_router, prefix="/api")
app.include_router(p2p_ws_router)


@app.get("/")
def root():
    return {"message": "Badugi backend is running"}
