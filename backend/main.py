import os
import io
import time
import math
import hmac
import hashlib
import secrets
import base64
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import numpy as np
import pandas as pd
import joblib
from PIL import Image
import cv2

from database import (
    get_users_collection,
    get_lecture_sessions_collection,
    get_attendance_logs_collection,
    get_security_alerts_collection,
    init_db_indexes,
    is_mock_db
)
from seed_data import run_seed

app = FastAPI(
    title="SmartAttend-AI API",
    description="Anti-Proxy & AI-Driven Smart Attendance System Backend with RBAC (Admin, Faculty, Student)",
    version="1.1.0"
)

# Full CORS enabled for React + Vite Frontend / PWA
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load ML Risk Model
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "attendance_risk_model.pkl")
ML_MODEL_PAYLOAD = None

def load_ml_model():
    global ML_MODEL_PAYLOAD
    if os.path.exists(MODEL_PATH):
        try:
            ML_MODEL_PAYLOAD = joblib.load(MODEL_PATH)
            print(f"[Main] ML Risk Model successfully loaded from {MODEL_PATH}")
        except Exception as e:
            print(f"[Main Warning] Failed loading ML model: {e}")

load_ml_model()

@app.on_event("startup")
def startup_db_init():
    """Ensure database indexes are registered and seed users if database is empty."""
    init_db_indexes()
    users_col = get_users_collection()
    if users_col.count_documents({}) == 0:
        print("[Main Startup] Users collection is empty. Executing initial seed...")
        try:
            run_seed()
        except Exception as e:
            print(f"[Main Startup Warning] Seeding failed: {e}")

# ==============================================================================
# Helper Utilities (Haversine, Dynamic QR, Face Matching, Bunk Calculator)
# ==============================================================================

def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

def generate_qr_signature(session_id: str, timestamp: int, secret_seed: str) -> str:
    message = f"{session_id}:{timestamp}".encode("utf-8")
    return hmac.new(secret_seed.encode("utf-8"), message, hashlib.sha256).hexdigest()[:16]

def decode_image_base64_to_cv2(b64_str: str) -> Optional[np.ndarray]:
    try:
        if "," in b64_str:
            b64_str = b64_str.split(",", 1)[1]
        image_data = base64.b64decode(b64_str)
        pil_img = Image.open(io.BytesIO(image_data)).convert("RGB")
        cv2_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        return cv2_img
    except Exception as e:
        print(f"[Image Decode Error]: {e}")
        return None

def compute_face_similarity_score(img1: np.ndarray, img2: np.ndarray) -> float:
    try:
        resized1 = cv2.resize(img1, (128, 128))
        resized2 = cv2.resize(img2, (128, 128))

        hsv1 = cv2.cvtColor(resized1, cv2.COLOR_BGR2HSV)
        hsv2 = cv2.cvtColor(resized2, cv2.COLOR_BGR2HSV)

        hist1 = cv2.calcHist([hsv1], [0, 1], None, [50, 60], [0, 180, 0, 256])
        hist2 = cv2.calcHist([hsv2], [0, 1], None, [50, 60], [0, 180, 0, 256])

        cv2.normalize(hist1, hist1, alpha=0, beta=1, norm_type=cv2.NORM_MINMAX)
        cv2.normalize(hist2, hist2, alpha=0, beta=1, norm_type=cv2.NORM_MINMAX)

        correlation = cv2.compareHist(hist1, hist2, cv2.HISTCMP_CORREL)

        gray1 = cv2.cvtColor(resized1, cv2.COLOR_BGR2GRAY)
        gray2 = cv2.cvtColor(resized2, cv2.COLOR_BGR2GRAY)
        norm_diff = 1.0 - (np.mean(np.abs(gray1.astype(float) - gray2.astype(float))) / 255.0)

        combined = (max(0.0, correlation) * 0.70) + (max(0.0, norm_diff) * 0.30)
        score_pct = round(float(combined * 100.0), 1)
        return min(100.0, max(0.0, score_pct))
    except Exception as e:
        print(f"[Face Comparison Error]: {e}")
        return 0.0

def calculate_bunk_metrics(attended: int, total: int) -> Dict[str, Any]:
    if total <= 0:
        return {
            "current_pct": 100.0,
            "status": "SAFE",
            "safe_skips": 0,
            "classes_needed": 0,
            "message": "No classes recorded yet."
        }

    pct = round((attended / total) * 100.0, 1)
    if pct >= 75.0:
        safe_skips = int(math.floor((attended - 0.75 * total) / 0.75))
        safe_skips = max(0, safe_skips)
        return {
            "current_pct": pct,
            "status": "SAFE",
            "safe_skips": safe_skips,
            "classes_needed": 0,
            "message": f"You can safely skip {safe_skips} class{'es' if safe_skips != 1 else ''} and still stay above 75%."
        }
    else:
        needed = int(math.ceil((0.75 * total - attended) / 0.25))
        needed = max(1, needed)
        return {
            "current_pct": pct,
            "status": "DEFICIT",
            "safe_skips": 0,
            "classes_needed": needed,
            "message": f"You must attend {needed} consecutive class{'es' if needed != 1 else ''} to recover to 75% attendance."
        }

def evaluate_student_risk(stats: Dict[str, Any]) -> Dict[str, Any]:
    """Helper to run ML risk prediction for a student stats dict."""
    current_att = stats.get("current_attendance_pct", 75.0)
    streak = stats.get("current_streak", 0)
    last_14 = stats.get("last_14_days_pct", current_att)
    mon_fri = stats.get("mon_fri_skip_rate", 0.20)
    first_lec = stats.get("first_lecture_miss_rate", 0.15)

    if ML_MODEL_PAYLOAD and "model" in ML_MODEL_PAYLOAD:
        model = ML_MODEL_PAYLOAD["model"]
        input_df = pd.DataFrame([{
            "current_attendance_pct": current_att,
            "last_14_days_pct": last_14,
            "mon_fri_skip_rate": mon_fri,
            "first_lecture_miss_rate": first_lec,
            "current_streak": streak
        }])
        pred = int(model.predict(input_df)[0])
        defaulter_prob = float(model.predict_proba(input_df)[0][1])

        if defaulter_prob >= 0.70:
            risk_level = "CRITICAL"
        elif defaulter_prob >= 0.40:
            risk_level = "WARNING"
        else:
            risk_level = "NORMAL"
    else:
        if current_att < 75.0:
            risk_level = "CRITICAL"
            defaulter_prob = 0.85
            pred = 1
        elif current_att < 80.0:
            risk_level = "WARNING"
            defaulter_prob = 0.45
            pred = 0
        else:
            risk_level = "NORMAL"
            defaulter_prob = 0.10
            pred = 0

    return {
        "will_be_defaulter": pred,
        "defaulter_probability": round(defaulter_prob, 4),
        "defaulter_risk_pct": round(defaulter_prob * 100.0, 1),
        "risk_level": risk_level
    }

# ==============================================================================
# Pydantic Schemas
# ==============================================================================

class LoginRequest(BaseModel):
    roll_no: str = Field(..., description="Student Roll No (STU01), Faculty ID (FAC01), or Admin ID (ADM01)")
    password: str = Field(..., description="Password (stu123, fac123, admin123)")
    device_id: str = Field("DEFAULT-DEV-ID", description="Unique hardware/browser device fingerprint")
    is_exception_mode: bool = Field(False, description="Whether logging in from an alternate/temporary device")

class SessionStartRequest(BaseModel):
    subject_name: str = Field(..., example="CS301 - Operating Systems")
    faculty_id: str = Field("FAC01", example="FAC01")
    class_lat: float = Field(..., example=19.0760)
    class_lng: float = Field(..., example=72.8777)
    secret_seed: Optional[str] = Field(None, description="Cryptographic secret seed for dynamic QR tokens")

class MarkAttendanceRequest(BaseModel):
    roll_no: str = Field(..., example="STU01")
    session_id: str = Field(..., example="CS301-SEC-A")
    qr_token: str = Field(..., example="CS301-SEC-A.1713400000.a1b2c3d4e5f6")
    device_id: str = Field(..., example="DEV-AARAV-PHONE-01")
    user_lat: float = Field(..., example=19.07602)
    user_lng: float = Field(..., example=72.87768)
    live_selfie_base64: str = Field(..., description="Base64 encoded live camera capture")
    is_exception_mode: bool = Field(False, description="Flag for temporary phone/exception attendance")

class FacultyApproveRequest(BaseModel):
    session_id: str
    roll_no: str
    action: str = Field(..., example="APPROVE", description="'APPROVE' or 'REJECT'")
    remarks: Optional[str] = None

class ManualAttendanceRequest(BaseModel):
    session_id: str = Field(..., example="CS301-SEC-A")
    roll_no: str = Field(..., example="STU01")
    status: str = Field(..., example="PRESENT", description="'PRESENT' or 'ABSENT'")
    faculty_id: str = Field("FAC01", example="FAC01")
    reason: str = Field("Phone Dead / Manual Override by Faculty", example="Phone Dead / Battery Drained")

class CreateUserRequest(BaseModel):
    role: str = Field(..., example="student", description="'student', 'faculty', or 'admin'")
    roll_no: str = Field(..., example="STU04", description="Roll No for student, Faculty ID for faculty, Admin ID for admin")
    name: str = Field(..., example="Neha Gupta")
    email: str = Field(..., example="neha@smartattend.edu")
    password: str = Field(..., example="stu123")
    department: str = Field("Computer Science & Engineering")
    semester: Optional[int] = Field(6, description="Applicable for students")
    initial_attendance_pct: Optional[float] = Field(80.0, description="Initial attendance percentage")

# ==============================================================================
# API Endpoints
# ==============================================================================

@app.get("/")
def root():
    return {
        "system": "SmartAttend-AI Backend",
        "status": "ONLINE",
        "version": "1.1.0",
        "mock_db": is_mock_db(),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# ------------------------------------------------------------------------------
# 1. POST /api/login (Role-Based Access: Student, Faculty, Admin)
# ------------------------------------------------------------------------------
@app.post("/api/login")
def login(req: LoginRequest):
    users_col = get_users_collection()
    user = users_col.find_one({"$or": [
        {"roll_no": req.roll_no},
        {"faculty_id": req.roll_no},
        {"admin_id": req.roll_no},
        {"email": req.roll_no}
    ]})

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with identifier '{req.roll_no}' not found."
        )

    # Password Verification
    stored_password = user.get("password")
    if stored_password and stored_password != req.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Please verify your username and password."
        )

    role = user.get("role", "student")

    # 1. Admin Login
    if role == "admin":
        return {
            "success": True,
            "message": "Admin authentication successful",
            "role": "admin",
            "user": {
                "id": str(user.get("_id", "")),
                "admin_id": user.get("admin_id", req.roll_no),
                "name": user.get("name"),
                "email": user.get("email"),
                "role": "admin",
                "department": user.get("department", "Administration")
            }
        }

    # 2. Faculty Login
    if role == "faculty":
        return {
            "success": True,
            "message": "Faculty authentication successful",
            "role": "faculty",
            "user": {
                "id": str(user.get("_id", "")),
                "faculty_id": user.get("faculty_id", req.roll_no),
                "name": user.get("name"),
                "email": user.get("email"),
                "role": "faculty",
                "department": user.get("department", "CSE"),
                "courses_taught": user.get("courses_taught", ["CS301 - Operating Systems"])
            }
        }

    # 3. Student Login (Enforce single-phone hardware lock)
    bound_device = user.get("bound_device_id") or user.get("registered_device_id")

    if not bound_device:
        users_col.update_one(
            {"_id": user["_id"]},
            {"$set": {"bound_device_id": req.device_id, "registered_device_id": req.device_id}}
        )
        bound_device = req.device_id
        binding_status = "DEVICE_BOUND_SUCCESSFULLY"
    elif bound_device != req.device_id:
        if not req.is_exception_mode:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account bound to another device. Please use your registered phone or request Faculty Exception Mode."
            )
        else:
            binding_status = "LOGGED_IN_UNDER_EXCEPTION_MODE"
    else:
        binding_status = "DEVICE_VERIFIED"

    return {
        "success": True,
        "message": "Student login successful",
        "role": "student",
        "binding_status": binding_status,
        "is_exception_mode": req.is_exception_mode,
        "user": {
            "id": str(user.get("_id", "")),
            "roll_no": user.get("roll_no"),
            "name": user.get("name"),
            "email": user.get("email"),
            "role": "student",
            "department": user.get("department", "CSE"),
            "semester": user.get("semester", 6),
            "bound_device_id": bound_device,
            "has_registered_face": bool(user.get("registered_face_base64"))
        }
    }

# ------------------------------------------------------------------------------
# 2. POST /api/sessions/start & GET /api/sessions/{session_id}/qr
# ------------------------------------------------------------------------------
@app.post("/api/sessions/start")
def start_session(req: SessionStartRequest):
    sessions_col = get_lecture_sessions_collection()

    session_id = f"{req.subject_name.split()[0]}-{datetime.now().strftime('%m%d%H%M')}"
    secret_seed = req.secret_seed or secrets.token_hex(16)

    session_doc = {
        "session_id": session_id,
        "session_code": session_id,
        "subject_name": req.subject_name,
        "faculty_id": req.faculty_id,
        "class_lat": req.class_lat,
        "class_lng": req.class_lng,
        "secret_seed": secret_seed,
        "geofence_radius_meters": 60,
        "status": "ACTIVE",
        "started_at": datetime.now(timezone.utc),
        "created_at": datetime.now(timezone.utc)
    }

    sessions_col.update_one(
        {"session_id": session_id},
        {"$set": session_doc},
        upsert=True
    )

    return {
        "success": True,
        "message": f"Active lecture session created for {req.subject_name}",
        "session": {
            "session_id": session_id,
            "subject_name": req.subject_name,
            "faculty_id": req.faculty_id,
            "class_lat": req.class_lat,
            "class_lng": req.class_lng,
            "status": "ACTIVE",
            "geofence_radius_meters": 60
        }
    }

@app.get("/api/sessions/{session_id}/qr")
def get_session_qr(session_id: str):
    sessions_col = get_lecture_sessions_collection()
    session = sessions_col.find_one({"$or": [{"session_id": session_id}, {"session_code": session_id}]})

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lecture session '{session_id}' not found."
        )

    if session.get("status") != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Lecture session is currently {session.get('status')}. Attendance is closed."
        )

    secret_seed = session.get("secret_seed", "default_smartattend_seed_2026")
    current_time = int(time.time())
    remaining_seconds = 5 - (current_time % 5)

    signature = generate_qr_signature(session_id, current_time, secret_seed)
    token = f"{session_id}.{current_time}.{signature}"

    return {
        "session_id": session_id,
        "subject_name": session.get("subject_name"),
        "qr_token": token,
        "timestamp": current_time,
        "expires_in_seconds": remaining_seconds,
        "refresh_interval_seconds": 5,
        "class_lat": session.get("class_lat"),
        "class_lng": session.get("class_lng")
    }

# ------------------------------------------------------------------------------
# 3. POST /api/attendance/mark (The 5-Gate Anti-Proxy Engine)
# ------------------------------------------------------------------------------
@app.post("/api/attendance/mark")
def mark_attendance(req: MarkAttendanceRequest):
    users_col = get_users_collection()
    sessions_col = get_lecture_sessions_collection()
    attendance_col = get_attendance_logs_collection()
    alerts_col = get_security_alerts_collection()

    timestamp_now = datetime.now(timezone.utc)

    def log_fraud_and_fail(gate: str, reason: str, extra_meta: Optional[Dict] = None):
        alert_doc = {
            "session_id": req.session_id,
            "roll_no": req.roll_no,
            "used_device_id": req.device_id,
            "failed_gate": gate,
            "reason": reason,
            "user_lat": req.user_lat,
            "user_lng": req.user_lng,
            "is_exception_mode": req.is_exception_mode,
            "timestamp": timestamp_now,
            "resolved": False
        }
        if extra_meta:
            alert_doc.update(extra_meta)
        alerts_col.insert_one(alert_doc)

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "failed_gate": gate,
                "reason": reason,
                "timestamp": timestamp_now.isoformat()
            }
        )

    student = users_col.find_one({"roll_no": req.roll_no})
    if not student:
        raise HTTPException(status_code=404, detail=f"Student with roll number '{req.roll_no}' not found.")

    session = sessions_col.find_one({"$or": [{"session_id": req.session_id}, {"session_code": req.session_id}]})
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{req.session_id}' not found.")

    existing_student_log = attendance_col.find_one({"session_id": req.session_id, "roll_no": req.roll_no})
    if existing_student_log:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "failed_gate": "DUPLICATE_SUBMISSION",
                "reason": "Attendance has already been recorded for this student in this lecture session.",
                "marked_at": existing_student_log.get("marked_at")
            }
        )

    # GATE 1: Device Lock (Hardware Fingerprint Verification & Anti-Proxy 1-Phone Rule)
    bound_device = student.get("bound_device_id") or student.get("registered_device_id")

    device_already_used = attendance_col.find_one({"session_id": req.session_id, "used_device_id": req.device_id})
    if device_already_used:
        log_fraud_and_fail(
            gate="GATE_1_DEVICE_LOCK",
            reason=f"Proxy Alert: Device '{req.device_id}' was already used by roll number '{device_already_used.get('roll_no')}' in this session. One phone cannot mark attendance for multiple students."
        )

    if not req.is_exception_mode:
        if bound_device and bound_device != req.device_id:
            log_fraud_and_fail(
                gate="GATE_1_DEVICE_LOCK",
                reason=f"Device Mismatch: Student '{req.roll_no}' is bound to device '{bound_device}', but request originated from '{req.device_id}'."
            )

    # GATE 2: Dynamic QR Time Check (<= 7 Seconds Expiry Window)
    try:
        parts = req.qr_token.split(".")
        if len(parts) != 3:
            log_fraud_and_fail(gate="GATE_2_DYNAMIC_QR", reason="Malformed QR token structure.")
        tok_session_id, tok_time_str, tok_sig = parts
        tok_timestamp = int(tok_time_str)
    except Exception:
        log_fraud_and_fail(gate="GATE_2_DYNAMIC_QR", reason="Failed to parse QR token timestamp.")

    current_epoch = int(time.time())
    age_seconds = abs(current_epoch - tok_timestamp)
    if age_seconds > 7:
        log_fraud_and_fail(
            gate="GATE_2_DYNAMIC_QR",
            reason=f"Dynamic QR Token expired ({age_seconds} seconds old, max allowed is 7 seconds). Scan the freshly refreshed QR code on the projector."
        )

    secret_seed = session.get("secret_seed", "default_smartattend_seed_2026")
    expected_sig = generate_qr_signature(tok_session_id, tok_timestamp, secret_seed)
    if not hmac.compare_digest(expected_sig, tok_sig):
        log_fraud_and_fail(
            gate="GATE_2_DYNAMIC_QR",
            reason="Invalid QR signature. Token does not match this lecture session's cryptographic seed."
        )

    # GATE 3: GPS Geofence (Haversine Distance <= 60 Meters)
    class_lat = session.get("class_lat") or 19.0760
    class_lng = session.get("class_lng") or 72.8777

    distance_meters = haversine_distance_meters(class_lat, class_lng, req.user_lat, req.user_lng)
    max_radius = session.get("geofence_radius_meters", 60)

    if distance_meters > max_radius:
        log_fraud_and_fail(
            gate="GATE_3_GPS_GEOFENCE",
            reason=f"Geofence Breach: You are {distance_meters:.1f} meters away from the classroom. You must be inside the lecture hall (within {max_radius} meters).",
            extra_meta={"distance_meters": round(distance_meters, 1)}
        )

    # GATE 4: AI Face Verification
    live_img = decode_image_base64_to_cv2(req.live_selfie_base64)
    if live_img is None:
        log_fraud_and_fail(gate="GATE_4_FACE_VERIFICATION", reason="Unable to decode live selfie image data.")

    registered_face_b64 = student.get("registered_face_base64")
    if not registered_face_b64:
        users_col.update_one(
            {"_id": student["_id"]},
            {"$set": {"registered_face_base64": req.live_selfie_base64}}
        )
        face_match_score = 100.0
        face_status = "FIRST_TIME_AUTO_REGISTERED"
    else:
        ref_img = decode_image_base64_to_cv2(registered_face_b64)
        if ref_img is None:
            face_match_score = 90.0
            face_status = "REFERENCE_FALLBACK"
        else:
            face_match_score = compute_face_similarity_score(live_img, ref_img)
            if face_match_score < 55.0:
                log_fraud_and_fail(
                    gate="GATE_4_FACE_VERIFICATION",
                    reason=f"Face mismatch: Live selfie similarity was {face_match_score}%, which is below the 55% verification threshold.",
                    extra_meta={"face_match_score": face_match_score}
                )
            face_status = "VERIFIED"

    # GATE 5: Decision & Attendance Logging
    attendance_status = "PENDING_APPROVAL" if req.is_exception_mode else "PRESENT"

    attendance_record = {
        "session_id": req.session_id,
        "roll_no": req.roll_no,
        "student_name": student.get("name", "Student"),
        "used_device_id": req.device_id,
        "user_lat": req.user_lat,
        "user_lng": req.user_lng,
        "distance_meters": round(distance_meters, 1),
        "face_match_score": face_match_score,
        "face_status": face_status,
        "is_exception_mode": req.is_exception_mode,
        "live_selfie_base64": req.live_selfie_base64,
        "status": attendance_status,
        "marked_at": timestamp_now
    }

    attendance_col.insert_one(attendance_record)

    # Update historical student streak and attended stats if PRESENT
    if attendance_status == "PRESENT":
        stats = student.get("attendance_stats", {})
        total_lec = stats.get("total_lectures", 40) + 1
        att_lec = stats.get("attended_lectures", 30) + 1
        new_streak = max(1, stats.get("current_streak", 0) + 1)
        new_pct = round((att_lec / total_lec) * 100.0, 1)

        users_col.update_one(
            {"roll_no": req.roll_no},
            {
                "$set": {
                    "attendance_stats.total_lectures": total_lec,
                    "attendance_stats.attended_lectures": att_lec,
                    "attendance_stats.current_attendance_pct": new_pct,
                    "attendance_stats.current_streak": new_streak,
                    "updated_at": timestamp_now
                }
            }
        )

    return {
        "success": True,
        "status": attendance_status,
        "message": "Attendance successfully recorded as PRESENT!" if attendance_status == "PRESENT" else "Attendance recorded under Exception Mode. Awaiting Faculty Approval.",
        "details": {
            "roll_no": req.roll_no,
            "session_id": req.session_id,
            "distance_meters": round(distance_meters, 1),
            "face_match_score": face_match_score,
            "is_exception_mode": req.is_exception_mode,
            "marked_at": timestamp_now.isoformat()
        }
    }

# ------------------------------------------------------------------------------
# 4. POST /api/faculty/manual-attendance (Teacher Manual Attendance Override)
# ------------------------------------------------------------------------------
@app.post("/api/faculty/manual-attendance")
def faculty_manual_attendance(req: ManualAttendanceRequest):
    users_col = get_users_collection()
    sessions_col = get_lecture_sessions_collection()
    attendance_col = get_attendance_logs_collection()

    student = users_col.find_one({"roll_no": req.roll_no})
    if not student:
        raise HTTPException(status_code=404, detail=f"Student '{req.roll_no}' not found.")

    session = sessions_col.find_one({"$or": [{"session_id": req.session_id}, {"session_code": req.session_id}]})
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{req.session_id}' not found.")

    action_status = req.status.upper()
    if action_status not in ["PRESENT", "ABSENT"]:
        raise HTTPException(status_code=400, detail="Status must be either 'PRESENT' or 'ABSENT'")

    timestamp_now = datetime.now(timezone.utc)

    # Upsert manual record in attendance_logs
    manual_record = {
        "session_id": req.session_id,
        "roll_no": req.roll_no,
        "student_name": student.get("name", "Student"),
        "used_device_id": "MANUAL-OVERRIDE",
        "distance_meters": 0.0,
        "face_match_score": 100.0,
        "is_exception_mode": False,
        "is_manual_override": True,
        "manual_by": req.faculty_id,
        "reason": req.reason,
        "status": action_status,
        "marked_at": timestamp_now
    }

    attendance_col.update_one(
        {"session_id": req.session_id, "roll_no": req.roll_no},
        {"$set": manual_record},
        upsert=True
    )

    # Update student's cumulative statistics
    stats = student.get("attendance_stats", {})
    total_lec = stats.get("total_lectures", 40) + 1
    current_attended = stats.get("attended_lectures", 30)
    current_streak = stats.get("current_streak", 0)

    if action_status == "PRESENT":
        new_attended = current_attended + 1
        new_streak = max(1, current_streak + 1)
    else:
        new_attended = current_attended
        new_streak = min(-1, current_streak - 1 if current_streak < 0 else -1)

    new_pct = round((new_attended / total_lec) * 100.0, 1)

    users_col.update_one(
        {"roll_no": req.roll_no},
        {
            "$set": {
                "attendance_stats.total_lectures": total_lec,
                "attendance_stats.attended_lectures": new_attended,
                "attendance_stats.current_attendance_pct": new_pct,
                "attendance_stats.current_streak": new_streak,
                "updated_at": timestamp_now
            }
        }
    )

    return {
        "success": True,
        "message": f"Student '{req.roll_no}' manually marked {action_status} by faculty.",
        "details": {
            "session_id": req.session_id,
            "roll_no": req.roll_no,
            "status": action_status,
            "reason": req.reason,
            "updated_pct": new_pct,
            "updated_streak": new_streak,
            "marked_at": timestamp_now.isoformat()
        }
    }

# ------------------------------------------------------------------------------
# 5. GET /api/student/{roll_no}/dashboard
# ------------------------------------------------------------------------------
@app.get("/api/student/{roll_no}/dashboard")
def student_dashboard(roll_no: str):
    users_col = get_users_collection()
    attendance_col = get_attendance_logs_collection()

    student = users_col.find_one({"roll_no": roll_no})
    if not student:
        raise HTTPException(status_code=404, detail=f"Student '{roll_no}' not found.")

    stats = student.get("attendance_stats", {
        "current_attendance_pct": 75.0,
        "last_14_days_pct": 75.0,
        "mon_fri_skip_rate": 0.20,
        "first_lecture_miss_rate": 0.15,
        "current_streak": 2,
        "total_lectures": 40,
        "attended_lectures": 30
    })

    current_att = stats.get("current_attendance_pct", 75.0)
    attended_lec = stats.get("attended_lectures", int(current_att * 0.4))
    total_lec = stats.get("total_lectures", 40)
    streak = stats.get("current_streak", 0)

    # What-If Bunk Calculator
    bunk_calc = calculate_bunk_metrics(attended_lec, total_lec)

    # ML Defaulter Risk Prediction
    risk_info = evaluate_student_risk(stats)

    # Human-readable insights
    insights = []
    if stats.get("mon_fri_skip_rate", 0) >= 0.40:
        insights.append(f"Elevated weekend-extension skipping: {int(stats['mon_fri_skip_rate']*100)}% of Mon/Fri lectures missed.")
    if stats.get("first_lecture_miss_rate", 0) >= 0.35:
        insights.append(f"Morning lecture absenteeism detected: {int(stats['first_lecture_miss_rate']*100)}% of 8 AM slots missed.")
    if stats.get("last_14_days_pct", 100) < current_att - 5:
        insights.append(f"Negative momentum: Recent 14-day attendance ({stats['last_14_days_pct']}%) is falling below your semester average.")
    if streak >= 5:
        insights.append(f"Great consistency! You are currently on an active streak of {streak} consecutive attended lectures.")
    elif streak < 0:
        insights.append(f"Immediate action needed: You have missed {abs(streak)} consecutive lectures.")

    if not insights:
        insights.append("Your attendance patterns are consistent and within safe university benchmarks.")

    risk_info["insights"] = insights

    # Subject-wise breakdown
    subject_breakdown = [
        {"subject": "CS301 - Operating Systems", "attended": int(attended_lec * 0.35), "total": int(total_lec * 0.35), "pct": current_att},
        {"subject": "CS402 - Machine Learning", "attended": int(attended_lec * 0.30), "total": int(total_lec * 0.30), "pct": min(100.0, current_att + 2.0)},
        {"subject": "CS305 - Database Systems", "attended": int(attended_lec * 0.35), "total": int(total_lec * 0.35), "pct": max(40.0, current_att - 3.0)}
    ]
    for s in subject_breakdown:
        if s["total"] > 0:
            s["pct"] = round((s["attended"] / s["total"]) * 100.0, 1)

    recent_logs = list(attendance_col.find(
        {"roll_no": roll_no},
        {"live_selfie_base64": 0}
    ).sort("marked_at", -1).limit(10))

    for log in recent_logs:
        log["_id"] = str(log["_id"])
        if isinstance(log.get("marked_at"), datetime):
            log["marked_at"] = log["marked_at"].isoformat()

    return {
        "student": {
            "roll_no": student.get("roll_no"),
            "name": student.get("name"),
            "department": student.get("department", "CSE"),
            "semester": student.get("semester", 6),
            "bound_device_id": student.get("bound_device_id") or student.get("registered_device_id")
        },
        "attendance": {
            "current_pct": current_att,
            "attended_lectures": attended_lec,
            "total_lectures": total_lec,
            "active_streak": streak,
            "threshold_pct": 75.0
        },
        "bunk_calculator": bunk_calc,
        "ai_risk_prediction": risk_info,
        "subject_breakdown": subject_breakdown,
        "recent_logs": recent_logs
    }

# ------------------------------------------------------------------------------
# 6. GET /api/faculty/session/{session_id}/live & POST /api/faculty/approve
# ------------------------------------------------------------------------------
@app.get("/api/faculty/session/{session_id}/live")
def get_faculty_live_session(session_id: str):
    sessions_col = get_lecture_sessions_collection()
    attendance_col = get_attendance_logs_collection()
    alerts_col = get_security_alerts_collection()

    session = sessions_col.find_one({"$or": [{"session_id": session_id}, {"session_code": session_id}]})
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")

    logs = list(attendance_col.find({"session_id": session_id}).sort("marked_at", -1))

    present_students = []
    pending_approvals = []

    for log in logs:
        log["_id"] = str(log["_id"])
        if isinstance(log.get("marked_at"), datetime):
            log["marked_at"] = log["marked_at"].isoformat()

        if log.get("status") == "PRESENT":
            present_students.append({
                "roll_no": log.get("roll_no"),
                "student_name": log.get("student_name"),
                "marked_at": log.get("marked_at"),
                "distance_meters": log.get("distance_meters"),
                "face_match_score": log.get("face_match_score"),
                "device_id": log.get("used_device_id"),
                "is_manual_override": log.get("is_manual_override", False),
                "reason": log.get("reason")
            })
        elif log.get("status") == "PENDING_APPROVAL":
            pending_approvals.append({
                "roll_no": log.get("roll_no"),
                "student_name": log.get("student_name"),
                "marked_at": log.get("marked_at"),
                "device_id": log.get("used_device_id"),
                "distance_meters": log.get("distance_meters"),
                "face_match_score": log.get("face_match_score"),
                "live_selfie_base64": log.get("live_selfie_base64")
            })

    alerts = list(alerts_col.find({"session_id": session_id}).sort("timestamp", -1))
    formatted_alerts = []
    for a in alerts:
        a["_id"] = str(a["_id"])
        if isinstance(a.get("timestamp"), datetime):
            a["timestamp"] = a["timestamp"].isoformat()
        formatted_alerts.append({
            "id": a["_id"],
            "failed_gate": a.get("failed_gate"),
            "reason": a.get("reason"),
            "roll_no": a.get("roll_no"),
            "device_id": a.get("used_device_id"),
            "timestamp": a.get("timestamp"),
            "resolved": a.get("resolved", False)
        })

    return {
        "session": {
            "session_id": session.get("session_id"),
            "subject_name": session.get("subject_name"),
            "status": session.get("status"),
            "class_lat": session.get("class_lat"),
            "class_lng": session.get("class_lng")
        },
        "counters": {
            "present_count": len(present_students),
            "pending_count": len(pending_approvals),
            "alerts_count": len(formatted_alerts)
        },
        "present_students": present_students,
        "pending_approvals": pending_approvals,
        "security_alerts": formatted_alerts
    }

@app.post("/api/faculty/approve")
def approve_exception(req: FacultyApproveRequest):
    attendance_col = get_attendance_logs_collection()
    users_col = get_users_collection()

    action = req.action.upper()
    if action not in ["APPROVE", "REJECT"]:
        raise HTTPException(status_code=400, detail="Action must be either 'APPROVE' or 'REJECT'")

    new_status = "PRESENT" if action == "APPROVE" else "REJECTED"

    record = attendance_col.find_one({"session_id": req.session_id, "roll_no": req.roll_no})
    if not record:
        raise HTTPException(
            status_code=404,
            detail=f"Attendance record for roll number '{req.roll_no}' in session '{req.session_id}' not found."
        )

    attendance_col.update_one(
        {"_id": record["_id"]},
        {
            "$set": {
                "status": new_status,
                "reviewed_at": datetime.now(timezone.utc),
                "remarks": req.remarks or f"Faculty {action.lower()}d exception."
            }
        }
    )

    if new_status == "PRESENT":
        student = users_col.find_one({"roll_no": req.roll_no})
        if student:
            stats = student.get("attendance_stats", {})
            total_lec = stats.get("total_lectures", 40) + 1
            att_lec = stats.get("attended_lectures", 30) + 1
            new_pct = round((att_lec / total_lec) * 100.0, 1)
            new_streak = max(1, stats.get("current_streak", 0) + 1)
            users_col.update_one(
                {"roll_no": req.roll_no},
                {
                    "$set": {
                        "attendance_stats.total_lectures": total_lec,
                        "attendance_stats.attended_lectures": att_lec,
                        "attendance_stats.current_attendance_pct": new_pct,
                        "attendance_stats.current_streak": new_streak
                    }
                }
            )

    return {
        "success": True,
        "session_id": req.session_id,
        "roll_no": req.roll_no,
        "action": action,
        "status": new_status,
        "message": f"Student {req.roll_no} exception attendance has been {new_status}."
    }

# ------------------------------------------------------------------------------
# 7. ADMIN ENDPOINTS: Overview, User Management, Device Reset
# ------------------------------------------------------------------------------
@app.get("/api/admin/overview")
def admin_overview():
    users_col = get_users_collection()
    sessions_col = get_lecture_sessions_collection()
    alerts_col = get_security_alerts_collection()

    # User counts
    students = list(users_col.find({"role": "student"}))
    faculty_list = list(users_col.find({"role": "faculty"}))
    admins = list(users_col.find({"role": "admin"}))

    total_students = len(students)
    total_faculty = len(faculty_list)
    total_admins = len(admins)

    # Calculate system average attendance
    att_percentages = [
        s.get("attendance_stats", {}).get("current_attendance_pct", 75.0)
        for s in students
    ]
    sys_avg_attendance = round(float(np.mean(att_percentages)), 1) if att_percentages else 0.0

    # ML Defaulter Risk Evaluation across all students
    high_risk_defaulters = []
    for s in students:
        stats = s.get("attendance_stats", {})
        risk = evaluate_student_risk(stats)
        if risk["will_be_defaulter"] == 1 or risk["risk_level"] in ["CRITICAL", "WARNING"]:
            high_risk_defaulters.append({
                "roll_no": s.get("roll_no"),
                "name": s.get("name"),
                "email": s.get("email"),
                "department": s.get("department", "CSE"),
                "attendance_pct": stats.get("current_attendance_pct", 0.0),
                "defaulter_probability": risk["defaulter_probability"],
                "risk_pct": risk["defaulter_risk_pct"],
                "risk_level": risk["risk_level"],
                "current_streak": stats.get("current_streak", 0)
            })

    # Sort defaulters by risk probability descending
    high_risk_defaulters.sort(key=lambda x: x["defaulter_probability"], reverse=True)

    # Sessions list
    sessions = list(sessions_col.find({}).sort("created_at", -1).limit(20))
    formatted_sessions = []
    for sess in sessions:
        sess["_id"] = str(sess["_id"])
        if isinstance(sess.get("created_at"), datetime):
            sess["created_at"] = sess["created_at"].isoformat()
        formatted_sessions.append({
            "session_id": sess.get("session_id"),
            "subject_name": sess.get("subject_name"),
            "faculty_id": sess.get("faculty_id"),
            "status": sess.get("status"),
            "created_at": sess.get("created_at")
        })

    # Security alerts
    alerts = list(alerts_col.find({}).sort("timestamp", -1).limit(30))
    formatted_alerts = []
    for a in alerts:
        a["_id"] = str(a["_id"])
        if isinstance(a.get("timestamp"), datetime):
            a["timestamp"] = a["timestamp"].isoformat()
        formatted_alerts.append({
            "id": a["_id"],
            "session_id": a.get("session_id"),
            "roll_no": a.get("roll_no"),
            "device_id": a.get("used_device_id"),
            "failed_gate": a.get("failed_gate"),
            "reason": a.get("reason"),
            "timestamp": a.get("timestamp")
        })

    return {
        "counts": {
            "students": total_students,
            "faculty": total_faculty,
            "admins": total_admins,
            "total_users": total_students + total_faculty + total_admins,
            "total_sessions": len(formatted_sessions),
            "total_alerts": len(formatted_alerts)
        },
        "system_average_attendance_pct": sys_avg_attendance,
        "high_risk_defaulters": high_risk_defaulters,
        "sessions": formatted_sessions,
        "security_alerts": formatted_alerts
    }

@app.post("/api/admin/users")
def admin_create_user(req: CreateUserRequest):
    users_col = get_users_collection()

    role = req.role.lower()
    if role not in ["student", "faculty", "admin"]:
        raise HTTPException(status_code=400, detail="Role must be 'student', 'faculty', or 'admin'.")

    # Check for existing email or roll_no
    existing = users_col.find_one({"$or": [{"email": req.email}, {"roll_no": req.roll_no}, {"faculty_id": req.roll_no}, {"admin_id": req.roll_no}]})
    if existing:
        raise HTTPException(status_code=400, detail=f"User with roll/ID '{req.roll_no}' or email '{req.email}' already exists.")

    new_user = {
        "name": req.name,
        "email": req.email,
        "password": req.password,
        "role": role,
        "department": req.department,
        "is_active": True,
        "created_at": datetime.now(timezone.utc)
    }

    if role == "student":
        new_user["roll_no"] = req.roll_no
        new_user["semester"] = req.semester or 6
        new_user["bound_device_id"] = None
        new_user["registered_device_id"] = None
        new_user["attendance_stats"] = {
            "current_attendance_pct": req.initial_attendance_pct or 80.0,
            "last_14_days_pct": req.initial_attendance_pct or 80.0,
            "mon_fri_skip_rate": 0.15,
            "first_lecture_miss_rate": 0.10,
            "current_streak": 3,
            "total_lectures": 40,
            "attended_lectures": int(40 * ((req.initial_attendance_pct or 80.0) / 100.0))
        }
    elif role == "faculty":
        new_user["faculty_id"] = req.roll_no
        new_user["courses_taught"] = [f"{req.department} Core Lecture"]
    elif role == "admin":
        new_user["admin_id"] = req.roll_no

    users_col.insert_one(new_user)

    return {
        "success": True,
        "message": f"New {role.capitalize()} account created successfully for {req.name} ({req.roll_no}).",
        "user": {
            "name": req.name,
            "role": role,
            "identifier": req.roll_no,
            "email": req.email
        }
    }

@app.post("/api/admin/reset-device/{roll_no}")
def admin_reset_device(roll_no: str):
    users_col = get_users_collection()
    student = users_col.find_one({"roll_no": roll_no})

    if not student:
        raise HTTPException(status_code=404, detail=f"Student with roll number '{roll_no}' not found.")

    users_col.update_one(
        {"roll_no": roll_no},
        {
            "$set": {
                "bound_device_id": None,
                "registered_device_id": None,
                "device_reset_at": datetime.now(timezone.utc)
            }
        }
    )

    return {
        "success": True,
        "roll_no": roll_no,
        "message": f"Hardware device lock successfully reset for student {roll_no}. Student can now bind a new phone upon their next login."
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
