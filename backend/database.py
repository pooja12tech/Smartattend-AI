import os
from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient, ASCENDING
from pymongo.errors import ConnectionFailure, PyMongoError

# Load environment variables from backend/.env or root .env
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path, override=True)

DEFAULT_MONGO_URI = "mongodb://localhost:27017/smartattend_db"
MONGODB_URI = os.getenv("MONGODB_URI", DEFAULT_MONGO_URI).strip()
DB_NAME = os.getenv("DB_NAME", "smartattend_db").strip()

_client = None
_db = None
_is_mock = False

def get_mongo_client():
    global _client, _is_mock
    if _client is not None:
        return _client

    # Attempt connection to configured MONGODB_URI
    if MONGODB_URI and not MONGODB_URI.startswith("mongodb://localhost"):
        try:
            client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=4000)
            client.admin.command("ping")
            _client = client
            _is_mock = False
            print(f"[Database] Successfully connected to live MongoDB Atlas at {MONGODB_URI.split('@')[-1] if '@' in MONGODB_URI else 'configured URI'}")
            return _client
        except Exception as e:
            print(f"[Database Warning] Could not connect to Atlas URI ({e}). Checking local/mock fallback...")

    # Attempt local mongodb
    try:
        client = MongoClient(DEFAULT_MONGO_URI, serverSelectionTimeoutMS=1500)
        client.admin.command("ping")
        _client = client
        _is_mock = False
        print("[Database] Successfully connected to local MongoDB instance.")
        return _client
    except Exception:
        pass

    # Graceful fallback to mongomock so endpoints and tests work immediately
    try:
        import mongomock
        _client = mongomock.MongoClient()
        _is_mock = True
        print("[Database Notice] Live MongoDB server not reachable. Operating with in-memory Mongo fallback.")
        print("                  Paste your MongoDB Atlas URI into `backend/.env` to persist to the cloud.")
        return _client
    except ImportError:
        # If mongomock isn't present, return regular client even if currently offline
        _client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=3000)
        _is_mock = False
        return _client

def is_mock_db() -> bool:
    global _is_mock
    return _is_mock

def get_database():
    global _db
    if _db is None:
        client = get_mongo_client()
        try:
            default_db = client.get_default_database()
            if default_db is not None:
                _db = default_db
            else:
                _db = client[DB_NAME]
        except Exception:
            _db = client[DB_NAME]
    return _db

# Collection accessor helpers
def get_users_collection():
    return get_database()["users"]

def get_lecture_sessions_collection():
    return get_database()["lecture_sessions"]

def get_attendance_logs_collection():
    return get_database()["attendance_logs"]

def get_security_alerts_collection():
    return get_database()["security_alerts"]

def check_connection() -> bool:
    """Verifies that MongoDB is reachable (either live Atlas/local or fallback mock)."""
    try:
        client = get_mongo_client()
        if _is_mock:
            return True
        client.admin.command("ping")
        return True
    except (ConnectionFailure, PyMongoError) as err:
        print(f"[Database Error] Connection check failed: {err}")
        return False

def init_db_indexes():
    """
    Creates essential compound unique indexes:
    1. attendance_logs: Compound unique on (session_id, roll_no)
    2. attendance_logs: Compound unique on (session_id, used_device_id) -> Anti-Proxy
    3. users: Unique on email, sparse unique on roll_no
    4. lecture_sessions: session_code, faculty_id
    5. security_alerts: session_id, created_at
    """
    db = get_database()
    attendance_col = db["attendance_logs"]
    users_col = db["users"]
    sessions_col = db["lecture_sessions"]
    alerts_col = db["security_alerts"]

    try:
        attendance_col.create_index(
            [("session_id", ASCENDING), ("roll_no", ASCENDING)],
            unique=True,
            name="uniq_session_student"
        )
        attendance_col.create_index(
            [("session_id", ASCENDING), ("used_device_id", ASCENDING)],
            unique=True,
            name="uniq_session_device"
        )
        users_col.create_index([("email", ASCENDING)], unique=True, name="uniq_user_email")
        users_col.create_index([("roll_no", ASCENDING)], unique=True, sparse=True, name="uniq_user_roll_no")
        sessions_col.create_index([("session_code", ASCENDING)], unique=True, name="uniq_session_code")
        alerts_col.create_index([("session_id", ASCENDING), ("created_at", ASCENDING)], name="idx_alerts_session")
        print("[Database] Indexes created/verified.")
    except Exception as e:
        print(f"[Database] Notice during index creation: {e}")

if __name__ == "__main__":
    print(f"[Database] Checking connection with target URI: {MONGODB_URI}")
    if check_connection():
        print(f"[Database] Ready! (Mock mode: {_is_mock})")
        init_db_indexes()
    else:
        print("[Database] Failed to connect.")
