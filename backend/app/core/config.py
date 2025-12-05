"""Application configuration module."""
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict  # [tournament-feedback]

# プロジェクトのルート (/root/badugi-app) を特定
BASE_DIR = Path(__file__).resolve().parents[2]

# ルート直下の .env をロード
ENV_PATH = BASE_DIR / ".env"
load_dotenv(dotenv_path=ENV_PATH, override=False)


class Settings(BaseSettings):
    """Central settings object for the backend service."""

    # ---------- Backend environment ----------
    backend_env: str = Field("local", validation_alias="BACKEND_ENV")  # [tournament-feedback]

    # ---------- Database settings ----------
    db_driver: str = Field("mysql", validation_alias="BACKEND_DB_DRIVER")  # [tournament-feedback]
    db_host: str = Field("localhost", validation_alias="BACKEND_DB_HOST")  # [tournament-feedback]
    db_port: int = Field(3306, validation_alias="BACKEND_DB_PORT")  # [tournament-feedback]
    db_user: str = Field("mgx", validation_alias="BACKEND_DB_USER")  # [tournament-feedback]
    db_password: str = Field("Km041221", validation_alias="BACKEND_DB_PASSWORD")  # [tournament-feedback]
    db_name: str = Field("mgx_prod", validation_alias="BACKEND_DB_NAME")  # [tournament-feedback]

    # ---------- CORS ----------
    cors_origins: list[str] = Field(  # [tournament-feedback]
        default_factory=lambda: ["http://localhost:3000"],
        validation_alias="CORS_ORIGINS",
    )

    model_config = SettingsConfigDict(  # [tournament-feedback]
        env_file=ENV_PATH,
        env_file_encoding="utf-8",
    )  # [tournament-feedback]


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
