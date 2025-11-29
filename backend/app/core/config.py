"""Application configuration module."""
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseSettings, Field

# Load environment variables from a local .env if present.
load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent.parent / ".env", override=False)


class Settings(BaseSettings):
    """Central settings object for the backend service."""

    backend_env: str = Field("local", env="BACKEND_ENV")
    db_driver: str = Field("mysql", env="BACKEND_DB_DRIVER")
    db_host: str = Field("localhost", env="BACKEND_DB_HOST")
    db_port: int = Field(3306, env="BACKEND_DB_PORT")
    db_user: str = Field("root", env="BACKEND_DB_USER")
    db_password: str = Field("", env="BACKEND_DB_PASSWORD")
    db_name: str = Field("badugi_app", env="BACKEND_DB_NAME")
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance."""

    return Settings()
