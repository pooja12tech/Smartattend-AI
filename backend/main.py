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

from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
import numpy as np
import pandas as pd
import joblib
from PIL import Image
import cv2

from db_postgres import (
    get_pg_db,
    init_db_schema,
    check_postgres_connection,
    is_fallback_sqlite
)
from models import (
    User, StudentStats, LectureSession, AttendanceRecord, SecurityAlert,
    Subject, StudentSubjectEnrollment, AuditLog
)
from seed_postgres import run_postgres_seed
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user_optional,
    require_admin,
    require_faculty
)

app = FastAPI(
    title="SmartAttend-AI API",
    description="Anti-Proxy & AI-Driven Smart Attendance System Backend with RBAC (Admin, Faculty, Student) - PostgreSQL Edition",
    version="2.0.0"
)

# Secure CORS configuration
allowed_origins_raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")
allowed_origins = [o.strip() for o in allowed_origins_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if "*" not in allowed_origins else ["*"],
    allow_credentials=True if "*" not in allowed_origins else False,
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
    """Ensure database schema is registered and seed users if database is empty."""
    init_db_schema()
    conn_info = check_postgres_connection()
    print(f"[Main Startup] Database connection: {conn_info.get('status')} ({conn_info.get('message')})")

    from db_postgres import get_session_factory
    session_factory = get_session_factory()
    with session_factory() as db:
        user_count = db.query(User).count()
        if user_count == 0:
            print("[Main Startup] Database is empty. Executing initial seed...")
            try:
                run_postgres_seed(db)
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

class EnrollFaceRequest(BaseModel):
    roll_no: str = Field(..., example="STU01")
    live_selfie_base64: str = Field(..., description="Base64 encoded reference face capture")
    consent_given: bool = Field(True, description="Explicit student consent for biometric template storage")

class CreateSubjectRequest(BaseModel):
    code: str = Field(..., example="CS305", description="Unique subject code")
    name: str = Field(..., example="Information Security & Cryptography")
    department: str = Field("Computer Science & Engineering")
    semester: int = Field(6)
    credits: int = Field(4)
    faculty_id: Optional[str] = Field("FAC01")
    faculty_name: Optional[str] = Field("Prof. Alan Turing")
    min_attendance_pct: float = Field(75.0)

class ResetDeviceRequest(BaseModel):
    reason: Optional[str] = Field("Hardware device lock reset by administrator", description="Mandatory audit trail reason")

def record_audit_log(
    db: Session,
    actor_id: str,
    actor_name: str,
    actor_role: str,
    action: str,
    target_type: str,
    target_id: str,
    reason: str,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
    ip_address: Optional[str] = None
) -> AuditLog:
    """Helper to append an immutable audit log entry."""
    entry = AuditLog(
        actor_id=actor_id,
        actor_name=actor_name,
        actor_role=actor_role,
        action=action,
        target_type=target_type,
        target_id=target_id,
        old_value=str(old_value) if old_value is not None else None,
        new_value=str(new_value) if new_value is not None else None,
        reason=reason,
        ip_address=ip_address,
        created_at=datetime.now(timezone.utc)
    )
    db.add(entry)
    return entry

# ==============================================================================
# API Endpoints
# ==============================================================================

@app.get("/")
def root():
    conn_info = check_postgres_connection()
    return {
        "system": "SmartAttend-AI Backend",
        "status": "ONLINE",
        "version": "2.0.0",
        "database": conn_info.get("database_type", "postgresql"),
        "database_status": conn_info.get("status"),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# ------------------------------------------------------------------------------
# 1. POST /api/login (Role-Based Access: Student, Faculty, Admin)
# ------------------------------------------------------------------------------
@app.post("/api/login")
def login(req: LoginRequest, db: Session = Depends(get_pg_db)):
    user = db.query(User).filter(
        (User.roll_no == req.roll_no) | (User.email == req.roll_no)
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with identifier '{req.roll_no}' not found."
        )

    # Password Verification with bcrypt & legacy support
    if not verify_password(req.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Please verify your username and password."
        )

    # Automatically upgrade legacy plaintext password to bcrypt hash on login
    if user.password and not user.password.startswith("$2b$") and not user.password.startswith("$2a$"):
        user.password = hash_password(req.password)
        db.commit()

    role = user.role or "student"
    token = create_access_token(data={"sub": user.roll_no, "role": role, "email": user.email, "user_id": str(user.id)})

    # 1. Admin Login
    if role == "admin":
        return {
            "success": True,
            "message": "Admin authentication successful",
            "role": "admin",
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": str(user.id),
                "admin_id": user.roll_no,
                "name": user.name,
                "email": user.email,
                "role": "admin",
                "department": user.department or "Administration"
            }
        }

    # 2. Faculty Login
    if role == "faculty":
        return {
            "success": True,
            "message": "Faculty authentication successful",
            "role": "faculty",
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": str(user.id),
                "faculty_id": user.roll_no,
                "name": user.name,
                "email": user.email,
                "role": "faculty",
                "department": user.department or "CSE",
                "courses_taught": ["CS301 - Operating Systems"]
            }
        }

    # 3. Student Login (Enforce single-phone hardware lock)
    bound_device = user.bound_device_id or user.registered_device_id

    if not bound_device:
        user.bound_device_id = req.device_id
        user.registered_device_id = req.device_id
        db.commit()
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
        "access_token": token,
        "token_type": "bearer",
        "binding_status": binding_status,
        "is_exception_mode": req.is_exception_mode,
        "user": {
            "id": str(user.id),
            "roll_no": user.roll_no,
            "name": user.name,
            "email": user.email,
            "role": "student",
            "department": user.department or "CSE",
            "semester": user.semester or 6,
            "bound_device_id": bound_device,
            "has_registered_face": bool(user.registered_face_base64)
        }
    }

# ------------------------------------------------------------------------------
# 2. POST /api/sessions/start & GET /api/sessions/{session_id}/qr
# ------------------------------------------------------------------------------
@app.post("/api/sessions/start")
def start_session(req: SessionStartRequest, db: Session = Depends(get_pg_db)):
    session_id = f"{req.subject_name.split()[0]}-{datetime.now().strftime('%m%d%H%M%S')}"
    secret_seed = req.secret_seed or secrets.token_hex(16)
    now = datetime.now(timezone.utc)

    session = db.query(LectureSession).filter(LectureSession.session_id == session_id).first()
    if not session:
        session = LectureSession(
            session_id=session_id,
            session_code=session_id,
            subject_name=req.subject_name,
            faculty_id=req.faculty_id,
            class_lat=req.class_lat,
            class_lng=req.class_lng,
            secret_seed=secret_seed,
            geofence_radius_meters=60,
            status="ACTIVE",
            started_at=now,
            created_at=now
        )
        db.add(session)
    else:
        session.status = "ACTIVE"
        session.subject_name = req.subject_name
        session.class_lat = req.class_lat
        session.class_lng = req.class_lng
        session.secret_seed = secret_seed

    db.commit()

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
def get_session_qr(session_id: str, db: Session = Depends(get_pg_db)):
    session = db.query(LectureSession).filter(
        (LectureSession.session_id == session_id) | (LectureSession.session_code == session_id)
    ).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lecture session '{session_id}' not found."
        )

    if session.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Lecture session is currently {session.status}. Attendance is closed."
        )

    secret_seed = session.secret_seed or "default_smartattend_seed_2026"
    current_time = int(time.time())
    remaining_seconds = 5 - (current_time % 5)

    signature = generate_qr_signature(session_id, current_time, secret_seed)
    token = f"{session_id}.{current_time}.{signature}"

    return {
        "session_id": session_id,
        "subject_name": session.subject_name,
        "qr_token": token,
        "timestamp": current_time,
        "expires_in_seconds": remaining_seconds,
        "refresh_interval_seconds": 5,
        "class_lat": session.class_lat,
        "class_lng": session.class_lng
    }

# ------------------------------------------------------------------------------
# 3. POST /api/attendance/mark (The 5-Gate Anti-Proxy Engine with ACID Transactions)
# ------------------------------------------------------------------------------
@app.post("/api/attendance/mark")
def mark_attendance(req: MarkAttendanceRequest, db: Session = Depends(get_pg_db)):
    timestamp_now = datetime.now(timezone.utc)

    def log_fraud_and_fail(gate: str, reason: str, extra_meta: Optional[Dict] = None):
        alert = SecurityAlert(
            session_id=req.session_id,
            roll_no=req.roll_no,
            used_device_id=req.device_id,
            failed_gate=gate,
            reason=reason,
            user_lat=req.user_lat,
            user_lng=req.user_lng,
            distance_meters=extra_meta.get("distance_meters") if extra_meta else None,
            face_match_score=extra_meta.get("face_match_score") if extra_meta else None,
            is_exception_mode=req.is_exception_mode,
            resolved=False,
            created_at=timestamp_now
        )
        db.add(alert)
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "failed_gate": gate,
                "reason": reason,
                "timestamp": timestamp_now.isoformat()
            }
        )

    student = db.query(User).filter(User.roll_no == req.roll_no).first()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student with roll number '{req.roll_no}' not found.")

    session = db.query(LectureSession).filter(
        (LectureSession.session_id == req.session_id) | (LectureSession.session_code == req.session_id)
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{req.session_id}' not found.")

    existing_student_log = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == req.session_id,
        AttendanceRecord.roll_no == req.roll_no
    ).first()
    if existing_student_log:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "failed_gate": "DUPLICATE_SUBMISSION",
                "reason": "Attendance has already been recorded for this student in this lecture session.",
                "marked_at": existing_student_log.marked_at.isoformat() if existing_student_log.marked_at else None
            }
        )

    # GATE 1: Device Lock (Hardware Fingerprint Verification & Anti-Proxy 1-Phone Rule)
    bound_device = student.bound_device_id or student.registered_device_id

    device_already_used = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == req.session_id,
        AttendanceRecord.used_device_id == req.device_id
    ).first()
    if device_already_used:
        log_fraud_and_fail(
            gate="GATE_1_DEVICE_LOCK",
            reason=f"Proxy Alert: Device '{req.device_id}' was already used by roll number '{device_already_used.roll_no}' in this session. One phone cannot mark attendance for multiple students."
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

    secret_seed = session.secret_seed or "default_smartattend_seed_2026"
    expected_sig = generate_qr_signature(tok_session_id, tok_timestamp, secret_seed)
    if not hmac.compare_digest(expected_sig, tok_sig):
        log_fraud_and_fail(
            gate="GATE_2_DYNAMIC_QR",
            reason="Invalid QR signature. Token does not match this lecture session's cryptographic seed."
        )

    # GATE 3: GPS Geofence (Haversine Distance <= 60 Meters)
    class_lat = session.class_lat or 19.0760
    class_lng = session.class_lng or 72.8777

    distance_meters = haversine_distance_meters(class_lat, class_lng, req.user_lat, req.user_lng)
    max_radius = session.geofence_radius_meters or 60

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

    registered_face_b64 = student.registered_face_base64
    if not registered_face_b64:
        student.registered_face_base64 = req.live_selfie_base64
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

    # GATE 5: Decision & Attendance Logging (Atomic Transaction)
    attendance_status = "PENDING_APPROVAL" if req.is_exception_mode else "PRESENT"

    attendance_record = AttendanceRecord(
        session_id=req.session_id,
        roll_no=req.roll_no,
        student_name=student.name,
        used_device_id=req.device_id,
        user_lat=req.user_lat,
        user_lng=req.user_lng,
        distance_meters=round(distance_meters, 1),
        face_match_score=face_match_score,
        face_status=face_status,
        is_exception_mode=req.is_exception_mode,
        live_selfie_base64=req.live_selfie_base64,
        status=attendance_status,
        marked_at=timestamp_now
    )
    db.add(attendance_record)

    # Update historical student streak and attended stats if PRESENT
    if attendance_status == "PRESENT":
        stats = db.query(StudentStats).filter(StudentStats.user_id == student.id).first()
        if not stats:
            stats = StudentStats(
                user_id=student.id,
                total_lectures=41,
                attended_lectures=31,
                current_streak=1,
                current_attendance_pct=round((31 / 41) * 100.0, 1),
                updated_at=timestamp_now
            )
            db.add(stats)
        else:
            stats.total_lectures += 1
            stats.attended_lectures += 1
            stats.current_streak = max(1, stats.current_streak + 1)
            stats.current_attendance_pct = round((stats.attended_lectures / stats.total_lectures) * 100.0, 1)
            stats.updated_at = timestamp_now

    student.updated_at = timestamp_now
    db.commit()

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
# 3b. POST /api/student/enroll-face (Consent-Based Biometric Enrollment)
# ------------------------------------------------------------------------------
@app.post("/api/student/enroll-face")
def enroll_face(req: EnrollFaceRequest, db: Session = Depends(get_pg_db)):
    if not req.consent_given:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Biometric consent is mandatory to store face reference templates."
        )

    student = db.query(User).filter(User.roll_no == req.roll_no).first()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student '{req.roll_no}' not found.")

    cv2_img = decode_image_base64_to_cv2(req.live_selfie_base64)
    if cv2_img is None:
        raise HTTPException(status_code=400, detail="Unable to decode face image payload.")

    student.registered_face_base64 = req.live_selfie_base64
    student.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "success": True,
        "roll_no": req.roll_no,
        "message": f"Biometric face reference successfully enrolled for student {student.name} with explicit consent.",
        "enrolled_at": datetime.now(timezone.utc).isoformat()
    }

# ------------------------------------------------------------------------------
# 4. POST /api/faculty/manual-attendance (Teacher Manual Attendance Override)
# ------------------------------------------------------------------------------
@app.post("/api/faculty/manual-attendance")
def faculty_manual_attendance(req: ManualAttendanceRequest, db: Session = Depends(get_pg_db)):
    student = db.query(User).filter(User.roll_no == req.roll_no).first()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student '{req.roll_no}' not found.")

    session = db.query(LectureSession).filter(
        (LectureSession.session_id == req.session_id) | (LectureSession.session_code == req.session_id)
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{req.session_id}' not found.")

    action_status = req.status.upper()
    if action_status not in ["PRESENT", "ABSENT"]:
        raise HTTPException(status_code=400, detail="Status must be either 'PRESENT' or 'ABSENT'")

    if not req.reason or not req.reason.strip():
        raise HTTPException(status_code=400, detail="Mandatory audit reason required for manual attendance override.")

    timestamp_now = datetime.now(timezone.utc)

    # Upsert manual record in attendance_records
    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == req.session_id,
        AttendanceRecord.roll_no == req.roll_no
    ).first()

    old_status = record.status if record else "ABSENT"

    if not record:
        record = AttendanceRecord(
            session_id=req.session_id,
            roll_no=req.roll_no,
            student_name=student.name,
            used_device_id="MANUAL-OVERRIDE",
            distance_meters=0.0,
            face_match_score=100.0,
            is_exception_mode=False,
            is_manual_override=True,
            manual_by=req.faculty_id,
            reason=req.reason,
            status=action_status,
            marked_at=timestamp_now
        )
        db.add(record)
    else:
        record.status = action_status
        record.is_manual_override = True
        record.manual_by = req.faculty_id
        record.reason = req.reason
        record.reviewed_at = timestamp_now

    # Update student's cumulative statistics
    stats = db.query(StudentStats).filter(StudentStats.user_id == student.id).first()
    if not stats:
        stats = StudentStats(
            user_id=student.id,
            total_lectures=41,
            attended_lectures=31 if action_status == "PRESENT" else 30,
            current_streak=1 if action_status == "PRESENT" else -1,
            current_attendance_pct=round((31 if action_status == "PRESENT" else 30) / 41 * 100.0, 1),
            updated_at=timestamp_now
        )
        db.add(stats)
    else:
        stats.total_lectures += 1
        if action_status == "PRESENT":
            stats.attended_lectures += 1
            stats.current_streak = max(1, stats.current_streak + 1)
        else:
            stats.current_streak = min(-1, stats.current_streak - 1 if stats.current_streak < 0 else -1)

        stats.current_attendance_pct = round((stats.attended_lectures / stats.total_lectures) * 100.0, 1)
        stats.updated_at = timestamp_now

    # Update subject-level enrollment tracking if matching subject exists
    session_code_prefix = req.session_id.split("-")[0].upper()
    enrollment = db.query(StudentSubjectEnrollment).filter(
        StudentSubjectEnrollment.roll_no == req.roll_no,
        StudentSubjectEnrollment.subject_code == session_code_prefix
    ).first()
    if enrollment:
        enrollment.total_classes += 1
        if action_status == "PRESENT":
            enrollment.attended_classes += 1
        enrollment.current_pct = round((enrollment.attended_classes / max(1, enrollment.total_classes)) * 100.0, 1)
        enrollment.updated_at = timestamp_now

    # Immutable Audit Log
    record_audit_log(
        db=db,
        actor_id=req.faculty_id,
        actor_name=f"Faculty ({req.faculty_id})",
        actor_role="faculty",
        action="MANUAL_ATTENDANCE_OVERRIDE",
        target_type="ATTENDANCE_RECORD",
        target_id=f"{req.session_id}:{req.roll_no}",
        old_value=old_status,
        new_value=action_status,
        reason=req.reason
    )

    db.commit()

    return {
        "success": True,
        "message": f"Student '{req.roll_no}' manually marked {action_status} by faculty.",
        "details": {
            "session_id": req.session_id,
            "roll_no": req.roll_no,
            "status": action_status,
            "reason": req.reason,
            "updated_pct": stats.current_attendance_pct,
            "updated_streak": stats.current_streak,
            "marked_at": timestamp_now.isoformat()
        }
    }

# ------------------------------------------------------------------------------
# 5. GET /api/student/{roll_no}/dashboard
# ------------------------------------------------------------------------------
@app.get("/api/student/{roll_no}/dashboard")
def student_dashboard(roll_no: str, db: Session = Depends(get_pg_db)):
    student = db.query(User).filter(User.roll_no == roll_no).first()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student '{roll_no}' not found.")

    stats_obj = db.query(StudentStats).filter(StudentStats.user_id == student.id).first()
    if stats_obj:
        stats = stats_obj.to_dict()
    else:
        stats = {
            "current_attendance_pct": 75.0,
            "last_14_days_pct": 75.0,
            "mon_fri_skip_rate": 0.20,
            "first_lecture_miss_rate": 0.15,
            "current_streak": 2,
            "total_lectures": 40,
            "attended_lectures": 30
        }

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

    # Subject-wise breakdown from normalized StudentSubjectEnrollment
    db_enrollments = db.query(StudentSubjectEnrollment).filter(
        StudentSubjectEnrollment.roll_no == roll_no
    ).order_by(StudentSubjectEnrollment.subject_code.asc()).all()

    if db_enrollments:
        subject_breakdown = []
        for enr in db_enrollments:
            b_calc = calculate_bunk_metrics(enr.attended_classes, enr.total_classes)
            subject_breakdown.append({
                "subject": f"{enr.subject_code} - {enr.subject_name}" if enr.subject_name else enr.subject_code,
                "subject_code": enr.subject_code,
                "attended": enr.attended_classes,
                "total": enr.total_classes,
                "pct": enr.current_pct,
                "bunk_calculator": b_calc
            })
    else:
        subject_breakdown = [
            {"subject": "CS301 - Operating Systems", "subject_code": "CS301", "attended": int(attended_lec * 0.35), "total": int(total_lec * 0.35), "pct": current_att, "bunk_calculator": calculate_bunk_metrics(int(attended_lec * 0.35), int(total_lec * 0.35))},
            {"subject": "CS302 - Database Systems", "subject_code": "CS302", "attended": int(attended_lec * 0.35), "total": int(total_lec * 0.35), "pct": max(40.0, current_att - 3.0), "bunk_calculator": calculate_bunk_metrics(int(attended_lec * 0.35), int(total_lec * 0.35))},
            {"subject": "CS303 - Machine Learning", "subject_code": "CS303", "attended": int(attended_lec * 0.30), "total": int(total_lec * 0.30), "pct": min(100.0, current_att + 2.0), "bunk_calculator": calculate_bunk_metrics(int(attended_lec * 0.30), int(total_lec * 0.30))}
        ]

    recent_records = db.query(AttendanceRecord).filter(
        AttendanceRecord.roll_no == roll_no
    ).order_by(AttendanceRecord.marked_at.desc()).limit(10).all()

    recent_logs = [r.to_dict() for r in recent_records]

    return {
        "student": {
            "roll_no": student.roll_no,
            "name": student.name,
            "department": student.department or "CSE",
            "semester": student.semester or 6,
            "bound_device_id": student.bound_device_id or student.registered_device_id
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
def get_faculty_live_session(session_id: str, db: Session = Depends(get_pg_db)):
    session = db.query(LectureSession).filter(
        (LectureSession.session_id == session_id) | (LectureSession.session_code == session_id)
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")

    records = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == session_id
    ).order_by(AttendanceRecord.marked_at.desc()).all()

    present_students = []
    pending_approvals = []

    for r in records:
        if r.status == "PRESENT":
            present_students.append({
                "roll_no": r.roll_no,
                "student_name": r.student_name,
                "marked_at": r.marked_at.isoformat() if r.marked_at else None,
                "distance_meters": r.distance_meters,
                "face_match_score": r.face_match_score,
                "device_id": r.used_device_id,
                "is_manual_override": r.is_manual_override,
                "reason": r.reason
            })
        elif r.status == "PENDING_APPROVAL":
            pending_approvals.append({
                "roll_no": r.roll_no,
                "student_name": r.student_name,
                "marked_at": r.marked_at.isoformat() if r.marked_at else None,
                "device_id": r.used_device_id,
                "distance_meters": r.distance_meters,
                "face_match_score": r.face_match_score,
                "live_selfie_base64": r.live_selfie_base64
            })

    alerts = db.query(SecurityAlert).filter(
        SecurityAlert.session_id == session_id
    ).order_by(SecurityAlert.created_at.desc()).all()

    formatted_alerts = [a.to_dict() for a in alerts]

    return {
        "session": {
            "session_id": session.session_id,
            "subject_name": session.subject_name,
            "status": session.status,
            "class_lat": session.class_lat,
            "class_lng": session.class_lng
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
def approve_exception(req: FacultyApproveRequest, db: Session = Depends(get_pg_db)):
    action = req.action.upper()
    if action not in ["APPROVE", "REJECT"]:
        raise HTTPException(status_code=400, detail="Action must be either 'APPROVE' or 'REJECT'")

    new_status = "PRESENT" if action == "APPROVE" else "REJECTED"

    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == req.session_id,
        AttendanceRecord.roll_no == req.roll_no
    ).first()

    if not record:
        raise HTTPException(
            status_code=404,
            detail=f"Attendance record for roll number '{req.roll_no}' in session '{req.session_id}' not found."
        )

    record.status = new_status
    record.reviewed_at = datetime.now(timezone.utc)
    record.remarks = req.remarks or f"Faculty {action.lower()}d exception."

    if new_status == "PRESENT":
        student = db.query(User).filter(User.roll_no == req.roll_no).first()
        if student:
            stats = db.query(StudentStats).filter(StudentStats.user_id == student.id).first()
            if stats:
                stats.total_lectures += 1
                stats.attended_lectures += 1
                stats.current_attendance_pct = round((stats.attended_lectures / stats.total_lectures) * 100.0, 1)
                stats.current_streak = max(1, stats.current_streak + 1)
                stats.updated_at = datetime.now(timezone.utc)

    record_audit_log(
        db=db,
        actor_id="FACULTY",
        actor_name="Faculty Reviewer",
        actor_role="faculty",
        action="EXCEPTION_APPROVAL",
        target_type="ATTENDANCE_RECORD",
        target_id=f"{req.session_id}:{req.roll_no}",
        old_value="PENDING_APPROVAL",
        new_value=new_status,
        reason=req.remarks or f"Faculty {action.lower()}d exception."
    )

    db.commit()

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
def admin_overview(db: Session = Depends(get_pg_db)):
    students = db.query(User).filter(User.role == "student").all()
    faculty_list = db.query(User).filter(User.role == "faculty").all()
    admins = db.query(User).filter(User.role == "admin").all()

    total_students = len(students)
    total_faculty = len(faculty_list)
    total_admins = len(admins)

    # Average attendance
    all_stats = db.query(StudentStats).all()
    att_percentages = [s.current_attendance_pct for s in all_stats]
    sys_avg_attendance = round(float(np.mean(att_percentages)), 1) if att_percentages else 0.0

    # ML Defaulter Risk Evaluation across all students
    high_risk_defaulters = []
    for s in students:
        s_stats_obj = db.query(StudentStats).filter(StudentStats.user_id == s.id).first()
        stats_dict = s_stats_obj.to_dict() if s_stats_obj else {}
        risk = evaluate_student_risk(stats_dict)
        if risk["will_be_defaulter"] == 1 or risk["risk_level"] in ["CRITICAL", "WARNING"]:
            high_risk_defaulters.append({
                "roll_no": s.roll_no,
                "name": s.name,
                "email": s.email,
                "department": s.department or "CSE",
                "attendance_pct": stats_dict.get("current_attendance_pct", 0.0),
                "defaulter_probability": risk["defaulter_probability"],
                "risk_pct": risk["defaulter_risk_pct"],
                "risk_level": risk["risk_level"],
                "current_streak": stats_dict.get("current_streak", 0)
            })

    # Sort defaulters by risk probability descending
    high_risk_defaulters.sort(key=lambda x: x["defaulter_probability"], reverse=True)

    # Recent sessions
    sessions = db.query(LectureSession).order_by(LectureSession.created_at.desc()).limit(20).all()
    formatted_sessions = [sess.to_dict() for sess in sessions]

    # Recent security alerts
    alerts = db.query(SecurityAlert).order_by(SecurityAlert.created_at.desc()).limit(30).all()
    formatted_alerts = [a.to_dict() for a in alerts]

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
def admin_create_user(req: CreateUserRequest, db: Session = Depends(get_pg_db)):
    role = req.role.lower()
    if role not in ["student", "faculty", "admin"]:
        raise HTTPException(status_code=400, detail="Role must be 'student', 'faculty', or 'admin'.")

    # Check for existing email or roll_no
    existing = db.query(User).filter(
        (User.email == req.email) | (User.roll_no == req.roll_no)
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"User with roll/ID '{req.roll_no}' or email '{req.email}' already exists."
        )

    now = datetime.now(timezone.utc)
    new_user = User(
        name=req.name,
        email=req.email,
        password=hash_password(req.password),
        role=role,
        department=req.department,
        is_active=True,
        created_at=now,
        updated_at=now
    )

    if role == "student":
        new_user.roll_no = req.roll_no
        new_user.semester = req.semester or 6
        db.add(new_user)
        db.flush()

        init_att = req.initial_attendance_pct or 80.0
        stats = StudentStats(
            user_id=new_user.id,
            current_attendance_pct=init_att,
            last_14_days_pct=init_att,
            mon_fri_skip_rate=0.15,
            first_lecture_miss_rate=0.10,
            current_streak=3,
            total_lectures=40,
            attended_lectures=int(40 * (init_att / 100.0)),
            updated_at=now
        )
        db.add(stats)
    elif role == "faculty":
        new_user.roll_no = req.roll_no
        db.add(new_user)
    elif role == "admin":
        new_user.roll_no = req.roll_no
        db.add(new_user)

    record_audit_log(
        db=db,
        actor_id="ADM01",
        actor_name="System Administrator",
        actor_role="admin",
        action="USER_CREATED",
        target_type="USER",
        target_id=req.roll_no,
        reason=f"Administrator provisioned new {role} account for {req.name}"
    )

    db.commit()

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
def admin_reset_device(roll_no: str, req: Optional[ResetDeviceRequest] = None, db: Session = Depends(get_pg_db)):
    student = db.query(User).filter(User.roll_no == roll_no).first()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student with roll number '{roll_no}' not found.")

    old_dev = student.bound_device_id or "UNBOUND"
    student.bound_device_id = None
    student.registered_device_id = None
    student.updated_at = datetime.now(timezone.utc)

    reason = req.reason if req and req.reason else "Hardware device lock reset by administrator"
    record_audit_log(
        db=db,
        actor_id="ADM01",
        actor_name="System Administrator",
        actor_role="admin",
        action="DEVICE_RESET",
        target_type="USER",
        target_id=roll_no,
        old_value=old_dev,
        new_value="UNBOUND",
        reason=reason
    )
    db.commit()

    return {
        "success": True,
        "roll_no": roll_no,
        "message": f"Hardware device lock successfully reset for student {roll_no}. Student can now bind a new phone upon their next login."
    }

@app.post("/api/admin/reset-face/{roll_no}")
def admin_reset_face(roll_no: str, req: Optional[ResetDeviceRequest] = None, db: Session = Depends(get_pg_db)):
    student = db.query(User).filter(User.roll_no == roll_no).first()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student with roll number '{roll_no}' not found.")

    had_face = bool(student.registered_face_base64)
    student.registered_face_base64 = None
    student.updated_at = datetime.now(timezone.utc)

    reason = req.reason if req and req.reason else "Biometric reference template reset by administrator"
    record_audit_log(
        db=db,
        actor_id="ADM01",
        actor_name="System Administrator",
        actor_role="admin",
        action="FACE_RESET",
        target_type="USER",
        target_id=roll_no,
        old_value="ENROLLED" if had_face else "NONE",
        new_value="RESET",
        reason=reason
    )
    db.commit()

    return {
        "success": True,
        "roll_no": roll_no,
        "message": f"Biometric reference template reset for student {roll_no}. Student can now re-enroll their face."
    }

# ------------------------------------------------------------------------------
# 8. AUDIT TRAILS & SUBJECT MANAGEMENT ENDPOINTS
# ------------------------------------------------------------------------------
@app.get("/api/admin/audit-logs")
def get_admin_audit_logs(
    limit: int = 50,
    action: Optional[str] = None,
    actor_id: Optional[str] = None,
    db: Session = Depends(get_pg_db)
):
    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action == action)
    if actor_id:
        query = query.filter(AuditLog.actor_id == actor_id)

    logs = query.order_by(AuditLog.created_at.desc()).limit(min(100, limit)).all()
    return {
        "count": len(logs),
        "audit_logs": [l.to_dict() for l in logs]
    }

@app.get("/api/subjects")
def get_subjects(db: Session = Depends(get_pg_db)):
    subjects = db.query(Subject).order_by(Subject.code.asc()).all()
    return {
        "count": len(subjects),
        "subjects": [s.to_dict() for s in subjects]
    }

@app.post("/api/admin/subjects")
def admin_create_subject(req: CreateSubjectRequest, db: Session = Depends(get_pg_db)):
    existing = db.query(Subject).filter(Subject.code == req.code.upper()).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Subject with code '{req.code}' already exists.")

    subj = Subject(
        code=req.code.upper(),
        name=req.name,
        department=req.department,
        semester=req.semester,
        credits=req.credits,
        faculty_id=req.faculty_id,
        faculty_name=req.faculty_name,
        min_attendance_pct=req.min_attendance_pct,
        total_conducted=0,
        created_at=datetime.now(timezone.utc)
    )
    db.add(subj)
    record_audit_log(
        db=db,
        actor_id="ADM01",
        actor_name="System Administrator",
        actor_role="admin",
        action="SUBJECT_CREATED",
        target_type="SUBJECT",
        target_id=req.code.upper(),
        reason=f"Administrator added curriculum subject {subj.code} - {subj.name}"
    )
    db.commit()

    return {
        "success": True,
        "message": f"Subject {subj.code} - {subj.name} successfully created.",
        "subject": subj.to_dict()
    }

@app.get("/api/student/{roll_no}/subjects")
def get_student_subjects(roll_no: str, db: Session = Depends(get_pg_db)):
    student = db.query(User).filter(User.roll_no == roll_no).first()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student '{roll_no}' not found.")

    enrollments = db.query(StudentSubjectEnrollment).filter(
        StudentSubjectEnrollment.roll_no == roll_no
    ).order_by(StudentSubjectEnrollment.subject_code.asc()).all()

    results = []
    for enr in enrollments:
        bunk = calculate_bunk_metrics(enr.attended_classes, enr.total_classes)
        results.append({
            "id": str(enr.id),
            "roll_no": enr.roll_no,
            "subject_code": enr.subject_code,
            "subject_name": enr.subject_name,
            "total_classes": enr.total_classes,
            "attended_classes": enr.attended_classes,
            "current_pct": enr.current_pct,
            "bunk_calculator": bunk
        })

    return {
        "roll_no": roll_no,
        "student_name": student.name,
        "count": len(results),
        "subjects": results
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
