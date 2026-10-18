import time
import math
import uuid
import io
import base64
from PIL import Image
import pytest
from fastapi.testclient import TestClient
from main import app, limiter, QR_WINDOW_SECONDS, generate_qr_signature
from db_postgres import init_db_schema, get_session_factory
from seed_postgres import run_postgres_seed
from models import LectureSession

def create_sample_face_b64(color=(200, 150, 150)) -> str:
    img = Image.new("RGB", (100, 100), color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")

@pytest.fixture(scope="session", autouse=True)
def setup_db():
    init_db_schema()
    run_postgres_seed()

@pytest.fixture
def client():
    limiter.reset()
    return TestClient(app)

@pytest.fixture
def faculty_auth(client):
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
def student_auth(client):
    # Ensure STU01 is bound and enrolled
    res = client.post("/api/login", json={
        "roll_no": "STU01",
        "password": "stu123",
        "device_id": "DEV-AARAV-PHONE-01",
        "is_exception_mode": False
    })
    assert res.status_code == 200
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    client.post("/api/student/enroll-face", json={
        "live_selfie_base64": create_sample_face_b64(),
        "consent_given": True
    }, headers=headers)

    return headers

# ==============================================================================
# Phase 2 Tests: Session and QR Lifecycle
# ==============================================================================

def test_session_id_is_valid_uuid4(client, faculty_auth):
    """Verify that sessions are generated with a cryptographically secure UUID4 ID."""
    res = client.post("/api/sessions/start", json={
        "subject_name": "CS301 - Operating Systems",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=faculty_auth)
    assert res.status_code == 200
    data = res.json()
    session_id = data["session"]["session_id"]
    
    # Validates uuid4 format
    parsed_uuid = uuid.UUID(session_id, version=4)
    assert str(parsed_uuid) == session_id
    assert "session_code" in data["session"]

def test_current_and_previous_window_tokens_accepted(client, faculty_auth, student_auth):
    """Test that current window and previous window (window_index - 1) tokens are accepted."""
    start_res = client.post("/api/sessions/start", json={
        "subject_name": "CS301 - Operating Systems",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=faculty_auth)
    assert start_res.status_code == 200
    session_id = start_res.json()["session"]["session_id"]

    # 1. Fetch live QR token for current window
    qr_res = client.get(f"/api/sessions/{session_id}/qr", headers=faculty_auth)
    assert qr_res.status_code == 200
    current_token = qr_res.json()["qr_token"]

    # Current window token accepted
    face_img = create_sample_face_b64()
    mark_res1 = client.post("/api/attendance/mark", json={
        "session_id": session_id,
        "qr_token": current_token,
        "device_id": "DEV-AARAV-PHONE-01",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": face_img,
        "is_exception_mode": False
    }, headers=student_auth)
    assert mark_res1.status_code == 200
    assert mark_res1.json()["status"] == "PRESENT"

    # 2. Test previous window token with a different student (STU02)
    res_stu2 = client.post("/api/login", json={
        "roll_no": "STU02",
        "password": "stu123",
        "device_id": "DEV-PRIYA-PHONE-02",
        "is_exception_mode": False
    })
    stu2_token = res_stu2.json()["access_token"]
    stu2_headers = {"Authorization": f"Bearer {stu2_token}"}

    # Query DB for secret_seed to craft window_index - 1 token
    session_db = get_session_factory()()
    s_obj = session_db.query(LectureSession).filter(LectureSession.session_id == session_id).first()
    secret_seed = s_obj.secret_seed
    session_db.close()

    now_epoch = int(time.time())
    current_window = int(math.floor(now_epoch / QR_WINDOW_SECONDS))
    prev_window = current_window - 1

    prev_sig = generate_qr_signature(session_id, prev_window, secret_seed)
    prev_token = f"{session_id}.{prev_window}.{prev_sig}"

    mark_res2 = client.post("/api/attendance/mark", json={
        "session_id": session_id,
        "qr_token": prev_token,
        "device_id": "DEV-PRIYA-PHONE-02",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": face_img,
        "is_exception_mode": False
    }, headers=stu2_headers)
    assert mark_res2.status_code == 200
    assert mark_res2.json()["status"] == "PRESENT"

def test_two_windows_old_token_rejected(client, faculty_auth, student_auth):
    """Test that a token 2 windows old (current_window - 2) is rejected by Gate 2."""
    start_res = client.post("/api/sessions/start", json={
        "subject_name": "CS301 - Operating Systems",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=faculty_auth)
    session_id = start_res.json()["session"]["session_id"]

    session_db = get_session_factory()()
    s_obj = session_db.query(LectureSession).filter(LectureSession.session_id == session_id).first()
    secret_seed = s_obj.secret_seed
    session_db.close()

    now_epoch = int(time.time())
    current_window = int(math.floor(now_epoch / QR_WINDOW_SECONDS))
    two_old_window = current_window - 2

    old_sig = generate_qr_signature(session_id, two_old_window, secret_seed)
    old_token = f"{session_id}.{two_old_window}.{old_sig}"

    mark_res = client.post("/api/attendance/mark", json={
        "session_id": session_id,
        "qr_token": old_token,
        "device_id": "DEV-AARAV-PHONE-01",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": create_sample_face_b64(),
        "is_exception_mode": False
    }, headers=student_auth)
    assert mark_res.status_code == 400
    assert mark_res.json()["detail"]["failed_gate"] == "GATE_2_DYNAMIC_QR"
    assert "expired" in mark_res.json()["detail"]["reason"].lower()

def test_token_from_another_session_rejected(client, faculty_auth, student_auth):
    """Test that a QR token generated for session A is rejected when submitted for session B."""
    # Start Session A
    res_a = client.post("/api/sessions/start", json={
        "subject_name": "CS301 - Operating Systems",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=faculty_auth)
    session_a = res_a.json()["session"]["session_id"]
    qr_token_a = client.get(f"/api/sessions/{session_a}/qr", headers=faculty_auth).json()["qr_token"]

    # Start Session B
    res_b = client.post("/api/sessions/start", json={
        "subject_name": "CS302 - Database Systems",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=faculty_auth)
    session_b = res_b.json()["session"]["session_id"]

    # Attempt to use Token A on Session B
    mark_res = client.post("/api/attendance/mark", json={
        "session_id": session_b,
        "qr_token": qr_token_a,
        "device_id": "DEV-AARAV-PHONE-01",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": create_sample_face_b64(),
        "is_exception_mode": False
    }, headers=student_auth)
    assert mark_res.status_code == 400
    assert mark_res.json()["detail"]["failed_gate"] == "GATE_2_DYNAMIC_QR"
    assert "mismatch" in mark_res.json()["detail"]["reason"].lower()

def test_tampered_signature_rejected(client, faculty_auth, student_auth):
    """Test that altering even one character of the HMAC-SHA256 signature fails validation."""
    start_res = client.post("/api/sessions/start", json={
        "subject_name": "CS301 - Operating Systems",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=faculty_auth)
    session_id = start_res.json()["session"]["session_id"]
    qr_token = client.get(f"/api/sessions/{session_id}/qr", headers=faculty_auth).json()["qr_token"]

    parts = qr_token.split(".")
    # Tamper the signature by flipping the first character
    tampered_sig = ("0" if parts[2][0] != "0" else "1") + parts[2][1:]
    tampered_token = f"{parts[0]}.{parts[1]}.{tampered_sig}"

    mark_res = client.post("/api/attendance/mark", json={
        "session_id": session_id,
        "qr_token": tampered_token,
        "device_id": "DEV-AARAV-PHONE-01",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": create_sample_face_b64(),
        "is_exception_mode": False
    }, headers=student_auth)
    assert mark_res.status_code == 400
    assert mark_res.json()["detail"]["failed_gate"] == "GATE_2_DYNAMIC_QR"
    assert "Invalid QR signature" in mark_res.json()["detail"]["reason"]

def test_ended_session_invalidates_qr_and_attendance(client, faculty_auth, student_auth):
    """Test that ending a session sets status to ENDED, populates ended_at, and blocks QR/attendance."""
    start_res = client.post("/api/sessions/start", json={
        "subject_name": "CS301 - Operating Systems",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=faculty_auth)
    session_id = start_res.json()["session"]["session_id"]
    qr_token = client.get(f"/api/sessions/{session_id}/qr", headers=faculty_auth).json()["qr_token"]

    # End the session
    end_res = client.post(f"/api/sessions/{session_id}/end", headers=faculty_auth)
    assert end_res.status_code == 200
    assert end_res.json()["session"]["status"] == "ENDED"
    assert end_res.json()["session"]["ended_at"] is not None

    # Verify fetching QR for ended session returns 400 Bad Request
    qr_after_end = client.get(f"/api/sessions/{session_id}/qr", headers=faculty_auth)
    assert qr_after_end.status_code == 400
    assert "Attendance is closed" in qr_after_end.json()["detail"]

    # Verify marking attendance for ended session returns 400 with SESSION_NOT_ACTIVE
    mark_after_end = client.post("/api/attendance/mark", json={
        "session_id": session_id,
        "qr_token": qr_token,
        "device_id": "DEV-AARAV-PHONE-01",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": create_sample_face_b64(),
        "is_exception_mode": False
    }, headers=student_auth)
    assert mark_after_end.status_code == 400
    assert mark_after_end.json()["detail"]["failed_gate"] == "SESSION_NOT_ACTIVE"
