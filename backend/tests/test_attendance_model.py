"""
Phase 3 Verification Test Suite: Correct Attendance Data Model
Tests:
1. Absentees auto-creation on session end for enrolled students without records.
2. Accurate stats calculation from AttendanceRecord (PRESENT vs ABSENT vs PENDING_APPROVAL).
3. Student with 0 records defaults cleanly to total=0, attended=0, pct=100.0%, streak=0.
4. Idempotent manual attendance override (editing an existing record does not double-count total lectures).
5. Exception mode approval recomputes stats cleanly upon transition from PENDING_APPROVAL to PRESENT.
"""
import uuid
import base64
import io
from PIL import Image
import pytest
from fastapi.testclient import TestClient

from main import app, limiter, recompute_student_stats
from db_postgres import init_db_schema, get_session_factory
from seed_postgres import run_postgres_seed
from models import User, LectureSession, AttendanceRecord, StudentStats, StudentSubjectEnrollment, AuditLog

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
        "device_id": "LAPTOP-FAC-01",
        "is_exception_mode": False
    })
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

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
    headers = {"Authorization": f"Bearer {token}"}

    client.post("/api/student/enroll-face", json={
        "live_selfie_base64": create_sample_face_b64(),
        "consent_given": True
    }, headers=headers)

    return headers

# ==============================================================================
# Phase 3 Tests
# ==============================================================================

def test_student_zero_records_defaults(client):
    """Verify that a student with 0 records defaults cleanly to 0 attended, 0 total, 100% pct, 0 streak."""
    db = get_session_factory()()
    try:
        test_roll = f"TEST_ZERO_{uuid.uuid4().hex[:6]}"
        new_student = User(
            roll_no=test_roll,
            name="Zero Record Student",
            email=f"{test_roll.lower()}@test.edu",
            password="dummy_password_hash",
            role="student",
            department="CSE",
            semester=6
        )
        db.add(new_student)
        db.commit()

        stats = recompute_student_stats(db, new_student.id)
        db.commit()

        assert stats.total_lectures == 0
        assert stats.attended_lectures == 0
        assert stats.current_attendance_pct == 100.0
        assert stats.current_streak == 0
        assert stats.mon_fri_skip_rate == 0.0
        assert stats.first_lecture_miss_rate == 0.0
    finally:
        db.close()

def test_absentees_auto_creation_on_session_end(client, faculty_auth, student_auth):
    """Verify that ending a session automatically inserts ABSENT records for enrolled students who did not attend."""
    # 1. Start a lecture session for CS301 (where STU01, STU02, STU03 are enrolled)
    start_res = client.post("/api/sessions/start", json={
        "subject_name": "CS301 - Operating Systems",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=faculty_auth)
    assert start_res.status_code == 200
    session_id = start_res.json()["session"]["session_id"]

    # 2. STU01 marks attendance as PRESENT
    qr_res = client.get(f"/api/sessions/{session_id}/qr", headers=faculty_auth)
    qr_token = qr_res.json()["qr_token"]

    mark_res = client.post("/api/attendance/mark", json={
        "session_id": session_id,
        "qr_token": qr_token,
        "device_id": "DEV-AARAV-PHONE-01",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": create_sample_face_b64(),
        "is_exception_mode": False
    }, headers=student_auth)
    assert mark_res.status_code == 200
    assert mark_res.json()["status"] == "PRESENT"

    db = get_session_factory()()
    try:
        stu2 = db.query(User).filter(User.roll_no == "STU02").first()
        initial_stu2_records_count = db.query(AttendanceRecord).filter(
            AttendanceRecord.roll_no == "STU02",
            AttendanceRecord.status.in_(["PRESENT", "ABSENT"])
        ).count()
        initial_stu2_att_count = db.query(AttendanceRecord).filter(
            AttendanceRecord.roll_no == "STU02",
            AttendanceRecord.status == "PRESENT"
        ).count()
    finally:
        db.close()

    # 3. Faculty ends the session
    end_res = client.post(f"/api/sessions/{session_id}/end", headers=faculty_auth)
    assert end_res.status_code == 200
    end_data = end_res.json()
    assert end_data["session"]["status"] == "ENDED"
    assert end_data["absentees_created"] >= 2  # STU02 and STU03 enrolled in CS301 did not attend

    db = get_session_factory()()
    try:
        # 4. Verify STU02 and STU03 have ABSENT records in this session
        stu2_record = db.query(AttendanceRecord).filter(
            AttendanceRecord.session_id == session_id,
            AttendanceRecord.roll_no == "STU02"
        ).first()
        assert stu2_record is not None
        assert stu2_record.status == "ABSENT"
        assert stu2_record.face_status == "ABSENT"

        stu3_record = db.query(AttendanceRecord).filter(
            AttendanceRecord.session_id == session_id,
            AttendanceRecord.roll_no == "STU03"
        ).first()
        assert stu3_record is not None
        assert stu3_record.status == "ABSENT"

        # 5. Verify STU01 still has PRESENT record and was NOT marked absent
        stu1_records = db.query(AttendanceRecord).filter(
            AttendanceRecord.session_id == session_id,
            AttendanceRecord.roll_no == "STU01"
        ).all()
        assert len(stu1_records) == 1
        assert stu1_records[0].status == "PRESENT"

        # 6. Verify STU02 stats recomputed: total increased by 1, attended unchanged
        stu2 = db.query(User).filter(User.roll_no == "STU02").first()
        stu2_stats = db.query(StudentStats).filter(StudentStats.user_id == stu2.id).first()
        assert stu2_stats.total_lectures == initial_stu2_records_count + 1
        assert stu2_stats.attended_lectures == initial_stu2_att_count
    finally:
        db.close()

def test_idempotent_manual_override_does_not_double_count(client, faculty_auth):
    """Verify that manually overriding an existing record updates the status without double-incrementing total lectures."""
    # 1. Start a session and end it so students are marked ABSENT
    start_res = client.post("/api/sessions/start", json={
        "subject_name": "CS301 - Operating Systems",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=faculty_auth)
    session_id = start_res.json()["session"]["session_id"]
    client.post(f"/api/sessions/{session_id}/end", headers=faculty_auth)

    db = get_session_factory()()
    try:
        stu2 = db.query(User).filter(User.roll_no == "STU02").first()
        stats_before = db.query(StudentStats).filter(StudentStats.user_id == stu2.id).first()
        total_before = stats_before.total_lectures
        att_before = stats_before.attended_lectures
    finally:
        db.close()

    # 2. Faculty overrides STU02 from ABSENT to PRESENT
    override_res1 = client.post("/api/faculty/manual-attendance", json={
        "session_id": session_id,
        "roll_no": "STU02",
        "status": "PRESENT",
        "reason": "Student was physically in class; phone was dead"
    }, headers=faculty_auth)
    assert override_res1.status_code == 200

    db = get_session_factory()()
    try:
        stu2 = db.query(User).filter(User.roll_no == "STU02").first()
        stats_after1 = db.query(StudentStats).filter(StudentStats.user_id == stu2.id).first()
        # Total lectures should stay the SAME (since record was already in total as ABSENT), attended should increase by 1
        assert stats_after1.total_lectures == total_before
        assert stats_after1.attended_lectures == att_before + 1
    finally:
        db.close()

    # 3. Faculty calls override AGAIN with same status (idempotency check)
    override_res2 = client.post("/api/faculty/manual-attendance", json={
        "session_id": session_id,
        "roll_no": "STU02",
        "status": "PRESENT",
        "reason": "Second confirmation by faculty"
    }, headers=faculty_auth)
    assert override_res2.status_code == 200

    db = get_session_factory()()
    try:
        stu2 = db.query(User).filter(User.roll_no == "STU02").first()
        stats_after2 = db.query(StudentStats).filter(StudentStats.user_id == stu2.id).first()
        # Total and attended must NOT increment again
        assert stats_after2.total_lectures == total_before
        assert stats_after2.attended_lectures == att_before + 1
    finally:
        db.close()

    # 4. Faculty toggles back to ABSENT
    override_res3 = client.post("/api/faculty/manual-attendance", json={
        "session_id": session_id,
        "roll_no": "STU02",
        "status": "ABSENT",
        "reason": "Mistake corrected; student left early"
    }, headers=faculty_auth)
    assert override_res3.status_code == 200

    db = get_session_factory()()
    try:
        stu2 = db.query(User).filter(User.roll_no == "STU02").first()
        stats_after3 = db.query(StudentStats).filter(StudentStats.user_id == stu2.id).first()
        # Total remains constant; attended goes back down by 1
        assert stats_after3.total_lectures == total_before
        assert stats_after3.attended_lectures == att_before

        # 5. Verify audit logs were created for every override
        logs = db.query(AuditLog).filter(
            AuditLog.action == "MANUAL_ATTENDANCE_OVERRIDE",
            AuditLog.target_id == f"{session_id}:STU02"
        ).all()
        assert len(logs) >= 3
    finally:
        db.close()

def test_pending_approval_does_not_count_until_approved(client, faculty_auth):
    """Verify that PENDING_APPROVAL does not count towards attended until faculty approves it."""
    db = get_session_factory()()
    try:
        test_roll = f"TEST_EXC_{uuid.uuid4().hex[:6]}"
        test_student = User(
            roll_no=test_roll,
            name="Exception Test Student",
            email=f"{test_roll.lower()}@test.edu",
            password="dummy_password_hash",
            role="student",
            department="CSE",
            semester=6
        )
        db.add(test_student)
        db.commit()
        test_student_id = test_student.id
    finally:
        db.close()

    # Start a lecture session
    start_res = client.post("/api/sessions/start", json={
        "subject_name": "CS301 - Operating Systems",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=faculty_auth)
    session_id = start_res.json()["session"]["session_id"]

    # Insert a PENDING_APPROVAL record directly simulating exception submission
    db = get_session_factory()()
    try:
        rec = AttendanceRecord(
            session_id=session_id,
            roll_no=test_roll,
            student_name="Exception Test Student",
            used_device_id=f"EXC_DEV_{test_roll}",
            distance_meters=10.0,
            face_match_score=90.0,
            face_status="VERIFIED",
            is_exception_mode=True,
            status="PENDING_APPROVAL"
        )
        db.add(rec)
        db.commit()

        # Recompute stats while PENDING_APPROVAL
        stats = recompute_student_stats(db, test_student_id)
        db.commit()
        # PENDING_APPROVAL must NOT count towards attended or total lectures
        assert stats.total_lectures == 0
        assert stats.attended_lectures == 0
        assert stats.current_attendance_pct == 100.0
    finally:
        db.close()

    # Faculty approves the exception
    approve_res = client.post("/api/faculty/approve", json={
        "session_id": session_id,
        "roll_no": test_roll,
        "action": "APPROVE",
        "remarks": "Verified by faculty in person"
    }, headers=faculty_auth)
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "PRESENT"

    # Now student stats must count the approved record!
    db = get_session_factory()()
    try:
        stats = db.query(StudentStats).filter(StudentStats.user_id == test_student_id).first()
        assert stats.total_lectures == 1
        assert stats.attended_lectures == 1
        assert stats.current_attendance_pct == 100.0
        assert stats.current_streak == 1
    finally:
        db.close()
