import uuid
import base64
import io
import pytest
from PIL import Image
from fastapi.testclient import TestClient

from main import app, limiter
from db_postgres import init_db_schema, get_session_factory
from seed_postgres import run_postgres_seed
from models import User, LectureSession, AttendanceRecord, StudentStats, StudentSubjectEnrollment

def create_sample_face_b64(color=(200, 150, 150)) -> str:
    img = Image.new("RGB", (100, 100), color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")

@pytest.fixture(scope="module", autouse=True)
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
        "device_id": "LAPTOP-FAC-01"
    })
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def student_auth(client):
    res = client.post("/api/login", json={
        "roll_no": "STU01",
        "password": "stu123",
        "device_id": "DEV-AARAV-PHONE-01"
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
# 1. Demo Password Exception Verification
# ==============================================================================
def test_demo_password_login_works(client):
    """Verify demo passwords remain functional for dev/testing as explicitly requested."""
    res_stu = client.post("/api/login", json={"roll_no": "STU01", "password": "stu123"})
    assert res_stu.status_code == 200
    assert res_stu.json()["role"] == "student"

    res_fac = client.post("/api/login", json={"roll_no": "FAC01", "password": "fac123"})
    assert res_fac.status_code == 200
    assert res_fac.json()["role"] == "faculty"

    res_adm = client.post("/api/login", json={"roll_no": "ADM01", "password": "admin123"})
    assert res_adm.status_code == 200
    assert res_adm.json()["role"] == "admin"


# ==============================================================================
# 2. GPS Coordinate Withholding for Student Accounts
# ==============================================================================
def test_student_cannot_view_faculty_gps(client, faculty_auth, student_auth):
    """Verify that student accounts cannot see faculty live coordinates in session info."""
    start_res = client.post("/api/sessions/start", json={
        "subject_name": "CS301 - Operating Systems",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=faculty_auth)
    assert start_res.status_code == 200
    session_id = start_res.json()["session"]["session_id"]

    # Student requests session info -> class_lat and class_lng MUST be None
    res_student = client.get(f"/api/sessions/{session_id}/info", headers=student_auth)
    assert res_student.status_code == 200
    stu_info = res_student.json()
    assert stu_info["class_lat"] is None
    assert stu_info["class_lng"] is None
    assert stu_info["geofence_radius_meters"] == 150

    # Faculty requests session info -> class_lat and class_lng are present
    res_faculty = client.get(f"/api/sessions/{session_id}/info", headers=faculty_auth)
    assert res_faculty.status_code == 200
    fac_info = res_faculty.json()
    assert fac_info["class_lat"] == 19.0760
    assert fac_info["class_lng"] == 72.8777


# ==============================================================================
# 3. Subject Enrollment Verification (Strict 403 on missing/empty roster)
# ==============================================================================
@pytest.mark.skip(reason="Subject enrollment validation removed per user request")
def test_unenrolled_student_rejected_403(client, faculty_auth, student_auth):
    """Verify that a student not enrolled in a course cannot mark attendance (both empty roster and populated roster)."""
    # Case A: Empty/missing enrollment roster (ME999 has 0 enrolled students)
    start_res = client.post("/api/sessions/start", json={
        "subject_name": "ME999 - Advanced Robotics",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=faculty_auth)
    assert start_res.status_code == 200
    session_id = start_res.json()["session"]["session_id"]

    qr_res = client.get(f"/api/sessions/{session_id}/qr", headers=faculty_auth)
    qr_token = qr_res.json()["qr_token"]

    # STU01 attempts to mark attendance in ME999 with empty roster -> MUST reject with 403 NOT_ENROLLED
    mark_res = client.post("/api/attendance/mark", json={
        "session_id": session_id,
        "qr_token": qr_token,
        "device_id": "DEV-AARAV-PHONE-01",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": create_sample_face_b64(),
        "liveness_status": "CLIENT_BLINK_VERIFIED"
    }, headers=student_auth)

    assert mark_res.status_code == 403
    assert mark_res.json()["detail"]["failed_gate"] == "NOT_ENROLLED"

    # Case B: Populated roster for subject where student STU03 is NOT enrolled
    # Login as STU03 who is enrolled only in CS301 and CS302, but NOT CS303
    stu03_res = client.post("/api/login", json={"roll_no": "STU03", "password": "stu123"})
    assert stu03_res.status_code == 200
    stu03_headers = {"Authorization": f"Bearer {stu03_res.json()['access_token']}"}
    client.post("/api/student/enroll-face", json={
        "live_selfie_base64": create_sample_face_b64(),
        "consent_given": True
    }, headers=stu03_headers)

    start_cs303 = client.post("/api/sessions/start", json={
        "subject_name": "CS303 - Machine Learning",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=faculty_auth)
    assert start_cs303.status_code == 200
    sess_cs303_id = start_cs303.json()["session"]["session_id"]
    qr_cs303 = client.get(f"/api/sessions/{sess_cs303_id}/qr", headers=faculty_auth).json()["qr_token"]

    mark_cs303 = client.post("/api/attendance/mark", json={
        "session_id": sess_cs303_id,
        "qr_token": qr_cs303,
        "device_id": "DEV-ROHAN-PHONE-03",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": create_sample_face_b64(),
        "liveness_status": "CLIENT_BLINK_VERIFIED"
    }, headers=stu03_headers)

    assert mark_cs303.status_code == 403
    assert mark_cs303.json()["detail"]["failed_gate"] == "NOT_ENROLLED"


# ==============================================================================
# 4. Consolidated Faculty Approval (Only PENDING_APPROVAL can be reviewed)
# ==============================================================================
def test_faculty_approve_fails_on_non_pending_record(client, faculty_auth):
    """Verify that approving/rejecting a record that is not in PENDING_APPROVAL fails with HTTP 400."""
    db = get_session_factory()()
    session_id = f"TEST-STATUS-{uuid.uuid4().hex[:6]}"
    test_roll = f"STU-PRES-{uuid.uuid4().hex[:6]}"
    try:
        sess = LectureSession(
            session_id=session_id,
            session_code=session_id,
            subject_name="CS301 - Operating Systems",
            faculty_id="FAC01",
            secret_seed="test_secret",
            status="ACTIVE"
        )
        db.add(sess)
        rec = AttendanceRecord(
            session_id=session_id,
            roll_no=test_roll,
            student_name="Already Present",
            used_device_id=f"DEV_{test_roll}",
            status="PRESENT"
        )
        db.add(rec)
        db.commit()
    finally:
        db.close()

    res = client.post("/api/faculty/approve", json={
        "session_id": session_id,
        "roll_no": test_roll,
        "action": "APPROVE"
    }, headers=faculty_auth)

    assert res.status_code == 400
    assert "Only records in 'PENDING_APPROVAL'" in res.json()["detail"]


# ==============================================================================
# 5. Rejected Attendance Transitions to ABSENT & Recomputes Statistics
# ==============================================================================
def test_rejected_attendance_transitions_to_absent(client, faculty_auth):
    """Verify that faculty rejecting a PENDING_APPROVAL record marks it ABSENT and updates stats."""
    db = get_session_factory()()
    session_id = f"TEST-REJECT-{uuid.uuid4().hex[:6]}"
    test_roll = f"TEST_REJ_{uuid.uuid4().hex[:6]}"
    try:
        test_student = User(
            roll_no=test_roll,
            name="Reject Test Student",
            email=f"{test_roll.lower()}@test.edu",
            password="dummy_password",
            role="student",
            department="CSE",
            semester=6
        )
        db.add(test_student)
        sess = LectureSession(
            session_id=session_id,
            session_code=session_id,
            subject_name="CS301 - Operating Systems",
            faculty_id="FAC01",
            secret_seed="test_secret_reject",
            status="ACTIVE"
        )
        db.add(sess)
        rec = AttendanceRecord(
            session_id=session_id,
            roll_no=test_roll,
            student_name="Reject Test Student",
            used_device_id=f"DEV_{test_roll}",
            status="PENDING_APPROVAL"
        )
        db.add(rec)
        db.commit()
        student_id = test_student.id
    finally:
        db.close()

    # Reject exception request
    rej_res = client.post("/api/faculty/approve", json={
        "session_id": session_id,
        "roll_no": test_roll,
        "action": "REJECT",
        "remarks": "Invalid excuse"
    }, headers=faculty_auth)

    assert rej_res.status_code == 200
    assert rej_res.json()["status"] == "ABSENT"

    db = get_session_factory()()
    try:
        updated_rec = db.query(AttendanceRecord).filter(
            AttendanceRecord.session_id == session_id,
            AttendanceRecord.roll_no == test_roll
        ).first()
        assert updated_rec.status == "ABSENT"

        stats = db.query(StudentStats).filter(StudentStats.user_id == student_id).first()
        assert stats is not None
        assert stats.total_lectures == 1
        assert stats.attended_lectures == 0
        assert stats.current_attendance_pct == 0.0
    finally:
        db.close()


# ==============================================================================
# 6. Untrusted Liveness: NOT_CHECKED Routes to PENDING_APPROVAL
# ==============================================================================
def test_liveness_not_checked_routes_to_pending_approval(client, faculty_auth, student_auth):
    """Verify that direct submissions with liveness_status='NOT_CHECKED' are routed to PENDING_APPROVAL."""
    start_res = client.post("/api/sessions/start", json={
        "subject_name": "CS301 - Operating Systems",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=faculty_auth)
    assert start_res.status_code == 200
    session_id = start_res.json()["session"]["session_id"]

    qr_res = client.get(f"/api/sessions/{session_id}/qr", headers=faculty_auth)
    qr_token = qr_res.json()["qr_token"]

    # Student STU01 submits with liveness_status="NOT_CHECKED"
    mark_res = client.post("/api/attendance/mark", json={
        "session_id": session_id,
        "qr_token": qr_token,
        "device_id": "DEV-AARAV-PHONE-01",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": create_sample_face_b64(),
        "liveness_status": "NOT_CHECKED"
    }, headers=student_auth)

    assert mark_res.status_code == 200
    data = mark_res.json()
    assert data["status"] == "PENDING_APPROVAL"
    assert data["details"]["liveness_status"] == "NOT_CHECKED"


def test_explicit_liveness_failure_fails_closed(client, faculty_auth, student_auth):
    """Verify that explicit liveness failure reported by capture device fails closed."""
    start_res = client.post("/api/sessions/start", json={
        "subject_name": "CS301 - Operating Systems",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=faculty_auth)
    assert start_res.status_code == 200
    session_id = start_res.json()["session"]["session_id"]

    qr_res = client.get(f"/api/sessions/{session_id}/qr", headers=faculty_auth)
    qr_token = qr_res.json()["qr_token"]

    mark_res = client.post("/api/attendance/mark", json={
        "session_id": session_id,
        "qr_token": qr_token,
        "device_id": "DEV-AARAV-PHONE-01",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": create_sample_face_b64(),
        "liveness_status": "FAILED"
    }, headers=student_auth)

    assert mark_res.status_code == 400
    assert mark_res.json()["detail"]["failed_gate"] == "GATE_4_LIVENESS"
