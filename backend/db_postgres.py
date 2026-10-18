import os
from pathlib import Path
from typing import Optional, Dict, Any
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

# Load environment variables from backend/.env or root .env
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path, override=True)

Base = declarative_base()

def normalize_database_url(url: Optional[str]) -> Optional[str]:
    """
    Normalizes PostgreSQL connection strings for SQLAlchemy 2.0 with synchronous psycopg (v3).
    Neon often provides strings formatted as:
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

_engine = None
_SessionLocal = None

def get_engine(override_url: Optional[str] = None):
    global _engine, _SessionLocal
    target_url = normalize_database_url(override_url) or NORM_DATABASE_URL

    if not target_url or "YOUR_NEON_" in target_url:
        return None

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
        if eng is None:
            return None
        return sessionmaker(autocommit=False, autoflush=False, bind=eng)
    return _SessionLocal

def get_pg_db():
    """FastAPI dependency for obtaining a database session."""
    session_factory = get_session_factory()
    if session_factory is None:
        raise RuntimeError(
            "PostgreSQL database is not configured. Please set a valid DATABASE_URL in `backend/.env`."
        )
    db = session_factory()
    try:
        yield db
    finally:
        db.close()

def check_postgres_connection(override_url: Optional[str] = None) -> Dict[str, Any]:
    """
    Verifies reachability and SSL connection to PostgreSQL / Neon.
    Returns status dict without crashing if connection is not configured or offline.
    """
    target_url = normalize_database_url(override_url) or NORM_DATABASE_URL

    if not target_url or "YOUR_NEON_" in target_url:
        return {
            "status": "NOT_CONFIGURED",
            "connected": False,
            "message": "DATABASE_URL is not set in backend/.env. Please configure your Neon PostgreSQL connection string.",
            "url_hint": None
        }

    # Hide password from URL hint
    masked_url = target_url
    if "@" in masked_url:
        user_part = masked_url.split("@")[0]
        host_part = masked_url.split("@")[1]
        scheme = user_part.split("://")[0]
        masked_url = f"{scheme}://***:***@{host_part}"

    try:
        eng = get_engine(override_url)
        if eng is None:
            return {
                "status": "ERROR",
                "connected": False,
                "message": "Could not create database engine.",
                "url_hint": masked_url
            }

        with eng.connect() as conn:
            # Query version and current database
            result = conn.execute(text("SELECT version(), current_database();")).fetchone()
            version_str = result[0] if result else "Unknown"
            db_name = result[1] if result else "Unknown"

            return {
                "status": "CONNECTED",
                "connected": True,
                "message": f"Successfully connected to PostgreSQL database '{db_name}'.",
                "version": version_str.split(",")[0] if version_str else version_str,
                "database": db_name,
                "url_hint": masked_url
            }
    except Exception as exc:
        return {
            "status": "CONNECTION_FAILED",
            "connected": False,
            "error": str(exc),
            "message": f"Failed to connect to database at {masked_url}: {exc}",
            "url_hint": masked_url
        }

if __name__ == "__main__":
    status_info = check_postgres_connection()
    print("PostgreSQL Connection Check:")
    print(status_info)
