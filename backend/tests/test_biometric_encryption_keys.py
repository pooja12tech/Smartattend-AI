import os
import math
import uuid
import base64
import numpy as np
import pytest
from cryptography.fernet import Fernet
from starlette.testclient import TestClient

from main import app, limiter
from db_postgres import init_db_schema, get_session_factory
from seed_postgres import run_postgres_seed
from models import User, FaceEnrollment, AttendanceRecord, SecurityAlert, LectureSession, AuditLog
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
    # 1x1 dummy PNG in base64
    return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

@pytest.fixture
def session_and_tokens(client):
    """Sets up faculty session, QR token, and student auth headers."""
    # Faculty login
    fac_res = client.post("/api/login", json={
        "roll_no": "FAC01",
        "password": "fac123",
        "device_id": "LAPTOP-FAC-01"
    })
    assert fac_res.status_code == 200, f"Faculty login failed: {fac_res.text}"
    fac_token = fac_res.json()["access_token"]
    fac_headers = {"Authorization": f"Bearer {fac_token}"}

    # Student login (STU01)
    stu_res = client.post("/api/login", json={
        "roll_no": "STU01",
        "password": "stu123",
        "device_id": "DEV-AARAV-PHONE-01"
    })
    assert stu_res.status_code == 200, f"Student login failed: {stu_res.text}"
    stu_token = stu_res.json()["access_token"]
    stu_headers = {"Authorization": f"Bearer {stu_token}"}

    # Admin login (ADM01)
    adm_res = client.post("/api/login", json={
        "roll_no": "ADM01",
        "password": "admin123",
        "device_id": "ADMIN-CONSOLE"
    })
    assert adm_res.status_code == 200, f"Admin login failed: {adm_res.text}"
    adm_token = adm_res.json()["access_token"]
    adm_headers = {"Authorization": f"Bearer {adm_token}"}

    # Clear STU01 existing enrollment for isolated test
    db = get_session_factory()()
    stu = db.query(User).filter(User.roll_no == "STU01").first()
    if stu:
        db.query(FaceEnrollment).filter(FaceEnrollment.user_id == stu.id).delete()
        db.query(AttendanceRecord).filter(AttendanceRecord.roll_no == "STU01").delete()
        db.query(SecurityAlert).filter(SecurityAlert.roll_no == "STU01").delete()
        db.commit()
    db.close()

    # Create active lecture session
    start_res = client.post("/api/sessions/start", json={
        "subject_name": "CS301 - Operating Systems",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    }, headers=fac_headers)
    assert start_res.status_code == 200, f"Session start failed: {start_res.text}"
    session_id = start_res.json()["session"]["session_id"]

    # Retrieve QR token
    qr_res = client.get(f"/api/sessions/{session_id}/qr", headers=fac_headers)
    assert qr_res.status_code == 200
    qr_token = qr_res.json()["qr_token"]

    return {
        "fac_headers": fac_headers,
        "stu_headers": stu_headers,
        "adm_headers": adm_headers,
        "session_id": session_id,
        "qr_token": qr_token,
        "roll_no": "STU01"
    }

# ==============================================================================
# 1. Successful Encryption and Decryption with Primary Key
# ==============================================================================
def test_successful_encryption_and_decryption_with_primary_key(monkeypatch):
    test_key = Fernet.generate_key().decode()
    monkeypatch.setenv("FACE_EMBED_KEY", test_key)
    monkeypatch.delenv("FACE_EMBED_FALLBACK_KEYS", raising=False)
    face_service.reset_cipher()

    # Create random unit vector
    vec = np.random.randn(512).astype(np.float32)
    vec /= np.linalg.norm(vec)

    encrypted = face_service.encrypt_embedding(vec)
    assert isinstance(encrypted, bytes)
    assert len(encrypted) > 0

    decrypted = face_service.decrypt_embedding(encrypted)
    assert isinstance(decrypted, np.ndarray)
    assert decrypted.shape == (512,)
    assert decrypted.dtype == np.float32
    assert np.allclose(vec, decrypted, atol=1e-5)

# ==============================================================================
# 2. Multi-Key Fallback Decryption Support
# ==============================================================================
def test_multi_key_fallback_decryption_support(monkeypatch):
    primary_key = Fernet.generate_key().decode()
    fallback_key_1 = Fernet.generate_key().decode()
    fallback_key_2 = Fernet.generate_key().decode()

    # 1. Vector encrypted with fallback_key_1
    cipher_fb1 = Fernet(fallback_key_1.encode())
    vec1 = np.random.randn(512).astype(np.float32)
    vec1 /= np.linalg.norm(vec1)
    enc_fb1 = cipher_fb1.encrypt(vec1.tobytes())

    # 2. Vector encrypted with fallback_key_2
    cipher_fb2 = Fernet(fallback_key_2.encode())
    vec2 = np.random.randn(512).astype(np.float32)
    vec2 /= np.linalg.norm(vec2)
    enc_fb2 = cipher_fb2.encrypt(vec2.tobytes())

    # Configure primary and fallbacks
    monkeypatch.setenv("FACE_EMBED_KEY", primary_key)
    monkeypatch.setenv("FACE_EMBED_FALLBACK_KEYS", f"{fallback_key_1},{fallback_key_2}")
    face_service.reset_cipher()

    # Decrypting both legacy ciphertexts must succeed
    dec1 = face_service.decrypt_embedding(enc_fb1)
    dec2 = face_service.decrypt_embedding(enc_fb2)
    assert np.allclose(vec1, dec1, atol=1e-5)
    assert np.allclose(vec2, dec2, atol=1e-5)

    # New encryption always uses primary key
    new_vec = np.random.randn(512).astype(np.float32)
    new_vec /= np.linalg.norm(new_vec)
    new_enc = face_service.encrypt_embedding(new_vec)
    dec_primary = Fernet(primary_key.encode()).decrypt(new_enc)
    assert np.allclose(new_vec, np.frombuffer(dec_primary, dtype=np.float32), atol=1e-5)

# ==============================================================================
# 3. Incorrect Key Decryption Rejection
# ==============================================================================
def test_incorrect_key_raises_biometric_decryption_error(monkeypatch):
    key_configured = Fernet.generate_key().decode()
    key_unrelated = Fernet.generate_key().decode()

    monkeypatch.setenv("FACE_EMBED_KEY", key_configured)
    monkeypatch.delenv("FACE_EMBED_FALLBACK_KEYS", raising=False)
    face_service.reset_cipher()

    # Encrypt with completely unrelated key
    cipher_unrelated = Fernet(key_unrelated.encode())
    vec = np.random.randn(512).astype(np.float32)
    vec /= np.linalg.norm(vec)
    bad_encrypted = cipher_unrelated.encrypt(vec.tobytes())

    with pytest.raises(face_service.BiometricDecryptionError) as exc_info:
        face_service.decrypt_embedding(bad_encrypted)

    err_msg = str(exc_info.value)
    assert "decryption failed" in err_msg.lower()
    # Confirm sensitive key material is never exposed in the error
    assert key_configured not in err_msg
    assert key_unrelated not in err_msg

# ==============================================================================
# 4. Missing Configuration Handling in Production vs Development
# ==============================================================================
def test_missing_key_in_production_raises_runtime_error(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.delenv("FACE_EMBED_KEY", raising=False)
    monkeypatch.delenv("FACE_EMBED_FALLBACK_KEYS", raising=False)
    face_service.reset_cipher()

    with pytest.raises(RuntimeError) as exc_info:
        face_service.validate_key_configuration()
    assert "FACE_EMBED_KEY is not set" in str(exc_info.value)

def test_short_key_in_production_raises_runtime_error(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("FACE_EMBED_KEY", "too-short-secret-key")
    face_service.reset_cipher()

    with pytest.raises(RuntimeError) as exc_info:
        face_service.validate_key_configuration()
    assert "too short" in str(exc_info.value).lower()

def test_missing_key_in_dev_uses_deterministic_fallback(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.delenv("FACE_EMBED_KEY", raising=False)
    monkeypatch.delenv("FACE_EMBED_FALLBACK_KEYS", raising=False)
    monkeypatch.setenv("JWT_SECRET", "test-secret-at-least-32-chars-long-1234567890")
    face_service.reset_cipher()

    cipher = face_service.get_fernet()
    assert cipher is not None
    vec = np.zeros(512, dtype=np.float32)
    vec[0] = 1.0
    enc = face_service.encrypt_embedding(vec)
    dec = face_service.decrypt_embedding(enc)
    assert np.allclose(vec, dec, atol=1e-5)

# ==============================================================================
# 5. Malformed Vector Rejection
# ==============================================================================
def test_malformed_vector_rejection():
    # Wrong dimensions
    with pytest.raises(face_service.MalformedEmbeddingError):
        face_service.encrypt_embedding(np.zeros(128, dtype=np.float32))

    # NaN / Inf
    bad_vec = np.zeros(512, dtype=np.float32)
    bad_vec[0] = np.nan
    with pytest.raises(face_service.MalformedEmbeddingError):
        face_service.encrypt_embedding(bad_vec)

    # Empty decryption bytes
    with pytest.raises(face_service.MalformedEmbeddingError):
        face_service.decrypt_embedding(b"")

# ==============================================================================
# 6. Template Rotation to Primary Key
# ==============================================================================
def test_template_rotation_to_primary_key(monkeypatch):
    primary_key = Fernet.generate_key().decode()
    fallback_key = Fernet.generate_key().decode()

    # Encrypt with fallback key
    cipher_fb = Fernet(fallback_key.encode())
    original_vec = np.random.randn(512).astype(np.float32)
    original_vec /= np.linalg.norm(original_vec)
    legacy_ciphertext = cipher_fb.encrypt(original_vec.tobytes())

    # Configure multi-key
    monkeypatch.setenv("FACE_EMBED_KEY", primary_key)
    monkeypatch.setenv("FACE_EMBED_FALLBACK_KEYS", fallback_key)
    face_service.reset_cipher()

    # Rotate to primary
    rotated_ciphertext = face_service.rotate_embedding(legacy_ciphertext)
    assert rotated_ciphertext != legacy_ciphertext

    # Rotated ciphertext can now be decrypted by primary key alone
    cipher_primary_only = Fernet(primary_key.encode())
    raw_decrypted = cipher_primary_only.decrypt(rotated_ciphertext)
    recovered_vec = np.frombuffer(raw_decrypted, dtype=np.float32).copy()
    recovered_vec /= np.linalg.norm(recovered_vec)
    assert np.allclose(original_vec, recovered_vec, atol=1e-5)

# ==============================================================================
# 7. End-to-End Enrollment to Attendance Verification Workflow
# ==============================================================================
def test_enrollment_to_attendance_verification_workflow(client, session_and_tokens, monkeypatch):
    v1 = np.zeros(512, dtype=np.float32)
    v1[0] = 1.0
    monkeypatch.setattr(face_service, "extract_embedding", lambda b: v1.copy())

    # 1. Student enrolls face
    enroll_res = client.post("/api/student/enroll-face", json={
        "live_selfie_base64": create_sample_face_b64(),
        "consent_given": True
    }, headers=session_and_tokens["stu_headers"])
    assert enroll_res.status_code == 200, f"Enrollment failed: {enroll_res.text}"
    assert enroll_res.json()["success"] is True

    # 2. Student marks attendance with matching face
    mark_res = client.post("/api/attendance/mark", json={
        "session_id": session_and_tokens["session_id"],
        "qr_token": session_and_tokens["qr_token"],
        "device_id": "DEV-AARAV-PHONE-01",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": create_sample_face_b64()
    }, headers=session_and_tokens["stu_headers"])

    assert mark_res.status_code == 200, f"Attendance failed: {mark_res.text}"
    mark_data = mark_res.json()
    assert mark_data["success"] is True
    assert mark_data["status"] in ("PRESENT", "PENDING_APPROVAL")
    assert mark_data["details"]["face_status"] == "MATCH"

# ==============================================================================
# 8. Key Mismatch Rejection During Attendance Verification
# ==============================================================================
def test_key_mismatch_during_attendance_verification(client, session_and_tokens, monkeypatch):
    v1 = np.zeros(512, dtype=np.float32)
    v1[0] = 1.0
    monkeypatch.setattr(face_service, "extract_embedding", lambda b: v1.copy())

    # 1. Enroll face
    enroll_res = client.post("/api/student/enroll-face", json={
        "live_selfie_base64": create_sample_face_b64(),
        "consent_given": True
    }, headers=session_and_tokens["stu_headers"])
    assert enroll_res.status_code == 200

    # 2. Simulate key mismatch by encrypting embedding with an unauthorized foreign key
    foreign_cipher = Fernet(Fernet.generate_key())
    foreign_ciphertext = foreign_cipher.encrypt(v1.tobytes())

    db = get_session_factory()()
    stu = db.query(User).filter(User.roll_no == session_and_tokens["roll_no"]).first()
    fe = db.query(FaceEnrollment).filter(FaceEnrollment.user_id == stu.id).first()
    fe.embedding = foreign_ciphertext
    db.commit()
    db.close()

    # 3. Marking attendance now fails with BIOMETRIC_DECRYPTION_FAILED
    mark_res = client.post("/api/attendance/mark", json={
        "session_id": session_and_tokens["session_id"],
        "qr_token": session_and_tokens["qr_token"],
        "device_id": "DEV-AARAV-PHONE-01",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": create_sample_face_b64()
    }, headers=session_and_tokens["stu_headers"])

    assert mark_res.status_code == 400
    res_data = mark_res.json()
    assert res_data["detail"]["code"] == "BIOMETRIC_DECRYPTION_FAILED"
    assert res_data["detail"]["failed_gate"] == "GATE_4_BIOMETRIC_TEMPLATE"
    assert "decrypted" in res_data["detail"]["message"].lower()

# ==============================================================================
# 9. Admin Health Audit & Authorized Reset/Re-enrollment Workflow
# ==============================================================================
def test_admin_health_audit_and_authorized_reenrollment_workflow(client, session_and_tokens, monkeypatch):
    v1 = np.zeros(512, dtype=np.float32)
    v1[0] = 1.0
    monkeypatch.setattr(face_service, "extract_embedding", lambda b: v1.copy())

    # 1. Put student in mismatched key state
    foreign_cipher = Fernet(Fernet.generate_key())
    db = get_session_factory()()
    stu = db.query(User).filter(User.roll_no == session_and_tokens["roll_no"]).first()
    fe = db.query(FaceEnrollment).filter(FaceEnrollment.user_id == stu.id).first()
    if not fe:
        fe = FaceEnrollment(
            user_id=stu.id,
            embedding=foreign_cipher.encrypt(v1.tobytes()),
            model_name="buffalo_sc",
            model_version="insightface-2.1"
        )
        db.add(fe)
    else:
        fe.embedding = foreign_cipher.encrypt(v1.tobytes())
    db.commit()
    db.close()

    # 2. Admin calls GET /api/admin/biometrics/health: identifies mismatch
    health_res = client.get("/api/admin/biometrics/health", headers=session_and_tokens["adm_headers"])
    assert health_res.status_code == 200
    health_data = health_res.json()
    assert health_data["status"] == "KEY_MISMATCH_DETECTED"
    assert health_data["mismatched_count"] >= 1
    mismatched_rolls = [m["roll_no"] for m in health_data["mismatched_students"]]
    assert session_and_tokens["roll_no"] in mismatched_rolls

    # 3. Admin authorized reset
    reset_res = client.post(
        f"/api/admin/reset-face/{session_and_tokens['roll_no']}",
        json={"reason": "Authorized re-enrollment required due to key mismatch"},
        headers=session_and_tokens["adm_headers"]
    )
    assert reset_res.status_code == 200
    assert reset_res.json()["success"] is True

    # Confirm audit log was written
    db = get_session_factory()()
    log = db.query(AuditLog).filter(
        AuditLog.action == "FACE_RESET",
        AuditLog.target_id == session_and_tokens["roll_no"]
    ).order_by(AuditLog.created_at.desc()).first()
    assert log is not None
    assert "key mismatch" in log.reason.lower()
    db.close()

    # 4. Student re-enrolls cleanly under active key
    re_enroll_res = client.post("/api/student/enroll-face", json={
        "live_selfie_base64": create_sample_face_b64(),
        "consent_given": True
    }, headers=session_and_tokens["stu_headers"])
    assert re_enroll_res.status_code == 200

    # 5. Student marks attendance: now succeeds!
    mark_res = client.post("/api/attendance/mark", json={
        "session_id": session_and_tokens["session_id"],
        "qr_token": session_and_tokens["qr_token"],
        "device_id": "DEV-AARAV-PHONE-01",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": create_sample_face_b64()
    }, headers=session_and_tokens["stu_headers"])
    assert mark_res.status_code == 200
    assert mark_res.json()["success"] is True

# ==============================================================================
# 10. Admin Biometrics Key Migration Endpoint
# ==============================================================================
def test_admin_biometrics_migration_endpoint(client, session_and_tokens, monkeypatch):
    primary_key = Fernet.generate_key().decode()
    fallback_key = Fernet.generate_key().decode()

    monkeypatch.setenv("FACE_EMBED_KEY", primary_key)
    monkeypatch.setenv("FACE_EMBED_FALLBACK_KEYS", fallback_key)
    face_service.reset_cipher()

    # Create enrollment encrypted with fallback key
    v1 = np.zeros(512, dtype=np.float32)
    v1[0] = 1.0
    cipher_fb = Fernet(fallback_key.encode())
    fallback_ciphertext = cipher_fb.encrypt(v1.tobytes())

    db = get_session_factory()()
    stu = db.query(User).filter(User.roll_no == session_and_tokens["roll_no"]).first()
    stu_id = stu.id
    fe = db.query(FaceEnrollment).filter(FaceEnrollment.user_id == stu_id).first()
    if not fe:
        fe = FaceEnrollment(
            user_id=stu_id,
            embedding=fallback_ciphertext,
            model_name="buffalo_sc",
            model_version="insightface-2.1"
        )
        db.add(fe)
    else:
        fe.embedding = fallback_ciphertext
    db.commit()
    db.close()

    # Call migration endpoint
    mig_res = client.post("/api/admin/biometrics/migrate", headers=session_and_tokens["adm_headers"])
    assert mig_res.status_code == 200
    mig_data = mig_res.json()
    assert mig_data["success"] is True
    assert mig_data["migrated_count"] >= 1

    # Verify the database record is now decryptable with the primary key alone
    db = get_session_factory()()
    fe = db.query(FaceEnrollment).filter(FaceEnrollment.user_id == stu_id).first()
    primary_cipher = Fernet(primary_key.encode())
    decrypted_raw = primary_cipher.decrypt(fe.embedding)
    recovered_vec = np.frombuffer(decrypted_raw, dtype=np.float32).copy()
    assert np.allclose(v1, recovered_vec, atol=1e-5)
    db.close()
