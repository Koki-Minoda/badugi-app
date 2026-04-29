import os

# Ensure strict production config validation is bypassed only during pytest.
os.environ.setdefault("BACKEND_ENV", "test")
os.environ.setdefault("BACKEND_DB_DRIVER", "sqlite")
os.environ.setdefault("BACKEND_DB_NAME", ":memory:")
