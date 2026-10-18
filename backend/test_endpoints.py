import sys
import time
import base64
import io
from PIL import Image
from fastapi.testclient import TestClient

from main import app
from seed_postgres import run_postgres_seed
from db_postgres import init_db_schema

def create_sample_face_b64(color=(255, 100, 100)) -> str:
    """Create a simple test image in base64 format for face verification testing."""
    img = Image.new("RGB", (100, 100), color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")

def run_tests():
    print("=" * 60)
    print(" SmartAttend-AI : Comprehensive API, RBAC & Anti-Proxy Tests ")
    print("=" * 60)

    # Re-seed relational database with updated passwords and accounts
    init_db_schema()
    from db_postgres import get_session_factory
    from models import User
    _s = get_session_factory()()
    _stu4 = _s.query(User).filter((User.roll_no == "STU04") | (User.email == "neha@smartattend.edu")).first()
    if _stu4:
        _s.delete(_stu4)
        _s.commit()
    _s.close()

    run_postgres_seed()

    client = TestClient(app)

    # 1. Health check
    res = client.get("/")
    assert res.status_code == 200, f"Root check failed: {res.text}"
    print("[PASS] 1. Root Health Check OK:", res.json()["system"], "- Version:", res.json().get("version"))

    # 2. RBAC & Login Tests
    # 2a. Student Login with correct password
    res = client.post("/api/login", json={
        "roll_no": "STU01",
        "password": "stu123",
        "device_id": "DEV-AARAV-PHONE-01",
        "is_exception_mode": False
    })
    assert res.status_code == 200, f"Login failed: {res.text}"
    assert res.json()["role"] == "student"
    assert "access_token" in res.json(), "Access token missing from login response"
    assert res.json()["token_type"] == "bearer"
    student_token = res.json()["access_token"]
    print("[PASS] 2a. Student Login & JWT Token Issued:", student_token[:20] + "...")

    # 2a-2. Test Consent-Based Face Enrollment
    test_face_img = create_sample_face_b64((200, 150, 150))
    enroll_res = client.post("/api/student/enroll-face", json={
        "roll_no": "STU01",
        "live_selfie_base64": test_face_img,
        "consent_given": True
    })
    assert enroll_res.status_code == 200
    print("[PASS] 2a-2. Face Enrollment with Consent Verified:", enroll_res.json()["message"])

    # 2b. Invalid Password Check
    res = client.post("/api/login", json={
        "roll_no": "STU01",
        "password": "wrong_password",
        "device_id": "DEV-AARAV-PHONE-01",
        "is_exception_mode": False
    })
    assert res.status_code == 401, f"Expected 401, got: {res.status_code}"
    print("[PASS] 2b. Invalid Password Blocked (HTTP 401):", res.json()["detail"])

    # 2c. Student Device Mismatch Block Test
    res = client.post("/api/login", json={
        "roll_no": "STU01",
        "password": "stu123",
        "device_id": "DEV-UNKNOWN-PHONE-99",
        "is_exception_mode": False
    })
    assert res.status_code == 403, f"Device mismatch should have returned 403, got: {res.status_code}"
    print("[PASS] 2c. Device Mismatch Correctly Blocked (HTTP 403):", res.json()["detail"])

    # 2d. Student Exception Mode Login Test
    res = client.post("/api/login", json={
        "roll_no": "STU01",
        "password": "stu123",
        "device_id": "DEV-FRIEND-PHONE-55",
        "is_exception_mode": True
    })
    assert res.status_code == 200
    print("[PASS] 2d. Exception Mode Login Permitted:", res.json()["binding_status"])

    # 2e. Faculty Login
    res = client.post("/api/login", json={
        "roll_no": "FAC01",
        "password": "fac123",
        "device_id": "LAPTOP-FAC-01",
        "is_exception_mode": False
    })
    assert res.status_code == 200
    assert res.json()["role"] == "faculty"
    print("[PASS] 2e. Faculty Login OK:", res.json()["user"]["name"])

    # 2f. Admin Login
    res = client.post("/api/login", json={
        "roll_no": "ADM01",
        "password": "admin123",
        "device_id": "ADMIN-CONSOLE-01",
        "is_exception_mode": False
    })
    assert res.status_code == 200
    assert res.json()["role"] == "admin"
    print("[PASS] 2f. Admin Login OK:", res.json()["user"]["name"])

    # 3. Start Session & Dynamic QR
    res = client.post("/api/sessions/start", json={
        "subject_name": "CS301 Operating Systems",
        "faculty_id": "FAC01",
        "class_lat": 19.0760,
        "class_lng": 72.8777
    })
    assert res.status_code == 200
    session_id = res.json()["session"]["session_id"]
    print(f"[PASS] 3a. Lecture Session Started: {session_id}")

    res = client.get(f"/api/sessions/{session_id}/qr")
    assert res.status_code == 200
    qr_data = res.json()
    qr_token = qr_data["qr_token"]
    print(f"[PASS] 3b. Dynamic QR Token Generated: {qr_token} (Expires in {qr_data['expires_in_seconds']}s)")

    # 4. Anti-Proxy Gate Testing
    test_face_b64 = create_sample_face_b64((200, 150, 150))

    # Gate 3: Geofence Breach Test (>60m)
    res = client.post("/api/attendance/mark", json={
        "roll_no": "STU01",
        "session_id": session_id,
        "qr_token": qr_token,
        "device_id": "DEV-AARAV-PHONE-01",
        "user_lat": 19.1000,
        "user_lng": 72.8800,
        "live_selfie_base64": test_face_b64,
        "is_exception_mode": False
    })
    assert res.status_code == 400
    detail = res.json()["detail"]
    assert detail["failed_gate"] == "GATE_3_GPS_GEOFENCE"
    print("[PASS] 4a. Gate 3 (GPS Geofence Breach) Blocked:", detail["reason"])

    # Gate 2: Expired QR Token Test
    expired_token = f"{session_id}.{int(time.time() - 25)}.fake_signature"
    res = client.post("/api/attendance/mark", json={
        "roll_no": "STU01",
        "session_id": session_id,
        "qr_token": expired_token,
        "device_id": "DEV-AARAV-PHONE-01",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": test_face_b64,
        "is_exception_mode": False
    })
    assert res.status_code == 400
    detail = res.json()["detail"]
    assert detail["failed_gate"] == "GATE_2_DYNAMIC_QR"
    print("[PASS] 4b. Gate 2 (Expired QR Token) Blocked:", detail["reason"])

    # Gate 1: Device Mismatch Test
    fresh_qr = client.get(f"/api/sessions/{session_id}/qr").json()["qr_token"]
    res = client.post("/api/attendance/mark", json={
        "roll_no": "STU01",
        "session_id": session_id,
        "qr_token": fresh_qr,
        "device_id": "DEV-STRANGER-PHONE-99",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": test_face_b64,
        "is_exception_mode": False
    })
    assert res.status_code == 400
    detail = res.json()["detail"]
    assert detail["failed_gate"] == "GATE_1_DEVICE_LOCK"
    print("[PASS] 4c. Gate 1 (Device Mismatch) Blocked:", detail["reason"])

    # Successful Attendance Submission
    fresh_qr = client.get(f"/api/sessions/{session_id}/qr").json()["qr_token"]
    res = client.post("/api/attendance/mark", json={
        "roll_no": "STU01",
        "session_id": session_id,
        "qr_token": fresh_qr,
        "device_id": "DEV-AARAV-PHONE-01",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": test_face_b64,
        "is_exception_mode": False
    })
    assert res.status_code == 200, f"Valid attendance failed: {res.text}"
    print("[PASS] 4d. All 5 Gates Passed! Status:", res.json()["status"])

    # Anti-Proxy: Duplicate Device in Same Session
    fresh_qr = client.get(f"/api/sessions/{session_id}/qr").json()["qr_token"]
    res = client.post("/api/attendance/mark", json={
        "roll_no": "STU02",
        "session_id": session_id,
        "qr_token": fresh_qr,
        "device_id": "DEV-AARAV-PHONE-01",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": test_face_b64,
        "is_exception_mode": True
    })
    assert res.status_code == 400
    detail = res.json()["detail"]
    assert detail["failed_gate"] == "GATE_1_DEVICE_LOCK"
    print("[PASS] 4e. Gate 1 Anti-Proxy (Duplicate Device) Caught:", detail["reason"])

    # 5. Teacher Manual Attendance Override Test
    res = client.post("/api/faculty/manual-attendance", json={
        "session_id": session_id,
        "roll_no": "STU03",
        "status": "PRESENT",
        "faculty_id": "FAC01",
        "reason": "Phone Dead / Verified in Classroom by Prof. Turing"
    })
    assert res.status_code == 200
    print("[PASS] 5. Faculty Manual Attendance Override OK:", res.json()["message"])

    # 6. Student Dashboard & Bunk Calculator
    res = client.get("/api/student/STU01/dashboard")
    assert res.status_code == 200
    print("[PASS] 6a. Student Dashboard (STU01):", res.json()["bunk_calculator"]["message"])

    # 7. Faculty Live Session & Approval
    res = client.get(f"/api/faculty/session/{session_id}/live")
    assert res.status_code == 200
    fac_data = res.json()
    print(f"[PASS] 7. Faculty Live Dashboard: Present: {fac_data['counters']['present_count']}, Alerts: {fac_data['counters']['alerts_count']}")

    # 8. Admin Overview & User Management & Device Reset
    res = client.get("/api/admin/overview")
    assert res.status_code == 200
    admin_data = res.json()
    print(f"[PASS] 8a. Admin Overview OK: Total Users: {admin_data['counts']['total_users']}, "
          f"Avg Attendance: {admin_data['system_average_attendance_pct']}%, "
          f"Defaulters Flagged by ML: {len(admin_data['high_risk_defaulters'])}")

    # Admin creates a new student
    res = client.post("/api/admin/users", json={
        "role": "student",
        "roll_no": "STU04",
        "name": "Neha Gupta",
        "email": "neha@smartattend.edu",
        "password": "stu123",
        "department": "Computer Science & Engineering",
        "semester": 6,
        "initial_attendance_pct": 78.5
    })
    assert res.status_code == 200
    print("[PASS] 8b. Admin Added New Student:", res.json()["message"])

    # Admin resets hardware device lock for STU01
    res = client.post("/api/admin/reset-device/STU01")
    assert res.status_code == 200
    print("[PASS] 8c. Admin Reset Device Lock for STU01:", res.json()["message"])

    # Verify STU01 can now log in and bind a new device
    res = client.post("/api/login", json={
        "roll_no": "STU01",
        "password": "stu123",
        "device_id": "DEV-AARAV-NEW-IPHONE-15",
        "is_exception_mode": False
    })
    assert res.status_code == 200
    assert res.json()["binding_status"] == "DEVICE_BOUND_SUCCESSFULLY"
    print("[PASS] 8d. STU01 Successfully Bound to New Phone:", res.json()["binding_status"])

    print("\n" + "=" * 60)
    print(" ALL RBAC, MANUAL ATTENDANCE & ADMIN ENDPOINTS VERIFIED 100% ")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
