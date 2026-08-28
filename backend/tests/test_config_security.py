import pytest
from pydantic import ValidationError

from app.core.config import Settings


def _production_settings(**overrides):
    values = {
        "BACKEND_ENV": "prod",
        "BACKEND_DB_DRIVER": "mysql",
        "BACKEND_DB_PASSWORD": "database-secret",
        "SECRET_KEY": "s" * 32,
        "CORS_ORIGINS": ["https://mgx-poker.com"],
    }
    values.update(overrides)
    return Settings(**values)


def test_production_accepts_explicit_https_origin_and_strong_secret():
    settings = _production_settings()
    assert settings.backend_env == "prod"
    assert settings.cors_origins == ["https://mgx-poker.com"]


@pytest.mark.parametrize(
    "overrides",
    [
        {"SECRET_KEY": "too-short"},
        {"CORS_ORIGINS": ["*"]},
        {"CORS_ORIGINS": ["http://mgx-poker.com"]},
        {"CORS_ORIGINS": ["https://localhost:3000"]},
    ],
)
def test_production_rejects_unsafe_auth_or_cors_configuration(overrides):
    with pytest.raises(ValidationError):
        _production_settings(**overrides)


def test_unknown_backend_environment_is_rejected():
    with pytest.raises(ValidationError):
        _production_settings(BACKEND_ENV="production")
