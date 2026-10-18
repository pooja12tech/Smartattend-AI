"""
Pytest Isolation Configuration for SmartAttend-AI.
Enforces:
1. Tests must NEVER read backend/.env.
2. Tests must NEVER touch the DATABASE_URL in .env.
3. Tests must force an isolated in-memory or temp SQLite DB.
4. Fails loudly if a test run detects a postgres URL.
"""
import os
import sys
import tempfile
from pathlib import Path
import pytest

# Enforce test isolation before any application code or .env is loaded
os.environ["TESTING"] = "1"
os.environ["ENVIRONMENT"] = "testing"
os.environ["JWT_SECRET"] = "test-secret-key-at-least-32-chars-long-for-testing-purposes-12345"
os.environ["FACE_EMBED_KEY"] = "MCON8woyDxEDShtQ5a4UhdIC1KW5CAYID3llooYCQeA="
os.environ["FACE_MATCH_THRESHOLD"] = "0.50"
os.environ["FACE_REVIEW_THRESHOLD"] = "0.38"

# Create a clean temp SQLite DB file for isolated test runs
_temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_temp_db_path = _temp_db.name
_temp_db.close()

_sqlite_test_url = f"sqlite:///{Path(_temp_db_path).as_posix()}"
os.environ["DATABASE_URL"] = _sqlite_test_url
os.environ["DATABASE_URL_UNPOOLED"] = _sqlite_test_url

# Fail loudly if a test run detects a postgres URL
_check_url = os.environ.get("DATABASE_URL", "").lower()
if "postgres" in _check_url:
    raise RuntimeError(
        f"FATAL: Test isolation failure! Tests must NEVER touch a PostgreSQL database. "
        f"Detected DATABASE_URL: {_check_url}"
    )

@pytest.fixture(scope="session", autouse=True)
def enforce_test_isolation_and_init():
    current_db = os.environ.get("DATABASE_URL", "")
    if "postgres" in current_db.lower():
        raise RuntimeError(
            f"FATAL: Test isolation failure! Tests must NEVER touch a PostgreSQL database. Detected: {current_db}"
        )

    from db_postgres import init_db_schema, get_effective_database_url
    eff_url = get_effective_database_url()
    if "postgres" in str(eff_url).lower():
        raise RuntimeError(
            f"FATAL: Effective database URL is PostgreSQL: {eff_url}. Test isolation failed!"
        )

    init_db_schema()

    yield

    # Cleanup temp db
    try:
        if os.path.exists(_temp_db_path):
            os.remove(_temp_db_path)
    except Exception:
        pass

@pytest.fixture(autouse=True)
def default_mock_extract_embedding(monkeypatch):
    """
    Default monkeypatch so tests don't need the InsightFace model pack or camera hardware.
    Returns a normalized unit float32 vector (512-D).
    """
    import face_service
    import numpy as np

    dummy_vector = np.zeros(512, dtype=np.float32)
    dummy_vector[0] = 1.0

    monkeypatch.setattr(face_service, "extract_embedding", lambda img_bytes: dummy_vector.copy())

