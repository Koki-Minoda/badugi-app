"""Database session management."""
import sys
from urllib.parse import quote_plus

from sqlalchemy import create_engine, event, text
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
IS_SQLITE = DATABASE_URL.startswith("sqlite+")


def _configure_sqlite_connection(dbapi_connection, _connection_record=None) -> None:
    """Make file-backed SQLite tolerate concurrent API reads and writes."""

    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.execute("PRAGMA foreign_keys=ON")
        if (settings.db_name or ":memory:") != ":memory:":
            cursor.execute("PRAGMA journal_mode=WAL")
    finally:
        cursor.close()

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    future=True,
    connect_args=(
        {"timeout": 30, "check_same_thread": False}
        if IS_SQLITE
        else {}
    ),
)

if IS_SQLITE:
    event.listen(engine, "connect", _configure_sqlite_connection)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """Provide a transactional scope for FastAPI dependencies."""

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _check_db_connection_impl() -> bool:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except SQLAlchemyError:
        return False
    except Exception:
        return False


_CHECK_DB_CONNECTION_ENTRYPOINT = None


def _resolve_db_connection_checker():
    current = getattr(sys.modules[__name__], "check_db_connection")
    if current is not _CHECK_DB_CONNECTION_ENTRYPOINT and callable(current):
        return current
    return _check_db_connection_impl


def check_db_connection() -> bool:
    """Attempt a lightweight connection; never raise on failure."""

    return bool(_resolve_db_connection_checker()())


_CHECK_DB_CONNECTION_ENTRYPOINT = check_db_connection
