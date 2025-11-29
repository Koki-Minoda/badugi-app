"""Database session management."""
from urllib.parse import quote_plus

from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker

from .config import get_settings

settings = get_settings()


def _driver_prefix() -> str:
    driver = (settings.db_driver or "mysql").lower()
    if driver in {"postgresql", "postgres", "postgresql+psycopg"}:
        return "postgresql+psycopg"
    if driver in {"sqlite", "sqlite3"}:
        return "sqlite+pysqlite"
    return "mysql+pymysql"


def _build_db_url() -> str:
    """Construct a SQLAlchemy compatible database URL."""

    dialect = _driver_prefix()
    if dialect.startswith("sqlite"):
        database = settings.db_name or ":memory:"
        if database == ":memory:":
            return f"{dialect}:///{database}"
        return f"{dialect}:///{database}"
    user = quote_plus(settings.db_user or "")
    password = quote_plus(settings.db_password or "")
    auth = ""
    if user:
        credentials = user
        if password:
            credentials = f"{user}:{password}"
        auth = f"{credentials}@"
    return f"{dialect}://{auth}{settings.db_host}:{settings.db_port}/{settings.db_name}"


DATABASE_URL = _build_db_url()

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    future=True,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """Provide a transactional scope for FastAPI dependencies."""

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connection() -> bool:
    """Attempt a lightweight connection; never raise on failure."""

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except SQLAlchemyError:
        return False
    except Exception:
        return False
