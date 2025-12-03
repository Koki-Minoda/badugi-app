"""Application configuration module."""
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseSettings, Field

# プロジェクトのルート (/root/badugi-app) を特定
BASE_DIR = Path(__file__).resolve().parents[2]

# ルート直下の .env をロード
ENV_PATH = BASE_DIR / ".env"
load_dotenv(dotenv_path=ENV_PATH, override=False)


class Settings(BaseSettings):
    """Central settings object for the backend service."""

    # ---------- Backend environment ----------
    backend_env: str = Field("local", env="BACKEND_ENV")

    # ---------- Database settings ----------
    db_driver: str = Field("mysql", env="BACKEND_DB_DRIVER")
    db_host: str = Field("localhost", env="BACKEND_DB_HOST")
    db_port: int = Field(3306, env="BACKEND_DB_PORT")
    db_user: str = Field("mgx", env="BACKEND_DB_USER")
    db_password: str = Field("Km041221", env="BACKEND_DB_PASSWORD")
    db_name: str = Field("mgx_prod", env="BACKEND_DB_NAME")

    # ---------- CORS ----------
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000"],
        env="CORS_ORIGINS",
    )

    class Config:
        # ここでも .env の場所を明示しておく
        env_file = ENV_PATH
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
