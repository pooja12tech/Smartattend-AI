import os
import math
import uuid
import time
import base64
import numpy as np
import pytest
from starlette.testclient import TestClient
from sqlalchemy import text

from main import app, limiter, generate_qr_signature, QR_WINDOW_SECONDS
from db_postgres import init_db_schema, get_session_factory
from seed_postgres import run_postgres_seed
from models import User, FaceEnrollment, AttendanceRecord, SecurityAlert, LectureSession
import face_service

@pytest.fixture(scope="session", autouse=True)
def setup_db():
    init_db_schema()
    run_postgres_seed()

@pytest.fixture
def client():
    limiter.reset()
    with TestClient(app) as c:
        yield c

def create_sample_face_b64() -> str:
    # 10x10 dummy JPEG header
    return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="


@pytest.fixture
def test_setup(client):
    """Logs in faculty and student, creates active session."""
    # Faculty login
    fac_res = client.post("/api/login", json={
        "roll_no": "FAC01",
        "password": "fac123",
        "device_id": "LAPTOP-FAC-01"
    })
    fac_token = fac_res.json()["access_token"]
    fac_headers = {"Authorization": f"Bearer {fac_token}"}

    # Student login (STU03)
    stu_res = client.post("/api/login", json={
        "roll_no": "STU03",
        "password": "stu123",
        "device_id": "DEV-ROHAN-PHONE-03"
    })
    stu_token = stu_res.json()["access_token"]
    stu_headers = {"Authorization": f"Bearer {stu_token}"}

    # Clean any prior enrollment for STU03 in isolated DB
    db = get_session_factory()()
    stu = db.query(User).filter(User.roll_no == "STU03").first()
    if stu:
        db.query(FaceEnrollment).filter(FaceEnrollment.user_id == stu.id).delete()
        db.query(AttendanceRecord).filter(AttendanceRecord.roll_no == "STU03").delete()
        db.query(SecurityAlert).filter(SecurityAlert.roll_no == "STU03").delete()
        db.commit()
    db.close()

    # Start session
    start_res = client.post("/api/sessions/start", json={
        "subject_name": "CS301 - Operating Systems",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=fac_headers)
    assert start_res.status_code == 200
    session_id = start_res.json()["session"]["session_id"]

    # Get QR token
    qr_res = client.get(f"/api/sessions/{session_id}/qr", headers=fac_headers)
    assert qr_res.status_code == 200
    qr_token = qr_res.json()["qr_token"]

    return {
        "fac_headers": fac_headers,
        "stu_headers": stu_headers,
        "session_id": session_id,
        "qr_token": qr_token,
        "roll_no": "STU03"
    }

# ==============================================================================
# 1. Not Enrolled -> 400 FACE_NOT_ENROLLED
# ==============================================================================
def test_face_not_enrolled_returns_400(client, test_setup):
    res = client.post("/api/attendance/mark", json={
        "session_id": test_setup["session_id"],
        "qr_token": test_setup["qr_token"],
        "device_id": "DEV-ROHAN-PHONE-03",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": create_sample_face_b64()
    }, headers=test_setup["stu_headers"])

    assert res.status_code == 400
    data = res.json()
    assert data["detail"]["code"] == "FACE_NOT_ENROLLED"
    assert "not enrolled" in data["detail"]["message"].lower()

# ==============================================================================
# 2. Match Outcome -> PRESENT (face_status="MATCH", score >= match_threshold)
# ==============================================================================
def test_face_match_present(client, test_setup, monkeypatch):
    # Vector v1: unit vector along dimension 0
    v1 = np.zeros(512, dtype=np.float32)
    v1[0] = 1.0

    monkeypatch.setattr(face_service, "extract_embedding", lambda b: v1.copy())

    # Enroll STU03
    enroll_res = client.post("/api/student/enroll-face", json={
        "live_selfie_base64": create_sample_face_b64(),
        "consent_given": True
    }, headers=test_setup["stu_headers"])
    assert enroll_res.status_code == 200

    # Mark attendance with identical vector
    mark_res = client.post("/api/attendance/mark", json={
        "session_id": test_setup["session_id"],
        "qr_token": test_setup["qr_token"],
        "device_id": "DEV-ROHAN-PHONE-03",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": create_sample_face_b64()
    }, headers=test_setup["stu_headers"])

    assert mark_res.status_code == 200
    data = mark_res.json()
    assert data["success"] is True
    assert data["status"] in ("PRESENT", "PENDING_APPROVAL")
    assert data["details"]["face_status"] == "MATCH"
    assert data["details"]["face_match_score"] == 100.0
    assert data["details"]["liveness_status"] == "NOT_CHECKED"

# ==============================================================================
# 3. Review Band -> PENDING_APPROVAL (review_threshold <= score < match_threshold)
# ==============================================================================
def test_face_review_band_pending_approval(client, test_setup, monkeypatch):
    v_enrolled = np.zeros(512, dtype=np.float32)
    v_enrolled[0] = 1.0

    # Live vector with cosine similarity = 0.44 (between review=0.38 and match=0.50)
    v_review = np.zeros(512, dtype=np.float32)
    v_review[0] = 0.44
    v_review[1] = math.sqrt(1.0 - 0.44 ** 2)

    # 1. Enroll with v_enrolled
    monkeypatch.setattr(face_service, "extract_embedding", lambda b: v_enrolled.copy())
    enroll_res = client.post("/api/student/enroll-face", json={
        "live_selfie_base64": create_sample_face_b64(),
        "consent_given": True
    }, headers=test_setup["stu_headers"])
    assert enroll_res.status_code == 200

    # 2. Mark with v_review
    monkeypatch.setattr(face_service, "extract_embedding", lambda b: v_review.copy())
    mark_res = client.post("/api/attendance/mark", json={
        "session_id": test_setup["session_id"],
        "qr_token": test_setup["qr_token"],
        "device_id": "DEV-ROHAN-PHONE-03",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": create_sample_face_b64()
    }, headers=test_setup["stu_headers"])

    assert mark_res.status_code == 200
    data = mark_res.json()
    assert data["status"] == "PENDING_APPROVAL"
    assert data["details"]["face_status"] == "REVIEW_REQUIRED"
    assert data["details"]["face_match_score"] == 44.0
    assert data["details"]["liveness_status"] == "NOT_CHECKED"

    # Confirm recorded in database as PENDING_APPROVAL
    db = get_session_factory()()
    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == test_setup["session_id"],
        AttendanceRecord.roll_no == test_setup["roll_no"]
    ).first()
    assert record is not None
    assert record.status == "PENDING_APPROVAL"
    assert record.face_status == "REVIEW_REQUIRED"
    assert record.face_match_score == 44.0
    assert record.liveness_status == "NOT_CHECKED"
    db.close()

# ==============================================================================
# 4. Mismatch -> Rejection + SecurityAlert Forensics
# ==============================================================================
def test_face_mismatch_fraud_security_alert(client, test_setup, monkeypatch):
    v_enrolled = np.zeros(512, dtype=np.float32)
    v_enrolled[0] = 1.0

    # Orthogonal mismatch vector (sim = 0.0 < 0.38)
    v_mismatch = np.zeros(512, dtype=np.float32)
    v_mismatch[1] = 1.0

    monkeypatch.setattr(face_service, "extract_embedding", lambda b: v_enrolled.copy())
    enroll_res = client.post("/api/student/enroll-face", json={
        "live_selfie_base64": create_sample_face_b64(),
        "consent_given": True
    }, headers=test_setup["stu_headers"])
    assert enroll_res.status_code == 200

    # Mark with mismatch
    monkeypatch.setattr(face_service, "extract_embedding", lambda b: v_mismatch.copy())
    mark_res = client.post("/api/attendance/mark", json={
        "session_id": test_setup["session_id"],
        "qr_token": test_setup["qr_token"],
        "device_id": "DEV-ROHAN-PHONE-03",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": create_sample_face_b64()
    }, headers=test_setup["stu_headers"])

    assert mark_res.status_code == 400
    data = mark_res.json()
    assert data["detail"]["failed_gate"] == "GATE_4_FACE_VERIFICATION"
    assert "face mismatch" in data["detail"]["reason"].lower()

    # Check SecurityAlert created in DB
    db = get_session_factory()()
    alert = db.query(SecurityAlert).filter(
        SecurityAlert.session_id == test_setup["session_id"],
        SecurityAlert.roll_no == test_setup["roll_no"]
    ).first()
    assert alert is not None
    assert alert.failed_gate == "GATE_4_FACE_VERIFICATION"
    db.close()

# ==============================================================================
# 5. Quality Error: No Face -> Retryable Error (NO fraud SecurityAlert)
# ==============================================================================
def test_face_quality_no_face_retryable(client, test_setup, monkeypatch):
    v_enrolled = np.zeros(512, dtype=np.float32)
    v_enrolled[0] = 1.0

    monkeypatch.setattr(face_service, "extract_embedding", lambda b: v_enrolled.copy())
    enroll_res = client.post("/api/student/enroll-face", json={
        "live_selfie_base64": create_sample_face_b64(),
        "consent_given": True
    }, headers=test_setup["stu_headers"])
    assert enroll_res.status_code == 200

    # Simulate NO_FACE quality exception
    def raise_no_face(b):
        raise face_service.FaceQualityError("NO_FACE", "No face detected in camera frame.")

    monkeypatch.setattr(face_service, "extract_embedding", raise_no_face)

    mark_res = client.post("/api/attendance/mark", json={
        "session_id": test_setup["session_id"],
        "qr_token": test_setup["qr_token"],
        "device_id": "DEV-ROHAN-PHONE-03",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": create_sample_face_b64()
    }, headers=test_setup["stu_headers"])

    assert mark_res.status_code == 400
    assert mark_res.json()["detail"]["code"] == "NO_FACE"

    # Confirm NO security alert recorded
    db = get_session_factory()()
    alerts = db.query(SecurityAlert).filter(
        SecurityAlert.session_id == test_setup["session_id"],
        SecurityAlert.roll_no == test_setup["roll_no"]
    ).all()
    assert len(alerts) == 0
    db.close()

# ==============================================================================
# 6. Quality Error: Multiple Faces -> Retryable Error (NO fraud SecurityAlert)
# ==============================================================================
def test_face_quality_multiple_faces_retryable(client, test_setup, monkeypatch):
    v_enrolled = np.zeros(512, dtype=np.float32)
    v_enrolled[0] = 1.0

    monkeypatch.setattr(face_service, "extract_embedding", lambda b: v_enrolled.copy())
    enroll_res = client.post("/api/student/enroll-face", json={
        "live_selfie_base64": create_sample_face_b64(),
        "consent_given": True
    }, headers=test_setup["stu_headers"])
    assert enroll_res.status_code == 200

    def raise_multiple_faces(b):
        raise face_service.FaceQualityError("MULTIPLE_FACES", "Multiple faces detected.")

    monkeypatch.setattr(face_service, "extract_embedding", raise_multiple_faces)

    mark_res = client.post("/api/attendance/mark", json={
        "session_id": test_setup["session_id"],
        "qr_token": test_setup["qr_token"],
        "device_id": "DEV-ROHAN-PHONE-03",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": create_sample_face_b64()
    }, headers=test_setup["stu_headers"])

    assert mark_res.status_code == 400
    assert mark_res.json()["detail"]["code"] == "MULTIPLE_FACES"

    # Confirm NO security alert recorded
    db = get_session_factory()()
    alerts = db.query(SecurityAlert).filter(
        SecurityAlert.session_id == test_setup["session_id"],
        SecurityAlert.roll_no == test_setup["roll_no"]
    ).all()
    assert len(alerts) == 0
    db.close()

# ==============================================================================
# 7. Double Enrollment 409 & Admin Reset Flow
# ==============================================================================
def test_double_enrollment_409_and_admin_reset(client, test_setup, monkeypatch):
    v1 = np.zeros(512, dtype=np.float32)
    v1[0] = 1.0
    monkeypatch.setattr(face_service, "extract_embedding", lambda b: v1.copy())

    # 1. First enrollment succeeds
    res1 = client.post("/api/student/enroll-face", json={
        "live_selfie_base64": create_sample_face_b64(),
        "consent_given": True
    }, headers=test_setup["stu_headers"])
    assert res1.status_code == 200

    # 2. Second enrollment returns 409 Conflict
    res2 = client.post("/api/student/enroll-face", json={
        "live_selfie_base64": create_sample_face_b64(),
        "consent_given": True
    }, headers=test_setup["stu_headers"])
    assert res2.status_code == 409
    assert "already enrolled" in res2.json()["detail"].lower()

    # 3. Admin resets student face template
    admin_res = client.post("/api/login", json={
        "roll_no": "ADM01",
        "password": "admin123",
        "device_id": "ADMIN-CONSOLE"
    })
    admin_token = admin_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    reset_res = client.post(
        f"/api/admin/reset-face/{test_setup['roll_no']}",
        json={"reason": "Student requested re-enrollment due to appearance change"},
        headers=admin_headers
    )
    assert reset_res.status_code == 200

    # 4. Student can now re-enroll successfully
    res3 = client.post("/api/student/enroll-face", json={
        "live_selfie_base64": create_sample_face_b64(),
        "consent_given": True
    }, headers=test_setup["stu_headers"])
    assert res3.status_code == 200

# ==============================================================================
# 8. Test Proving No Raw Image Stored Anywhere in DB
# ==============================================================================
def test_proving_no_raw_image_stored_in_db(client, test_setup, monkeypatch):
    # Marker base64 string
    raw_marker = "UNIQUE_RAW_SELFIE_PAYLOAD_MARKER_TEST_12345"
    marker_b64 = base64.b64encode(raw_marker.encode()).decode()

    v1 = np.zeros(512, dtype=np.float32)
    v1[0] = 1.0
    monkeypatch.setattr(face_service, "extract_embedding", lambda b: v1.copy())

    # Enroll
    enroll_res = client.post("/api/student/enroll-face", json={
        "live_selfie_base64": marker_b64,
        "consent_given": True
    }, headers=test_setup["stu_headers"])
    assert enroll_res.status_code == 200

    # Mark attendance
    mark_res = client.post("/api/attendance/mark", json={
        "session_id": test_setup["session_id"],
        "qr_token": test_setup["qr_token"],
        "device_id": "DEV-ROHAN-PHONE-03",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": marker_b64
    }, headers=test_setup["stu_headers"])
    assert mark_res.status_code == 200

    # Inspect database directly
    db = get_session_factory()()

    # 1. Verify users table has no registered_face_base64 column or data
    user_cols = [c.name for c in User.__table__.columns]
    assert "registered_face_base64" not in user_cols

    # 2. Verify attendance_records table has no live_selfie_base64 column or data
    att_cols = [c.name for c in AttendanceRecord.__table__.columns]
    assert "live_selfie_base64" not in att_cols
    assert "liveness_status" in att_cols

    # 3. Check face_enrollments table stores only binary ciphertext
    stu = db.query(User).filter(User.roll_no == test_setup["roll_no"]).first()
    enrollment = db.query(FaceEnrollment).filter(FaceEnrollment.user_id == stu.id).first()
    assert enrollment is not None
    assert isinstance(enrollment.embedding, bytes)
    # The raw bytes cannot contain the raw marker string
    assert marker_b64.encode() not in enrollment.embedding
    assert raw_marker.encode() not in enrollment.embedding

    # Decrypting returns the original 512 float32 vector, NOT an image
    decrypted_emb = face_service.decrypt_embedding(enrollment.embedding)
    assert isinstance(decrypted_emb, np.ndarray)
    assert decrypted_emb.shape == (512,)
    assert decrypted_emb.dtype == np.float32

    # 4. Check attendance record has only match score, face_status, liveness_status
    att_rec = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == test_setup["session_id"],
        AttendanceRecord.roll_no == test_setup["roll_no"]
    ).first()
    assert att_rec is not None
    assert att_rec.face_status == "MATCH"
    assert att_rec.liveness_status == "NOT_CHECKED"
    assert att_rec.face_match_score == 100.0
    rec_dict = att_rec.to_dict()
    assert "live_selfie_base64" not in rec_dict

    db.close()
