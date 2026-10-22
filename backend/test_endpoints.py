import os
os.environ["DEVICE_BINDING_ENABLED"] = "false"
import sys
import time
import base64
import io
from PIL import Image
from fastapi.testclient import TestClient

import numpy as np
import face_service
_dummy_vector = np.ones(512, dtype=np.float32) / np.linalg.norm(np.ones(512, dtype=np.float32))
face_service.extract_embedding = lambda b: _dummy_vector.copy()

import main
main.DEVICE_BINDING_ENABLED = False
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
    from models import User, Subject
    _s = get_session_factory()()
    _stu4 = _s.query(User).filter((User.roll_no == "STU04") | (User.email == "neha@smartattend.edu")).first()
    if _stu4:
        _s.delete(_stu4)
    _sub9 = _s.query(Subject).filter(Subject.code == "CS309").first()
    if _sub9:
        _s.delete(_sub9)
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
    student_headers = {"Authorization": f"Bearer {student_token}"}
    print("[PASS] 2a. Student Login & JWT Token Issued:", student_token[:20] + "...")

    # 2a-2. Test Consent-Based Face Enrollment (requires student JWT)
    test_face_img = create_sample_face_b64((200, 150, 150))
    enroll_res = client.post("/api/student/enroll-face", json={
        "live_selfie_base64": test_face_img,
        "consent_given": True
    }, headers=student_headers)
    assert enroll_res.status_code == 200
    print("[PASS] 2a-2. Face Enrollment with Consent Verified:", enroll_res.json()["message"])

    # 2b. Invalid Password Check (returns generic 401)
    res = client.post("/api/login", json={
        "roll_no": "STU01",
        "password": "wrong_password",
        "device_id": "DEV-AARAV-PHONE-01",
        "is_exception_mode": False
    })
    assert res.status_code == 401, f"Expected 401, got: {res.status_code}"
    assert res.json()["detail"] == "Invalid credentials. Please verify your username and password."
    print("[PASS] 2b. Invalid Password Blocked with Generic Message (HTTP 401):", res.json()["detail"])

    # 2c. Student Device Login Test (Testing Phase: Any device permitted)
    res = client.post("/api/login", json={
        "roll_no": "STU01",
        "password": "stu123",
        "device_id": "DEV-UNKNOWN-PHONE-99",
        "is_exception_mode": False
    })
    assert res.status_code == 200, f"Expected 200, got: {res.status_code}"
    assert res.json()["binding_status"] == "DEVICE_VERIFIED"
    print("[PASS] 2c. Any Device Permitted for Testing Phase (HTTP 200):", res.json()["binding_status"])

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
    faculty_token = res.json()["access_token"]
    faculty_headers = {"Authorization": f"Bearer {faculty_token}"}
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
    admin_token = res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("[PASS] 2f. Admin Login OK:", res.json()["user"]["name"])

    # 3. Start Session & Dynamic QR (Faculty auth required)
    res = client.post("/api/sessions/start", json={
        "subject_name": "CS301 Operating Systems",
        "class_lat": 28.5450,
        "class_lng": 77.1926
    }, headers=faculty_headers)
    assert res.status_code == 200
    session_id = res.json()["session"]["session_id"]
    print(f"[PASS] 3a. Lecture Session Started: {session_id}")

    res = client.get(f"/api/sessions/{session_id}/qr", headers=faculty_headers)
    assert res.status_code == 200
    qr_data = res.json()
    qr_token = qr_data["qr_token"]
    print(f"[PASS] 3b. Dynamic QR Token Generated: {qr_token} (Expires in {qr_data['expires_in_seconds']}s)")

    # 3c. Student fetches session public info (live faculty coordinates & geofence radius)
    res_info = client.get(f"/api/sessions/{session_id}/info", headers=student_headers)
    assert res_info.status_code == 200
    assert res_info.json()["geofence_radius_meters"] == 150
    assert res_info.json()["class_lat"] == 28.5450
    print(f"[PASS] 3c. Student Retrieved Live Session Info (Faculty GPS: {res_info.json()['class_lat']}, Radius: {res_info.json()['geofence_radius_meters']}m)")

    # 3d. Faculty dynamically syncs live location
    res_loc = client.post(f"/api/sessions/{session_id}/location", json={
        "class_lat": 28.5450,
        "class_lng": 77.1926,
        "geofence_radius_meters": 150
    }, headers=faculty_headers)
    assert res_loc.status_code == 200
    print("[PASS] 3d. Faculty Updated Live Session Location to (28.5450, 77.1926) with 150m radius")

    # 4. Anti-Proxy Gate Testing (Student auth required)
    test_face_b64 = create_sample_face_b64((200, 150, 150))

    # Gate 3: Missing Student GPS Test
    res_no_gps = client.post("/api/attendance/mark", json={
        "session_id": session_id,
        "qr_token": qr_token,
        "device_id": "DEV-AARAV-PHONE-01",
        "user_lat": None,
        "user_lng": None,
        "live_selfie_base64": test_face_b64,
        "is_exception_mode": False
    }, headers=student_headers)
    assert res_no_gps.status_code == 400
    assert res_no_gps.json()["detail"]["failed_gate"] == "GATE_3_GPS_GEOFENCE"
    print("[PASS] 4a-1. Gate 3 (Missing Student GPS Coordinates) Blocked:", res_no_gps.json()["detail"]["reason"])

    # Gate 3: Geofence Breach Test (>150m)
    res = client.post("/api/attendance/mark", json={
        "session_id": session_id,
        "qr_token": qr_token,
        "device_id": "DEV-AARAV-PHONE-01",
        "user_lat": 28.5600,
        "user_lng": 77.2100,
        "live_selfie_base64": test_face_b64,
        "is_exception_mode": False
    }, headers=student_headers)
    assert res.status_code == 400
    detail = res.json()["detail"]
    assert detail["failed_gate"] == "GATE_3_GPS_GEOFENCE"
    print("[PASS] 4a-2. Gate 3 (GPS Geofence Breach > 150m) Blocked:", detail["reason"])

    # Gate 2: Expired QR Token Test
    expired_token = f"{session_id}.{int(time.time() - 25)}.fake_signature"
    res = client.post("/api/attendance/mark", json={
        "session_id": session_id,
        "qr_token": expired_token,
        "device_id": "DEV-AARAV-PHONE-01",
        "user_lat": 28.5451,
        "user_lng": 77.1927,
        "live_selfie_base64": test_face_b64,
        "is_exception_mode": False
    }, headers=student_headers)
    assert res.status_code == 400
    detail = res.json()["detail"]
    assert detail["failed_gate"] == "GATE_2_DYNAMIC_QR"
    print("[PASS] 4b. Gate 2 (Expired QR Token) Blocked:", detail["reason"])

    # Gate 1: Device Mismatch Test (Relaxed in testing phase)
    # Different device allowed
    # (Gate 1 passed, proceed to valid attendance)
    # Login STU02 to get token for STU02
    res_stu2 = client.post("/api/login", json={
        "roll_no": "STU02",
        "password": "stu123",
        "device_id": "DEV-AARAV-PHONE-01",
        "is_exception_mode": True
    })
    stu2_token = res_stu2.json()["access_token"]
    stu2_headers = {"Authorization": f"Bearer {stu2_token}"}
    client.post("/api/student/enroll-face", json={
        "live_selfie_base64": test_face_b64,
        "consent_given": True
    }, headers=stu2_headers)

    # Successful Attendance Submission for STU01
    fresh_qr = client.get(f"/api/sessions/{session_id}/qr", headers=faculty_headers).json()["qr_token"]
    res = client.post("/api/attendance/mark", json={
        "session_id": session_id,
        "qr_token": fresh_qr,
        "device_id": "DEV-AARAV-PHONE-01",
        "user_lat": 28.5451,
        "user_lng": 77.1927,
        "live_selfie_base64": test_face_b64,
        "is_exception_mode": False
    }, headers=student_headers)
    assert res.status_code == 200, f"Valid attendance failed: {res.text}"
    print("[PASS] 4c. Attendance for STU01 Passed! Status:", res.json()["status"])

    # Duplicate Device in Same Session (Relaxed in testing phase: STU02 also marks attendance on same device)
    fresh_qr = client.get(f"/api/sessions/{session_id}/qr", headers=faculty_headers).json()["qr_token"]
    res = client.post("/api/attendance/mark", json={
        "session_id": session_id,
        "qr_token": fresh_qr,
        "device_id": "DEV-AARAV-PHONE-01",
        "user_lat": 28.5451,
        "user_lng": 77.1927,
        "live_selfie_base64": test_face_b64,
        "is_exception_mode": True
    }, headers=stu2_headers)
    assert res.status_code == 200, f"Multiple attendees on same device should be allowed in testing phase: {res.text}"
    print("[PASS] 4d. Same Device Allowed for Multiple Students in Testing Phase! Status:", res.json()["status"])

    # 5. Teacher Manual Attendance Override Test (Faculty auth required)
    res = client.post("/api/faculty/manual-attendance", json={
        "session_id": session_id,
        "roll_no": "STU03",
        "status": "PRESENT",
        "reason": "Phone Dead / Verified in Classroom by Prof. Turing"
    }, headers=faculty_headers)
    assert res.status_code == 200
    print("[PASS] 5. Faculty Manual Attendance Override OK:", res.json()["message"])

    # 6. Student Dashboard & Bunk Calculator (Student viewing own dashboard)
    res = client.get("/api/student/STU01/dashboard", headers=student_headers)
    assert res.status_code == 200
    print("[PASS] 6a. Student Dashboard (STU01):", res.json()["bunk_calculator"]["message"])

    # 7. Faculty Live Session & Approval (Faculty auth required)
    res = client.get(f"/api/faculty/session/{session_id}/live", headers=faculty_headers)
    assert res.status_code == 200
    fac_data = res.json()
    print(f"[PASS] 7a. Faculty Live Dashboard: Present: {fac_data['counters']['present_count']}, Alerts: {fac_data['counters']['alerts_count']}")

    # 7b. Faculty Ends Session
    res_end = client.post(f"/api/sessions/{session_id}/end", headers=faculty_headers)
    assert res_end.status_code == 200
    assert res_end.json()["session"]["status"] == "ENDED"
    assert res_end.json()["session"]["ended_at"] is not None
    print(f"[PASS] 7b. Faculty Successfully Ended Session (Status: ENDED, Ended At: {res_end.json()['session']['ended_at']})")

    # 7c. Marking attendance on ended session should now be rejected
    res_mark_ended = client.post("/api/attendance/mark", json={
        "session_id": session_id,
        "qr_token": qr_token,
        "device_id": "DEV-AARAV-PHONE-01",
        "user_lat": 19.07601,
        "user_lng": 72.87771,
        "live_selfie_base64": test_face_b64,
        "is_exception_mode": False
    }, headers=student_headers)
    assert res_mark_ended.status_code == 400
    assert res_mark_ended.json()["detail"]["failed_gate"] == "SESSION_NOT_ACTIVE"
    print("[PASS] 7c. Attendance Submission Blocked for Ended Session (GATE: SESSION_NOT_ACTIVE)")

    # 8. Admin Overview & User Management & Device Reset (Admin auth required)
    res = client.get("/api/admin/overview", headers=admin_headers)
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
    }, headers=admin_headers)
    assert res.status_code == 200
    print("[PASS] 8b. Admin Added New Student:", res.json()["message"])

    # Admin resets hardware device lock for STU01
    res = client.post("/api/admin/reset-device/STU01", json={"reason": "Device reset requested"}, headers=admin_headers)
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
    assert res.json()["binding_status"] in ("DEVICE_BOUND_SUCCESSFULLY", "DEVICE_VERIFIED")
    print("[PASS] 8d. STU01 Successfully Bound to New Phone:", res.json()["binding_status"])

    # 9a. Verify Audit Trail Logging
    res = client.get("/api/admin/audit-logs", headers=admin_headers)
    assert res.status_code == 200
    audit_data = res.json()
    assert audit_data["count"] > 0, "Audit logs should not be empty"
    actions = [log["action"] for log in audit_data["audit_logs"]]
    assert "DEVICE_RESET" in actions, "DEVICE_RESET action must be in audit log"
    assert "USER_CREATED" in actions, "USER_CREATED action must be in audit log"
    assert "MANUAL_ATTENDANCE_OVERRIDE" in actions, "MANUAL_ATTENDANCE_OVERRIDE must be in audit log"
    print(f"[PASS] 9a. Audit Trail Verified: {audit_data['count']} events logged with actor, target & mandatory reasons.")

    # 9b. Verify Subject Catalog
    res = client.get("/api/subjects", headers=student_headers)
    assert res.status_code == 200
    subjects = res.json()["subjects"]
    assert len(subjects) >= 4, "Should have seeded subjects"
    print(f"[PASS] 9b. Subjects Catalog Verified: {len(subjects)} subjects listed.")

    # 9c. Admin Creates Subject
    res = client.post("/api/admin/subjects", json={
        "code": "CS309",
        "name": "Cloud Native Architecture",
        "department": "Computer Science & Engineering",
        "semester": 6,
        "credits": 4,
        "faculty_id": "FAC01",
        "faculty_name": "Prof. Alan Turing",
        "min_attendance_pct": 75.0
    }, headers=admin_headers)
    assert res.status_code == 200
    print("[PASS] 9c. Admin Created Subject:", res.json()["message"])

    # 9d. Per-Subject Attendance Breakdown for Student
    res = client.get("/api/student/STU01/subjects", headers=student_headers)
    assert res.status_code == 200
    stu_subjects = res.json()["subjects"]
    assert len(stu_subjects) > 0
    first_subj = stu_subjects[0]
    assert "bunk_calculator" in first_subj
    print(f"[PASS] 9d. Per-Subject Breakdown (STU01): {first_subj['subject_code']} - {first_subj['current_pct']}% attendance ({first_subj['bunk_calculator']['message']})")

    # 9e. Admin Resets Biometric Face Reference
    res = client.post("/api/admin/reset-face/STU01", json={
        "reason": "Student requested re-enrollment with updated spectacles"
    }, headers=admin_headers)
    assert res.status_code == 200
    print("[PASS] 9e. Admin Face Reset OK:", res.json()["message"])

    print("\n" + "=" * 60)
    print(" ALL RBAC, AUDIT LOGS, SUBJECTS & ANTI-PROXY TESTS PASSED 100% ")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
