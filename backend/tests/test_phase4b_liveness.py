import uuid
import base64
import io
import time
from datetime import datetime, timezone, timedelta
import pytest
from PIL import Image
import numpy as np
from fastapi.testclient import TestClient

from main import app, limiter
from db_postgres import init_db_schema, get_session_factory
from seed_postgres import run_postgres_seed
from models import User, LectureSession, AttendanceRecord, LivenessChallenge
import face_service

def create_sample_face_b64(color=(200, 150, 150), noise=False) -> str:
    arr = np.full((100, 100, 3), color, dtype=np.uint8)
    if noise:
        # Add slight pixel variation to simulate temporal micro-movement / eye closure
        arr[40:60, 30:70] = (100, 80, 80)
    img = Image.fromarray(arr)
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

@pytest.fixture
def student2_auth(client):
    res = client.post("/api/login", json={
        "roll_no": "STU03",
        "password": "stu123",
        "device_id": "DEV-ROHAN-PHONE-03"
    })
    assert res.status_code == 200
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    client.post("/api/student/enroll-face", json={
        "live_selfie_base64": create_sample_face_b64((180, 140, 140)),
        "consent_given": True
    }, headers=headers)

    return headers


# ==============================================================================
# 1. Challenge Issuance & Policy Enforcement
# ==============================================================================
def test_issue_challenge_success(client, faculty_auth, student_auth):
    """Enrolled student can successfully obtain a short-lived single-use challenge."""
    start_res = client.post("/api/sessions/start", json={
        "subject_name": "CS301 - Operating Systems",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=faculty_auth)
    assert start_res.status_code == 200
    session_id = start_res.json()["session"]["session_id"]

    chal_res = client.post("/api/liveness/challenge", json={
        "session_id": session_id
    }, headers=student_auth)

    assert chal_res.status_code == 200
    data = chal_res.json()
    assert data["success"] is True
    assert data["challenge_id"].startswith("CHAL_")
    assert len(data["challenge_token"]) > 20
    assert data["ttl_seconds"] == 45


def test_issue_challenge_without_enrollment_allowed(client, faculty_auth, student_auth):
    """Students can obtain a challenge without subject enrollment requirement."""
    start_res = client.post("/api/sessions/start", json={
        "subject_name": "ME999 - Advanced Robotics",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=faculty_auth)
    assert start_res.status_code == 200
    session_id = start_res.json()["session"]["session_id"]

    chal_res = client.post("/api/liveness/challenge", json={
        "session_id": session_id
    }, headers=student_auth)

    assert chal_res.status_code == 200
    assert "challenge_token" in chal_res.json()


def test_issue_challenge_ended_session_rejected_400(client, faculty_auth, student_auth):
    """Ended session cannot issue challenges."""
    start_res = client.post("/api/sessions/start", json={
        "subject_name": "CS301 - Operating Systems",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=faculty_auth)
    session_id = start_res.json()["session"]["session_id"]

    # End the session
    client.post(f"/api/sessions/{session_id}/end", headers=faculty_auth)

    chal_res = client.post("/api/liveness/challenge", json={
        "session_id": session_id
    }, headers=student_auth)

    assert chal_res.status_code == 400
    assert "Attendance is closed" in chal_res.json()["detail"]


# ==============================================================================
# 2. Dual-Frame Verified Attendance (PRESENT)
# ==============================================================================
def test_valid_attendance_with_challenge_and_dual_frames(client, faculty_auth, student_auth):
    """Submitting valid challenge with dual frames transitions directly to PRESENT."""
    start_res = client.post("/api/sessions/start", json={
        "subject_name": "CS301 - Operating Systems",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=faculty_auth)
    session_id = start_res.json()["session"]["session_id"]
    qr_token = client.get(f"/api/sessions/{session_id}/qr", headers=faculty_auth).json()["qr_token"]

    chal = client.post("/api/liveness/challenge", json={"session_id": session_id}, headers=student_auth).json()

    open_face = create_sample_face_b64()
    closed_face = create_sample_face_b64(noise=True)

    mark_res = client.post("/api/attendance/mark", json={
        "session_id": session_id,
        "qr_token": qr_token,
        "device_id": "DEV-AARAV-PHONE-01",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": open_face,
        "closed_eye_frame_base64": closed_face,
        "challenge_id": chal["challenge_id"],
        "challenge_token": chal["challenge_token"]
    }, headers=student_auth)

    assert mark_res.status_code == 200
    data = mark_res.json()
    assert data["status"] == "PRESENT"
    assert data["details"]["liveness_status"] == "SERVER_VERIFIED"

    # Verify challenge is marked consumed in DB
    db = get_session_factory()()
    ch_rec = db.query(LivenessChallenge).filter(LivenessChallenge.challenge_id == chal["challenge_id"]).first()
    assert ch_rec is not None
    assert ch_rec.is_consumed is True
    db.close()


# ==============================================================================
# 3. Replay Protection: Challenge Cannot Be Reused
# ==============================================================================
def test_replay_protection_challenge_already_used(client, faculty_auth, student_auth):
    """Replaying an already-consumed challenge fails closed with HTTP 400."""
    start_res = client.post("/api/sessions/start", json={
        "subject_name": "CS301 - Operating Systems",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=faculty_auth)
    session_id = start_res.json()["session"]["session_id"]
    qr_token = client.get(f"/api/sessions/{session_id}/qr", headers=faculty_auth).json()["qr_token"]

    chal = client.post("/api/liveness/challenge", json={"session_id": session_id}, headers=student_auth).json()

    # First use -> success
    client.post("/api/attendance/mark", json={
        "session_id": session_id,
        "qr_token": qr_token,
        "device_id": "DEV-AARAV-PHONE-01",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": create_sample_face_b64(),
        "closed_eye_frame_base64": create_sample_face_b64(noise=True),
        "challenge_id": chal["challenge_id"],
        "challenge_token": chal["challenge_token"]
    }, headers=student_auth)

    # Replay attempt in another session or duplicate request
    start_res2 = client.post("/api/sessions/start", json={
        "subject_name": "CS301 - Operating Systems",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=faculty_auth)
    session_id2 = start_res2.json()["session"]["session_id"]
    qr_token2 = client.get(f"/api/sessions/{session_id2}/qr", headers=faculty_auth).json()["qr_token"]

    replay_res = client.post("/api/attendance/mark", json={
        "session_id": session_id2,
        "qr_token": qr_token2,
        "device_id": "DEV-AARAV-PHONE-01",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": create_sample_face_b64(),
        "closed_eye_frame_base64": create_sample_face_b64(noise=True),
        "challenge_id": chal["challenge_id"],
        "challenge_token": chal["challenge_token"]
    }, headers=student_auth)

    assert replay_res.status_code == 400
    assert replay_res.json()["detail"]["failed_gate"] == "GATE_4_CHALLENGE"


# ==============================================================================
# 4. Challenge Expiration
# ==============================================================================
def test_challenge_expiration(client, faculty_auth, student_auth):
    """Expired challenge returns HTTP 400 CHALLENGE_EXPIRED."""
    start_res = client.post("/api/sessions/start", json={
        "subject_name": "CS301 - Operating Systems",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=faculty_auth)
    session_id = start_res.json()["session"]["session_id"]
    qr_token = client.get(f"/api/sessions/{session_id}/qr", headers=faculty_auth).json()["qr_token"]

    chal = client.post("/api/liveness/challenge", json={"session_id": session_id}, headers=student_auth).json()

    # Manually expire the challenge in the DB
    db = get_session_factory()()
    ch_rec = db.query(LivenessChallenge).filter(LivenessChallenge.challenge_id == chal["challenge_id"]).first()
    ch_rec.expires_at = datetime.now(timezone.utc) - timedelta(seconds=10)
    db.commit()
    db.close()

    mark_res = client.post("/api/attendance/mark", json={
        "session_id": session_id,
        "qr_token": qr_token,
        "device_id": "DEV-AARAV-PHONE-01",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": create_sample_face_b64(),
        "closed_eye_frame_base64": create_sample_face_b64(noise=True),
        "challenge_id": chal["challenge_id"],
        "challenge_token": chal["challenge_token"]
    }, headers=student_auth)

    assert mark_res.status_code == 400
    assert mark_res.json()["detail"]["code"] == "CHALLENGE_EXPIRED"


# ==============================================================================
# 5. Cross-Student & Cross-Session Challenge Rejection
# ==============================================================================
def test_cross_student_challenge_rejected(client, faculty_auth, student_auth, student2_auth):
    """Student A cannot consume a challenge issued to Student B."""
    start_res = client.post("/api/sessions/start", json={
        "subject_name": "CS301 - Operating Systems",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=faculty_auth)
    session_id = start_res.json()["session"]["session_id"]
    qr_token = client.get(f"/api/sessions/{session_id}/qr", headers=faculty_auth).json()["qr_token"]

    # Challenge issued to STU01
    chal_stu1 = client.post("/api/liveness/challenge", json={"session_id": session_id}, headers=student_auth).json()

    # STU03 attempts to mark attendance with STU01's challenge
    cross_res = client.post("/api/attendance/mark", json={
        "session_id": session_id,
        "qr_token": qr_token,
        "device_id": "DEV-ROHAN-PHONE-03",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": create_sample_face_b64(),
        "closed_eye_frame_base64": create_sample_face_b64(noise=True),
        "challenge_id": chal_stu1["challenge_id"],
        "challenge_token": chal_stu1["challenge_token"]
    }, headers=student2_auth)

    assert cross_res.status_code == 400
    assert cross_res.json()["detail"]["failed_gate"] == "GATE_4_CHALLENGE"


def test_cross_session_challenge_rejected(client, faculty_auth, student_auth):
    """Challenge issued for Session A cannot be consumed in Session B."""
    start1 = client.post("/api/sessions/start", json={
        "subject_name": "CS301 - Operating Systems",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=faculty_auth).json()
    start2 = client.post("/api/sessions/start", json={
        "subject_name": "CS301 - Operating Systems",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=faculty_auth).json()

    sess1_id = start1["session"]["session_id"]
    sess2_id = start2["session"]["session_id"]
    qr2_token = client.get(f"/api/sessions/{sess2_id}/qr", headers=faculty_auth).json()["qr_token"]

    # Challenge for sess1
    chal_sess1 = client.post("/api/liveness/challenge", json={"session_id": sess1_id}, headers=student_auth).json()

    # Attempt to use chal_sess1 in sess2
    cross_sess_res = client.post("/api/attendance/mark", json={
        "session_id": sess2_id,
        "qr_token": qr2_token,
        "device_id": "DEV-AARAV-PHONE-01",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": create_sample_face_b64(),
        "closed_eye_frame_base64": create_sample_face_b64(noise=True),
        "challenge_id": chal_sess1["challenge_id"],
        "challenge_token": chal_sess1["challenge_token"]
    }, headers=student_auth)

    assert cross_sess_res.status_code == 400
    assert cross_sess_res.json()["detail"]["failed_gate"] == "GATE_4_CHALLENGE"


# ==============================================================================
# 6. Static Image Attack Fails Closed
# ==============================================================================
def test_static_image_dual_frame_fails_closed(client, faculty_auth, student_auth):
    """Submitting identical images in open and closed frames fails closed with GATE_4_LIVENESS."""
    start_res = client.post("/api/sessions/start", json={
        "subject_name": "CS301 - Operating Systems",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=faculty_auth)
    session_id = start_res.json()["session"]["session_id"]
    qr_token = client.get(f"/api/sessions/{session_id}/qr", headers=faculty_auth).json()["qr_token"]

    chal = client.post("/api/liveness/challenge", json={"session_id": session_id}, headers=student_auth).json()

    # Exactly identical image sent for both frames (delta = 0)
    static_frame = create_sample_face_b64()

    spoof_res = client.post("/api/attendance/mark", json={
        "session_id": session_id,
        "qr_token": qr_token,
        "device_id": "DEV-AARAV-PHONE-01",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": static_frame,
        "closed_eye_frame_base64": static_frame,
        "challenge_id": chal["challenge_id"],
        "challenge_token": chal["challenge_token"]
    }, headers=student_auth)

    assert spoof_res.status_code == 400
    assert spoof_res.json()["detail"]["failed_gate"] == "GATE_4_LIVENESS"
    assert "Static image replay detected" in spoof_res.json()["detail"]["reason"]


# ==============================================================================
# 7. Inconclusive Liveness Routes to PENDING_APPROVAL
# ==============================================================================
def test_inconclusive_liveness_routes_to_pending_approval(client, faculty_auth, student_auth):
    """Missing closed frame with valid face match routes safely to PENDING_APPROVAL."""
    start_res = client.post("/api/sessions/start", json={
        "subject_name": "CS301 - Operating Systems",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=faculty_auth)
    session_id = start_res.json()["session"]["session_id"]
    qr_token = client.get(f"/api/sessions/{session_id}/qr", headers=faculty_auth).json()["qr_token"]

    chal = client.post("/api/liveness/challenge", json={"session_id": session_id}, headers=student_auth).json()

    mark_res = client.post("/api/attendance/mark", json={
        "session_id": session_id,
        "qr_token": qr_token,
        "device_id": "DEV-AARAV-PHONE-01",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": create_sample_face_b64(),
        "closed_eye_frame_base64": None, # Missing closed frame
        "challenge_id": chal["challenge_id"],
        "challenge_token": chal["challenge_token"]
    }, headers=student_auth)

    assert mark_res.status_code == 200
    data = mark_res.json()
    assert data["status"] == "PENDING_APPROVAL"
    assert data["details"]["liveness_status"] == "INCONCLUSIVE"


# ==============================================================================
# 8. Challenge Maintenance Cleanup Endpoint
# ==============================================================================
def test_challenge_cleanup_endpoint(client, faculty_auth):
    """Admin maintenance endpoint successfully purges expired challenges."""
    db = get_session_factory()()
    old_chal = LivenessChallenge(
        challenge_id=f"CHAL_OLD_{uuid.uuid4().hex[:6]}",
        session_id="CS301-SEC-A",
        roll_no="STU01",
        token_hash="fakehash",
        is_consumed=True,
        expires_at=datetime.now(timezone.utc) - timedelta(hours=30),
        created_at=datetime.now(timezone.utc) - timedelta(hours=31)
    )
    db.add(old_chal)
    db.commit()
    db.close()

    clean_res = client.post("/api/admin/maintenance/cleanup-challenges", headers=faculty_auth)
    assert clean_res.status_code == 200
    assert clean_res.json()["success"] is True
    assert clean_res.json()["purged_count"] >= 1


# ==============================================================================
# 9. SEC-02 & SEC-03: Challenge Ordering & Durable Consumption Under Failure
# ==============================================================================
def test_invalid_challenge_rejected_before_face_inference(client, faculty_auth, student_auth, monkeypatch):
    """SEC-02: Invalid or expired challenges must fail before expensive neural inference runs."""
    start_res = client.post("/api/sessions/start", json={
        "subject_name": "CS301 - Operating Systems",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=faculty_auth)
    session_id = start_res.json()["session"]["session_id"]
    qr_token = client.get(f"/api/sessions/{session_id}/qr", headers=faculty_auth).json()["qr_token"]

    inference_called = False
    original_extract = face_service.extract_embedding

    def spy_extract(img_bytes):
        nonlocal inference_called
        inference_called = True
        return original_extract(img_bytes)

    monkeypatch.setattr(face_service, "extract_embedding", spy_extract)

    # Submit request with a non-existent fake challenge
    res = client.post("/api/attendance/mark", json={
        "session_id": session_id,
        "qr_token": qr_token,
        "device_id": "DEV-AARAV-PHONE-01",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": create_sample_face_b64(),
        "closed_eye_frame_base64": create_sample_face_b64(noise=True),
        "challenge_id": "CHAL_NONEXISTENT_999",
        "challenge_token": "fake_token_value_xyz"
    }, headers=student_auth)

    assert res.status_code == 400
    assert res.json()["detail"]["failed_gate"] == "GATE_4_CHALLENGE"
    assert inference_called is False, "Expensive face inference was executed before challenge validation!"


def test_challenge_remains_consumed_after_face_mismatch(client, faculty_auth, student_auth, monkeypatch):
    """SEC-03: Challenge remains durably consumed even if face matching fails with 400."""
    start_res = client.post("/api/sessions/start", json={
        "subject_name": "CS301 - Operating Systems",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=faculty_auth)
    session_id = start_res.json()["session"]["session_id"]
    qr_token = client.get(f"/api/sessions/{session_id}/qr", headers=faculty_auth).json()["qr_token"]

    chal = client.post("/api/liveness/challenge", json={"session_id": session_id}, headers=student_auth).json()
    chal_id = chal["challenge_id"]

    # Mock extract_embedding to return orthogonal embedding to trigger face mismatch
    mismatch_vector = np.zeros(512, dtype=np.float32)
    mismatch_vector[1] = 1.0
    monkeypatch.setattr(face_service, "extract_embedding", lambda img_bytes: mismatch_vector.copy())

    res = client.post("/api/attendance/mark", json={
        "session_id": session_id,
        "qr_token": qr_token,
        "device_id": "DEV-AARAV-PHONE-01",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": create_sample_face_b64(),
        "closed_eye_frame_base64": create_sample_face_b64(noise=True),
        "challenge_id": chal_id,
        "challenge_token": chal["challenge_token"]
    }, headers=student_auth)

    assert res.status_code == 400
    assert res.json()["detail"]["failed_gate"] == "GATE_4_FACE_VERIFICATION"

    # Verify challenge is permanently consumed in database
    db = get_session_factory()()
    ch_rec = db.query(LivenessChallenge).filter(LivenessChallenge.challenge_id == chal_id).first()
    assert ch_rec is not None
    assert ch_rec.is_consumed is True
    db.close()

    # Retry using the same challenge token -> must be rejected as already consumed
    retry_res = client.post("/api/attendance/mark", json={
        "session_id": session_id,
        "qr_token": qr_token,
        "device_id": "DEV-AARAV-PHONE-01",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": create_sample_face_b64(),
        "closed_eye_frame_base64": create_sample_face_b64(noise=True),
        "challenge_id": chal_id,
        "challenge_token": chal["challenge_token"]
    }, headers=student_auth)

    assert retry_res.status_code == 400
    assert retry_res.json()["detail"]["failed_gate"] == "GATE_4_CHALLENGE"
    assert "already been consumed" in retry_res.json()["detail"]["reason"]


def test_challenge_remains_consumed_after_inference_exception(client, faculty_auth, student_auth, monkeypatch):
    """SEC-03: Challenge remains durably consumed even if an inference exception occurs."""
    start_res = client.post("/api/sessions/start", json={
        "subject_name": "CS301 - Operating Systems",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=faculty_auth)
    session_id = start_res.json()["session"]["session_id"]
    qr_token = client.get(f"/api/sessions/{session_id}/qr", headers=faculty_auth).json()["qr_token"]

    chal = client.post("/api/liveness/challenge", json={"session_id": session_id}, headers=student_auth).json()
    chal_id = chal["challenge_id"]

    def mock_extract_fail(img_bytes):
        raise face_service.FaceQualityError("BLURRY", "Selfie is excessively blurry")

    monkeypatch.setattr(face_service, "extract_embedding", mock_extract_fail)

    res = client.post("/api/attendance/mark", json={
        "session_id": session_id,
        "qr_token": qr_token,
        "device_id": "DEV-AARAV-PHONE-01",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": create_sample_face_b64(),
        "closed_eye_frame_base64": create_sample_face_b64(noise=True),
        "challenge_id": chal_id,
        "challenge_token": chal["challenge_token"]
    }, headers=student_auth)

    assert res.status_code == 400
    assert res.json()["detail"]["code"] == "BLURRY"

    # Check DB: challenge remains consumed
    db = get_session_factory()()
    ch_rec = db.query(LivenessChallenge).filter(LivenessChallenge.challenge_id == chal_id).first()
    assert ch_rec is not None
    assert ch_rec.is_consumed is True
    db.close()


# ==============================================================================
# 10. SEC-05: Embedding Reuse in Dual-Frame Liveness Verification
# ==============================================================================
def test_dual_frame_reuses_open_embedding(client, faculty_auth, student_auth, monkeypatch):
    """SEC-05: Open-frame embedding is computed once and reused without changing outcome."""
    start_res = client.post("/api/sessions/start", json={
        "subject_name": "CS301 - Operating Systems",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=faculty_auth)
    session_id = start_res.json()["session"]["session_id"]
    qr_token = client.get(f"/api/sessions/{session_id}/qr", headers=faculty_auth).json()["qr_token"]

    chal = client.post("/api/liveness/challenge", json={"session_id": session_id}, headers=student_auth).json()

    extract_call_count = 0
    original_extract = face_service.extract_embedding

    def spy_extract(img_bytes):
        nonlocal extract_call_count
        extract_call_count += 1
        return original_extract(img_bytes)

    monkeypatch.setattr(face_service, "extract_embedding", spy_extract)

    mark_res = client.post("/api/attendance/mark", json={
        "session_id": session_id,
        "qr_token": qr_token,
        "device_id": "DEV-AARAV-PHONE-01",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": create_sample_face_b64(),
        "closed_eye_frame_base64": create_sample_face_b64(noise=True),
        "challenge_id": chal["challenge_id"],
        "challenge_token": chal["challenge_token"]
    }, headers=student_auth)

    assert mark_res.status_code == 200
    assert mark_res.json()["status"] == "PRESENT"
    # Total calls: exactly 1 for live_selfie, 1 for closed_eye_frame = 2 (not 3)
    assert extract_call_count == 2, f"Expected 2 extract_embedding calls (1 live + 1 closed), got {extract_call_count}"

