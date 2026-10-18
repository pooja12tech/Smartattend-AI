import pytest
from fastapi.testclient import TestClient
from main import app, limiter
from db_postgres import init_db_schema, get_session_factory
from seed_postgres import run_postgres_seed
from models import User
from auth import hash_password, create_access_token

@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """Initialize DB schema, run seeds, and ensure a second faculty FAC02 exists."""
    init_db_schema()
    run_postgres_seed()
    
    session = get_session_factory()()
    fac02 = session.query(User).filter(User.roll_no == "FAC02").first()
    if not fac02:
        fac02 = User(
            roll_no="FAC02",
            name="Prof. Barbara Liskov",
            email="barbara@smartattend.edu",
            password=hash_password("fac123"),
            role="faculty",
            department="Computer Science & Engineering",
            is_active=True
        )
        session.add(fac02)
        session.commit()
    session.close()

@pytest.fixture
def client():
    # Reset limiter storage if needed for clean rate-limiting state
    limiter.reset()
    return TestClient(app)

@pytest.fixture
def student_auth(client):
    res = client.post("/api/login", json={
        "roll_no": "STU01",
        "password": "stu123",
        "device_id": "DEV-AARAV-PHONE-01",
        "is_exception_mode": False
    })
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def faculty1_auth(client):
    res = client.post("/api/login", json={
        "roll_no": "FAC01",
        "password": "fac123",
        "device_id": "LAPTOP-FAC-01",
        "is_exception_mode": False
    })
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def faculty2_auth(client):
    res = client.post("/api/login", json={
        "roll_no": "FAC02",
        "password": "fac123",
        "device_id": "LAPTOP-FAC-02",
        "is_exception_mode": False
    })
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def admin_auth(client):
    res = client.post("/api/login", json={
        "roll_no": "ADM01",
        "password": "admin123",
        "device_id": "ADMIN-CONSOLE-01",
        "is_exception_mode": False
    })
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

# ==============================================================================
# 1. Protected routes reject missing or invalid Bearer tokens (401)
# ==============================================================================

def test_unauthenticated_requests_return_401(client):
    protected_endpoints = [
        ("GET", "/api/admin/overview"),
        ("GET", "/api/admin/audit-logs"),
        ("POST", "/api/admin/users"),
        ("POST", "/api/admin/reset-device/STU01"),
        ("POST", "/api/admin/reset-face/STU01"),
        ("POST", "/api/admin/subjects"),
        ("GET", "/api/subjects"),
        ("POST", "/api/sessions/start"),
        ("GET", "/api/sessions/FAKE_ID/qr"),
        ("POST", "/api/attendance/mark"),
        ("POST", "/api/student/enroll-face"),
        ("GET", "/api/student/STU01/dashboard"),
        ("GET", "/api/student/STU01/subjects"),
        ("GET", "/api/faculty/session/FAKE_ID/live"),
        ("POST", "/api/faculty/approve"),
        ("POST", "/api/faculty/manual-attendance"),
    ]

    for method, path in protected_endpoints:
        if method == "GET":
            res = client.get(path)
        else:
            res = client.post(path, json={})
        assert res.status_code == 401, f"Expected 401 for unauthenticated {method} {path}, got {res.status_code}: {res.text}"

def test_invalid_bearer_token_returns_401(client):
    bad_headers = {"Authorization": "Bearer invalid.fake.token"}
    res = client.get("/api/admin/overview", headers=bad_headers)
    assert res.status_code == 401
    assert "Invalid authentication token" in res.json()["detail"]

# ==============================================================================
# 2. RBAC Role Restrictions (403 when wrong role calls route)
# ==============================================================================

def test_student_cannot_access_admin_or_faculty_routes(client, student_auth):
    # Student calling admin overview
    res = client.get("/api/admin/overview", headers=student_auth)
    assert res.status_code == 403

    # Student calling faculty start session
    res = client.post("/api/sessions/start", json={
        "subject_name": "CS301 - Operating Systems",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=student_auth)
    assert res.status_code == 403

    # Student calling faculty approve
    res = client.post("/api/faculty/approve", json={
        "session_id": "CS301-TEST",
        "roll_no": "STU01",
        "action": "APPROVE"
    }, headers=student_auth)
    assert res.status_code == 403

def test_faculty_cannot_access_admin_or_student_routes(client, faculty1_auth):
    # Faculty calling admin users
    res = client.post("/api/admin/users", json={
        "role": "student",
        "roll_no": "STU99",
        "name": "Test",
        "email": "test@smartattend.edu",
        "password": "pwd"
    }, headers=faculty1_auth)
    assert res.status_code == 403

    # Faculty calling student face enrollment
    res = client.post("/api/student/enroll-face", json={
        "live_selfie_base64": "dummy",
        "consent_given": True
    }, headers=faculty1_auth)
    assert res.status_code == 403

# ==============================================================================
# 3. Ownership Checks
# ==============================================================================

def test_student_dashboard_ownership(client, student_auth, faculty1_auth, admin_auth):
    # STU01 viewing own dashboard -> OK
    res = client.get("/api/student/STU01/dashboard", headers=student_auth)
    assert res.status_code == 200

    # STU01 viewing own subjects -> OK
    res = client.get("/api/student/STU01/subjects", headers=student_auth)
    assert res.status_code == 200

    # STU01 viewing STU02 dashboard -> 403 Forbidden
    res = client.get("/api/student/STU02/dashboard", headers=student_auth)
    assert res.status_code == 403
    assert "Students can only view their own dashboard" in res.json()["detail"]

    # STU01 viewing STU02 subjects -> 403 Forbidden
    res = client.get("/api/student/STU02/subjects", headers=student_auth)
    assert res.status_code == 403
    assert "Students can only view their own subjects" in res.json()["detail"]

    # Faculty viewing any student's dashboard -> OK
    res = client.get("/api/student/STU01/dashboard", headers=faculty1_auth)
    assert res.status_code == 200

    # Admin viewing any student's dashboard -> OK
    res = client.get("/api/student/STU01/dashboard", headers=admin_auth)
    assert res.status_code == 200

def test_faculty_session_ownership(client, faculty1_auth, faculty2_auth, admin_auth):
    # FAC01 starts session
    start_res = client.post("/api/sessions/start", json={
        "subject_name": "CS301 Operating Systems",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=faculty1_auth)
    assert start_res.status_code == 200
    session_id = start_res.json()["session"]["session_id"]

    # FAC01 accesses QR for own session -> OK (200)
    res = client.get(f"/api/sessions/{session_id}/qr", headers=faculty1_auth)
    assert res.status_code == 200

    # FAC01 views live attendance for own session -> OK (200)
    res = client.get(f"/api/faculty/session/{session_id}/live", headers=faculty1_auth)
    assert res.status_code == 200

    # FAC02 attempts to fetch QR for FAC01's session -> 403 Forbidden
    res = client.get(f"/api/sessions/{session_id}/qr", headers=faculty2_auth)
    assert res.status_code == 403
    assert "You can only view QR codes for sessions you started" in res.json()["detail"]

    # FAC02 attempts to view live attendance for FAC01's session -> 403 Forbidden
    res = client.get(f"/api/faculty/session/{session_id}/live", headers=faculty2_auth)
    assert res.status_code == 403
    assert "You can only view live attendance for sessions you started" in res.json()["detail"]

    # FAC02 attempts to do manual attendance override on FAC01's session -> 403 Forbidden
    res = client.post("/api/faculty/manual-attendance", json={
        "session_id": session_id,
        "roll_no": "STU01",
        "status": "PRESENT",
        "reason": "Test unauthorized override"
    }, headers=faculty2_auth)
    assert res.status_code == 403
    assert "You can only record manual attendance for sessions you started" in res.json()["detail"]

    # FAC02 attempts to approve exception on FAC01's session -> 403 Forbidden
    res = client.post("/api/faculty/approve", json={
        "session_id": session_id,
        "roll_no": "STU01",
        "action": "APPROVE"
    }, headers=faculty2_auth)
    assert res.status_code == 403
    assert "You can only approve exception attendance for sessions you started" in res.json()["detail"]

    # Admin can access QR and live attendance for any faculty's session -> 200 OK
    res = client.get(f"/api/sessions/{session_id}/qr", headers=admin_auth)
    assert res.status_code == 200

    res = client.get(f"/api/faculty/session/{session_id}/live", headers=admin_auth)
    assert res.status_code == 200

# ==============================================================================
# 4. Login Rate Limiting & Generic 401 Credential Message
# ==============================================================================

def test_login_generic_401_message_prevents_user_enumeration(client):
    # Non-existent user
    res1 = client.post("/api/login", json={
        "roll_no": "NONEXISTENT_USER_999",
        "password": "anypassword",
        "device_id": "TEST_DEVICE",
        "is_exception_mode": False
    })
    assert res1.status_code == 401
    assert res1.json()["detail"] == "Invalid credentials. Please verify your username and password."

    # Existing user with wrong password
    res2 = client.post("/api/login", json={
        "roll_no": "STU01",
        "password": "wrong_password_123",
        "device_id": "DEV-AARAV-PHONE-01",
        "is_exception_mode": False
    })
    assert res2.status_code == 401
    assert res2.json()["detail"] == "Invalid credentials. Please verify your username and password."

def test_login_rate_limiting_exceeded_returns_429(client):
    unique_roll_no = "RATELIMIT_TARGET_01"

    # Send 5 attempts (allowed)
    for _ in range(5):
        res = client.post("/api/login", json={
            "roll_no": unique_roll_no,
            "password": "wrong_password",
            "device_id": "DEV-TEST",
            "is_exception_mode": False
        })
        assert res.status_code == 401

    # 6th attempt within the 1-minute window must return 429 Too Many Requests
    res6 = client.post("/api/login", json={
        "roll_no": unique_roll_no,
        "password": "wrong_password",
        "device_id": "DEV-TEST",
        "is_exception_mode": False
    })
    assert res6.status_code == 429, f"Expected 429 on 6th login attempt, got {res6.status_code}: {res6.text}"
