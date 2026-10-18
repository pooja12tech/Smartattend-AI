import os
from pathlib import Path
from typing import Optional, Dict, Any
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

# Load environment variables from backend/.env or root .env
backend_env = Path(__file__).resolve().parent / ".env"
root_env = Path(__file__).resolve().parent.parent / ".env"
if root_env.exists():
    load_dotenv(dotenv_path=root_env, override=False)
if backend_env.exists():
    load_dotenv(dotenv_path=backend_env, override=True)

Base = declarative_base()

def normalize_database_url(url: Optional[str]) -> Optional[str]:
    """
    Normalizes PostgreSQL connection strings for SQLAlchemy 2.0 with synchronous psycopg (v3).
    Neon provides connection strings formatted as:
      postgresql://... or postgres://...
    SQLAlchemy requires:
      postgresql+psycopg://...
    """
    if not url:
        return None
    url = url.strip()
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    if url.startswith("postgresql://") and not url.startswith("postgresql+"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url

RAW_DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
NORM_DATABASE_URL = normalize_database_url(RAW_DATABASE_URL)

RAW_DATABASE_URL_UNPOOLED = os.getenv("DATABASE_URL_UNPOOLED", "").strip()
NORM_DATABASE_URL_UNPOOLED = normalize_database_url(RAW_DATABASE_URL_UNPOOLED)

_engine = None
_SessionLocal = None
_is_fallback_sqlite = False

def get_effective_database_url(override_url: Optional[str] = None) -> str:
    """Returns configured PostgreSQL URL or local SQLite fallback if not configured."""
    global _is_fallback_sqlite
    target_url = normalize_database_url(override_url) or NORM_DATABASE_URL

    if target_url and "YOUR_NEON_" not in target_url:
        _is_fallback_sqlite = False
        return target_url

    _is_fallback_sqlite = True
    base_dir = Path(__file__).resolve().parent
    local_db_path = base_dir / "smartattend_local.db"
    return f"sqlite:///{local_db_path.as_posix()}"

def is_fallback_sqlite() -> bool:
    return _is_fallback_sqlite

def get_engine(override_url: Optional[str] = None):
    global _engine, _SessionLocal
    target_url = get_effective_database_url(override_url)

    if _engine is None or override_url is not None:
        engine_args: Dict[str, Any] = {
            "pool_pre_ping": True,
            "echo": False,
        }
        if "sqlite" in target_url:
            engine_args["connect_args"] = {"check_same_thread": False}
        else:
            # Neon serverless PostgreSQL connection pooling
            engine_args["pool_size"] = int(os.getenv("PG_POOL_SIZE", "5"))
            engine_args["max_overflow"] = int(os.getenv("PG_MAX_OVERFLOW", "10"))
            engine_args["pool_recycle"] = int(os.getenv("PG_POOL_RECYCLE", "300"))

        engine = create_engine(target_url, **engine_args)
        if override_url is None:
            _engine = engine
            _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
        return engine

    return _engine

def get_session_factory(override_url: Optional[str] = None):
    global _SessionLocal
    if _SessionLocal is None or override_url is not None:
        eng = get_engine(override_url)
        return sessionmaker(autocommit=False, autoflush=False, bind=eng)
    return _SessionLocal

def get_pg_db():
    """FastAPI dependency for obtaining a database session."""
    session_factory = get_session_factory()
    db = session_factory()
    try:
        yield db
    finally:
        db.close()

def init_db_schema():
    """Ensure relational tables are created."""
    eng = get_engine()
    Base.metadata.create_all(bind=eng)

def check_postgres_connection(override_url: Optional[str] = None) -> Dict[str, Any]:
    """
    Verifies reachability and SSL connection to PostgreSQL / Neon.
    Returns status dict without crashing if connection is not configured or offline.
    """
    raw_url = override_url or RAW_DATABASE_URL
    target_url = normalize_database_url(raw_url)

    if not target_url or "YOUR_NEON_" in target_url:
        return {
            "status": "LOCAL_FALLBACK",
            "connected": True,
            "database_type": "sqlite",
            "message": "DATABASE_URL is not set in backend/.env. Operating on local SQLite database (smartattend_local.db). Paste your Neon PostgreSQL connection string into backend/.env to connect to Neon cloud.",
            "url_hint": "sqlite:///smartattend_local.db"
        }

    # Mask password for safe logging
    masked_url = target_url
    if "@" in masked_url:
        user_part = masked_url.split("@")[0]
        host_part = masked_url.split("@")[1]
        scheme = user_part.split("://")[0]
        masked_url = f"{scheme}://***:***@{host_part}"

    try:
        eng = get_engine(target_url)
        with eng.connect() as conn:
            result = conn.execute(text("SELECT version(), current_database();")).fetchone()
            version_str = result[0] if result else "Unknown"
            db_name = result[1] if result else "Unknown"

            return {
                "status": "CONNECTED",
                "connected": True,
                "database_type": "postgresql",
                "message": f"Successfully connected to PostgreSQL database '{db_name}'.",
                "version": version_str.split(",")[0] if version_str else version_str,
                "database": db_name,
                "url_hint": masked_url
            }
    except Exception as exc:
        return {
            "status": "CONNECTION_FAILED",
            "connected": False,
            "database_type": "postgresql",
            "error": str(exc),
            "message": f"Failed to connect to database at {masked_url}: {exc}",
            "url_hint": masked_url
        }

if __name__ == "__main__":
    status_info = check_postgres_connection()
    print("Database Connection Status:")
    print(status_info)
