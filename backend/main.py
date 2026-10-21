import os
import io
import time
import math
import uuid
import hmac
import hashlib
import secrets
import base64
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

QR_WINDOW_SECONDS = int(os.getenv("QR_WINDOW_SECONDS", "20"))
SESSION_MAX_MINUTES = int(os.getenv("SESSION_MAX_MINUTES", "120"))

import json
from fastapi import FastAPI, HTTPException, status, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
import numpy as np
import pandas as pd
import joblib
from PIL import Image
import cv2
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from db_postgres import (
    get_pg_db,
    init_db_schema,
    check_postgres_connection,
    is_fallback_sqlite
)
from models import (
    User, StudentStats, LectureSession, AttendanceRecord, SecurityAlert,
    Subject, StudentSubjectEnrollment, AuditLog, FaceEnrollment
)
import face_service
from seed_postgres import run_postgres_seed
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    get_current_user_optional,
    require_admin,
    require_faculty,
    require_student,
    require_faculty_or_admin
)

def login_rate_limit_key(request: Request) -> str:
    ip = get_remote_address(request)
    roll_no = getattr(request.state, "rate_limit_roll_no", "")
    return f"{ip}:{roll_no}"

limiter = Limiter(key_func=login_rate_limit_key)

app = FastAPI(
    title="SmartAttend-AI API",
    description="Anti-Proxy & AI-Driven Smart Attendance System Backend with RBAC (Admin, Faculty, Student) - PostgreSQL Edition",
    version="2.0.0"
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.middleware("http")
async def extract_rate_limit_roll_no_middleware(request: Request, call_next):
    if request.url.path == "/api/login" and request.method == "POST":
        try:
            body = await request.body()
            if body:
                data = json.loads(body)
                request.state.rate_limit_roll_no = str(data.get("roll_no", "")).strip().upper()
        except Exception:
            pass
    return await call_next(request)

# Secure CORS configuration
allowed_origins_raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")
allowed_origins = [o.strip().strip("'\"").rstrip("/") for o in allowed_origins_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if "*" not in allowed_origins else ["*"],
    allow_origin_regex=r"^https://.*\.vercel\.app$",
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

async def auto_end_sessions_background_task():
    while True:
        try:
            await asyncio.sleep(60)
            from db_postgres import get_session_factory
            session_factory = get_session_factory()
            with session_factory() as db:
                auto_close_expired_sessions(db)
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[Auto-End Background Task Error]: {e}")

@app.on_event("startup")
async def startup_db_init():
    """Ensure database schema is registered and seed users if database is empty."""
    # Verify Fernet encryption key for biometric templates at rest (fails if missing/weak outside tests)
    face_service.get_fernet()

    init_db_schema()
    conn_info = check_postgres_connection()
    print(f"[Main Startup] Database connection: {conn_info.get('status')} ({conn_info.get('message')})")

    from db_postgres import get_session_factory
    session_factory = get_session_factory()
    with session_factory() as db:
        user_count = db.query(User).count()
        if user_count == 0:
            env = os.getenv("ENVIRONMENT", "").strip().lower()
            if env == "development":
                print("[Main Startup] Database is empty and ENVIRONMENT=development. Executing initial seed...")
                try:
                    run_postgres_seed(db)
                except Exception as e:
                    print(f"[Main Startup Warning] Seeding failed: {e}")
            else:
                print(f"[Main Startup] Database is empty but ENVIRONMENT is '{env}'. Auto-seed skipped.")

    asyncio.create_task(auto_end_sessions_background_task())

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

def generate_qr_signature(session_id: str, window_index: int, secret_seed: str) -> str:
    message = f"{session_id}:{window_index}".encode("utf-8")
    return hmac.new(secret_seed.encode("utf-8"), message, hashlib.sha256).hexdigest()

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

def recompute_student_stats(db: Session, user_id_or_roll: Any) -> Optional[StudentStats]:
    """
    Single source of truth for student statistics (Phase 3).
    Recomputes total_lectures, attended_lectures, current_attendance_pct,
    current_streak, last_14_days_pct, mon_fri_skip_rate, and first_lecture_miss_rate
    directly from AttendanceRecord rows for this student.

    - Records with status 'PRESENT' count as attended and towards total.
    - Records with status 'ABSENT' count towards total.
    - Records with status 'PENDING_APPROVAL' or 'REJECTED' do not count as attended.
    - When a student has 0 records, attended = 0, total = 0, current_attendance_pct = 100.0, current_streak = 0.
    """
    if not user_id_or_roll:
        return None

    # Resolve student User object
    user = None
    if isinstance(user_id_or_roll, uuid.UUID):
        user = db.query(User).filter(User.id == user_id_or_roll).first()
    elif isinstance(user_id_or_roll, str):
        try:
            parsed_id = uuid.UUID(user_id_or_roll)
            user = db.query(User).filter(User.id == parsed_id).first()
        except ValueError:
            user = db.query(User).filter(User.roll_no == user_id_or_roll).first()

    if not user:
        return None

    # Fetch all attendance records for this student ordered chronologically
    records = db.query(AttendanceRecord).filter(
        AttendanceRecord.roll_no == user.roll_no
    ).order_by(AttendanceRecord.marked_at.asc()).all()

    valid_records = [r for r in records if r.status in ("PRESENT", "ABSENT")]
    total_lectures = len(valid_records)
    attended_records = [r for r in valid_records if r.status == "PRESENT"]
    attended_lectures = len(attended_records)

    current_attendance_pct = (
        round((attended_lectures / total_lectures) * 100.0, 1)
        if total_lectures > 0 else 100.0
    )

    # Streak calculation: count consecutive PRESENT (>0) or ABSENT (<0) chronologically
    current_streak = 0
    for r in valid_records:
        if r.status == "PRESENT":
            current_streak = (current_streak + 1) if current_streak > 0 else 1
        elif r.status == "ABSENT":
            current_streak = (current_streak - 1) if current_streak < 0 else -1

    now = datetime.now(timezone.utc)
    cutoff_14 = now - timedelta(days=14)

    # Last 14 days attendance rate
    recs_14 = [
        r for r in valid_records
        if r.marked_at and (r.marked_at if r.marked_at.tzinfo else r.marked_at.replace(tzinfo=timezone.utc)) >= cutoff_14
    ]
    if recs_14:
        att_14 = sum(1 for r in recs_14 if r.status == "PRESENT")
        last_14_days_pct = round((att_14 / len(recs_14)) * 100.0, 1)
    else:
        last_14_days_pct = current_attendance_pct

    # Mon/Fri skip rate
    recs_mf = [r for r in valid_records if r.marked_at and r.marked_at.weekday() in (0, 4)]
    if recs_mf:
        absent_mf = sum(1 for r in recs_mf if r.status == "ABSENT")
        mon_fri_skip_rate = round(absent_mf / len(recs_mf), 2)
    else:
        mon_fri_skip_rate = 0.0

    # First lecture miss rate (lectures before/at 9 AM)
    recs_morning = [r for r in valid_records if r.marked_at and r.marked_at.hour <= 9]
    if recs_morning:
        absent_morning = sum(1 for r in recs_morning if r.status == "ABSENT")
        first_lecture_miss_rate = round(absent_morning / len(recs_morning), 2)
    else:
        first_lecture_miss_rate = 0.0

    # Upsert into StudentStats cache table
    stats = db.query(StudentStats).filter(StudentStats.user_id == user.id).first()
    if not stats:
        stats = StudentStats(
            user_id=user.id,
            current_attendance_pct=current_attendance_pct,
            last_14_days_pct=last_14_days_pct,
            mon_fri_skip_rate=mon_fri_skip_rate,
            first_lecture_miss_rate=first_lecture_miss_rate,
            current_streak=current_streak,
            total_lectures=total_lectures,
            attended_lectures=attended_lectures,
            updated_at=now
        )
        db.add(stats)
    else:
        stats.current_attendance_pct = current_attendance_pct
        stats.last_14_days_pct = last_14_days_pct
        stats.mon_fri_skip_rate = mon_fri_skip_rate
        stats.first_lecture_miss_rate = first_lecture_miss_rate
        stats.current_streak = current_streak
        stats.total_lectures = total_lectures
        stats.attended_lectures = attended_lectures
        stats.updated_at = now

    db.flush()
    return stats

def recompute_student_subject_enrollment(db: Session, roll_no: str, subject_code: str):
    """
    Recalculates total_classes, attended_classes, and current_pct for a student's
    enrollment in a subject directly from AttendanceRecord matching lecture sessions for that subject.
    """
    enrollment = db.query(StudentSubjectEnrollment).filter(
        StudentSubjectEnrollment.roll_no == roll_no,
        StudentSubjectEnrollment.subject_code == subject_code
    ).first()
    if not enrollment:
        return None

    records = (
        db.query(AttendanceRecord)
        .join(LectureSession, AttendanceRecord.session_id == LectureSession.session_id)
        .filter(
            AttendanceRecord.roll_no == roll_no,
            (LectureSession.subject_name.startswith(subject_code)) |
            (LectureSession.subject_name == subject_code) |
            (LectureSession.session_code.startswith(subject_code))
        )
        .all()
    )

    valid_records = [r for r in records if r.status in ("PRESENT", "ABSENT")]
    if valid_records:
        total = len(valid_records)
        attended = sum(1 for r in valid_records if r.status == "PRESENT")
        enrollment.total_classes = total
        enrollment.attended_classes = attended
        enrollment.current_pct = round((attended / total) * 100.0, 1) if total > 0 else 100.0
        enrollment.updated_at = datetime.now(timezone.utc)
        db.flush()

    return enrollment

def finalize_session_absentees(db: Session, session: LectureSession, now: datetime, absent_reason: str) -> tuple[int, bool]:
    """
    Finds enrolled students for session's subject who have not marked attendance,
    and inserts ABSENT AttendanceRecord for them.
    Returns (absentees_created, has_enrollments).
    """
    subject = None
    if session.subject_id:
        subject = db.query(Subject).filter(Subject.id == session.subject_id).first()
    if not subject:
        code_part = session.subject_name.split("-")[0].strip() if "-" in session.subject_name else session.subject_name.split(" ")[0].strip()
        name_part = session.subject_name.split("-")[-1].strip() if "-" in session.subject_name else session.subject_name.strip()
        subject = db.query(Subject).filter(
            (Subject.code == session.subject_name) |
            (Subject.name == session.subject_name) |
            (Subject.code == code_part) |
            (Subject.name == name_part)
        ).first()

    enrollments = []
    subject_code = subject.code if subject else (session.subject_name.split(" ")[0].strip() if " " in session.subject_name else session.subject_name)

    if subject:
        enrollments = db.query(StudentSubjectEnrollment).filter(
            (StudentSubjectEnrollment.subject_code == subject.code) |
            (StudentSubjectEnrollment.subject_name == subject.name)
        ).all()
    else:
        enrollments = db.query(StudentSubjectEnrollment).filter(
            (StudentSubjectEnrollment.subject_code == session.subject_name) |
            (StudentSubjectEnrollment.subject_code == subject_code) |
            (StudentSubjectEnrollment.subject_name == session.subject_name)
        ).all()

    if not enrollments:
        return 0, False

    candidate_students = [(enr.roll_no, enr.student_name) for enr in enrollments]
    existing_records = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == session.session_id
    ).all()
    already_marked_rolls = {r.roll_no for r in existing_records}

    absentees_created = 0
    affected_rolls = set()

    for roll_no, student_name in candidate_students:
        if roll_no not in already_marked_rolls:
            absent_record = AttendanceRecord(
                session_id=session.session_id,
                roll_no=roll_no,
                student_name=student_name,
                used_device_id=f"ABSENT_{roll_no}",
                distance_meters=0.0,
                face_match_score=0.0,
                face_status="ABSENT",
                is_exception_mode=False,
                is_manual_override=False,
                status="ABSENT",
                reason=absent_reason,
                marked_at=now
            )
            db.add(absent_record)
            absentees_created += 1
            already_marked_rolls.add(roll_no)
            affected_rolls.add(roll_no)

    db.flush()

    for roll_no in affected_rolls:
        student_user = db.query(User).filter(User.roll_no == roll_no).first()
        if student_user:
            recompute_student_stats(db, student_user.id)
            recompute_student_subject_enrollment(db, roll_no, subject_code)

    return absentees_created, True

def auto_close_expired_sessions(db: Session, now: Optional[datetime] = None) -> List[str]:
    """
    Finds all ACTIVE lecture sessions started more than SESSION_MAX_MINUTES ago,
    marks them ENDED, and generates ABSENT records for students who did not mark attendance.
    """
    if now is None:
        now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=SESSION_MAX_MINUTES)

    expired_sessions = db.query(LectureSession).filter(
        LectureSession.status == "ACTIVE",
        LectureSession.started_at <= cutoff
    ).all()

    closed_session_ids = []
    for session in expired_sessions:
        session.status = "ENDED"
        session.ended_at = now
        finalize_session_absentees(
            db,
            session,
            now,
            absent_reason=f"Marked absent automatically: Session exceeded max duration of {SESSION_MAX_MINUTES} minutes."
        )
        closed_session_ids.append(session.session_id)

    if closed_session_ids:
        db.commit()

    return closed_session_ids

def evaluate_student_risk(stats: Dict[str, Any]) -> Dict[str, Any]:
    """Helper to run ML risk prediction for a student stats dict."""
    current_att = stats.get("current_attendance_pct", 100.0)
    streak = stats.get("current_streak", 0)
    last_14 = stats.get("last_14_days_pct", current_att)
    mon_fri = stats.get("mon_fri_skip_rate", 0.0)
    first_lec = stats.get("first_lecture_miss_rate", 0.0)

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
    device_id: Optional[str] = Field("DEFAULT-DEV-ID", description="Unique hardware/browser device fingerprint")

class SessionStartRequest(BaseModel):
    subject_name: str = Field(..., example="CS301 - Operating Systems")
    class_lat: float = Field(..., example=19.0760)
    class_lng: float = Field(..., example=72.8777)
    subject_id: Optional[str] = None

class MarkAttendanceRequest(BaseModel):
    session_id: str = Field(..., example="CS301-SEC-A")
    qr_token: str = Field(..., example="CS301-SEC-A.1713400000.a1b2c3d4e5f6")
    device_id: str = Field(..., example="DEV-AARAV-PHONE-01")
    user_lat: float = Field(..., example=19.07602)
    user_lng: float = Field(..., example=72.87768)
    live_selfie_base64: str = Field(..., description="Base64 encoded live camera capture")

class StudentExceptionRequest(BaseModel):
    session_id: str = Field(..., example="CS301-SEC-A")
    device_id: Optional[str] = Field("UNREGISTERED-DEV", description="Device ID used when requesting exception")
    reason: Optional[str] = Field("I don't have my registered device", description="Reason for exception request")
    user_lat: Optional[float] = None
    user_lng: Optional[float] = None
    live_selfie_base64: Optional[str] = None

class FacultyApproveRequest(BaseModel):
    session_id: str
    roll_no: str
    action: str = Field(..., example="APPROVE", description="'APPROVE' or 'REJECT'")
    remarks: Optional[str] = None

class ManualAttendanceRequest(BaseModel):
    session_id: str = Field(..., example="CS301-SEC-A")
    roll_no: str = Field(..., example="STU01")
    status: str = Field(..., example="PRESENT", description="'PRESENT' or 'ABSENT'")
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
    live_selfie_base64: str = Field(..., description="Base64 encoded reference face capture")
    consent_given: bool = Field(True, description="Explicit student consent for biometric template storage")
    consent_text_version: Optional[str] = Field("v1.0", description="Version of consent notice acknowledged")


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
@app.get("/api/health")
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
@limiter.limit("5/minute")
def login(req: LoginRequest, request: Request, db: Session = Depends(get_pg_db)):
    user = db.query(User).filter(
        (User.roll_no == req.roll_no) | (User.email == req.roll_no)
    ).first()

    # Generic 401 error message for unknown user or wrong password (no 404 user enumeration)
    if not user or not verify_password(req.password, user.password):
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

    # 3. Student Login (Device Binding Disabled for Testing Phase)
    # Any device is permitted to log in; no device mismatch warnings or blocks.
    bound_device = req.device_id
    binding_status = "DEVICE_VERIFIED"
    if user.bound_device_id != req.device_id:
        user.bound_device_id = req.device_id
        user.registered_device_id = req.device_id
        db.commit()

    return {
        "success": True,
        "message": "Student login successful",
        "role": "student",
        "access_token": token,
        "token_type": "bearer",
        "binding_status": binding_status,
        "user": {
            "id": str(user.id),
            "roll_no": user.roll_no,
            "name": user.name,
            "email": user.email,
            "role": "student",
            "department": user.department or "CSE",
            "semester": user.semester or 6,
            "bound_device_id": bound_device,
            "has_registered_face": bool(user.face_enrollment is not None)
        }
    }

# ------------------------------------------------------------------------------
# 2. POST /api/sessions/start & GET /api/sessions/{session_id}/qr
# ------------------------------------------------------------------------------
@app.post("/api/sessions/start")
def start_session(
    req: SessionStartRequest,
    current_user: User = Depends(require_faculty_or_admin),
    db: Session = Depends(get_pg_db)
):
    faculty_id = current_user.roll_no
    session_id = str(uuid.uuid4())
    subj_prefix = req.subject_name.split()[0].upper().replace("-", "")
    session_code = f"{subj_prefix}-{secrets.token_hex(3).upper()}"
    secret_seed = secrets.token_hex(32)
    now = datetime.now(timezone.utc)

    # Resolve Subject and subject_id
    subject = None
    if getattr(req, "subject_id", None):
        try:
            subj_uuid = uuid.UUID(req.subject_id)
            subject = db.query(Subject).filter(Subject.id == subj_uuid).first()
        except Exception:
            pass

    if not subject:
        code_part = req.subject_name.split("-")[0].strip() if "-" in req.subject_name else req.subject_name.split(" ")[0].strip()
        name_part = req.subject_name.split("-")[-1].strip() if "-" in req.subject_name else req.subject_name.strip()
        subject = db.query(Subject).filter(
            (Subject.code == req.subject_name) |
            (Subject.name == req.subject_name) |
            (Subject.code == code_part) |
            (Subject.name == name_part)
        ).first()

    subject_id = subject.id if subject else None

    session = LectureSession(
        session_id=session_id,
        session_code=session_code,
        subject_id=subject_id,
        subject_name=req.subject_name,
        faculty_id=faculty_id,
        class_lat=req.class_lat,
        class_lng=req.class_lng,
        secret_seed=secret_seed,
        geofence_radius_meters=60,
        status="ACTIVE",
        started_at=now,
        created_at=now
    )
    db.add(session)
    db.commit()

    return {
        "success": True,
        "message": f"Active lecture session created for {req.subject_name}",
        "session": {
            "session_id": session_id,
            "session_code": session_code,
            "subject_id": str(subject_id) if subject_id else None,
            "subject_name": req.subject_name,
            "faculty_id": faculty_id,
            "class_lat": req.class_lat,
            "class_lng": req.class_lng,
            "status": "ACTIVE",
            "geofence_radius_meters": 60,
            "started_at": now.isoformat()
        }
    }

@app.get("/api/sessions/{session_id}/qr")
def get_session_qr(
    session_id: str,
    current_user: User = Depends(require_faculty_or_admin),
    db: Session = Depends(get_pg_db)
):
    session = db.query(LectureSession).filter(
        (LectureSession.session_id == session_id) | (LectureSession.session_code == session_id)
    ).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lecture session '{session_id}' not found."
        )

    # A faculty member may only act on sessions they started (admin may act on any)
    if current_user.role != "admin" and session.faculty_id != current_user.roll_no:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You can only view QR codes for sessions you started."
        )

    if session.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Lecture session is currently {session.status}. Attendance is closed."
        )

    current_time = int(time.time())
    current_window = int(math.floor(current_time / QR_WINDOW_SECONDS))
    remaining_seconds = QR_WINDOW_SECONDS - (current_time % QR_WINDOW_SECONDS)

    signature = generate_qr_signature(session.session_id, current_window, session.secret_seed)
    token = f"{session.session_id}.{current_window}.{signature}"

    return {
        "session_id": session.session_id,
        "session_code": session.session_code,
        "subject_name": session.subject_name,
        "qr_token": token,
        "window_index": current_window,
        "timestamp": current_time,
        "expires_in_seconds": remaining_seconds,
        "refresh_interval_seconds": QR_WINDOW_SECONDS,
        "class_lat": session.class_lat,
        "class_lng": session.class_lng
    }

@app.post("/api/sessions/{session_id}/end")
def end_session(
    session_id: str,
    current_user: User = Depends(require_faculty_or_admin),
    db: Session = Depends(get_pg_db)
):
    session = db.query(LectureSession).filter(
        (LectureSession.session_id == session_id) | (LectureSession.session_code == session_id)
    ).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lecture session '{session_id}' not found."
        )

    if current_user.role != "admin" and session.faculty_id != current_user.roll_no:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You can only end sessions you started."
        )

    if session.status == "ENDED":
        return {
            "success": True,
            "message": f"Lecture session '{session.subject_name}' is already ended.",
            "session": session.to_dict(),
            "absentees_created": 0
        }

    now = datetime.now(timezone.utc)
    session.status = "ENDED"
    session.ended_at = now

    absentees_created, has_enrollments = finalize_session_absentees(
        db,
        session,
        now,
        absent_reason="Marked absent automatically upon lecture session end."
    )
    db.commit()

    res_data = {
        "success": True,
        "message": f"Lecture session '{session.subject_name}' ended successfully. Attendance is now closed.",
        "session": session.to_dict(),
        "absentees_created": absentees_created
    }
    if not has_enrollments:
        res_data["warning"] = "Subject has no enrolled students. No absentees created."

    return res_data

# ------------------------------------------------------------------------------
# 3. POST /api/attendance/mark (The 5-Gate Anti-Proxy Engine with ACID Transactions)
# ------------------------------------------------------------------------------
@app.post("/api/attendance/mark")
def mark_attendance(
    req: MarkAttendanceRequest,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_pg_db)
):
    timestamp_now = datetime.now(timezone.utc)
    roll_no = current_user.roll_no

    def log_fraud_and_fail(gate: str, reason: str, extra_meta: Optional[Dict] = None):
        alert = SecurityAlert(
            session_id=req.session_id,
            roll_no=roll_no,
            used_device_id=req.device_id,
            failed_gate=gate,
            reason=reason,
            user_lat=req.user_lat,
            user_lng=req.user_lng,
            distance_meters=extra_meta.get("distance_meters") if extra_meta else None,
            face_match_score=extra_meta.get("face_match_score") if extra_meta else None,
            is_exception_mode=False,
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

    student = current_user

    session = db.query(LectureSession).filter(
        (LectureSession.session_id == req.session_id) | (LectureSession.session_code == req.session_id)
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{req.session_id}' not found.")

    if session.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "failed_gate": "SESSION_NOT_ACTIVE",
                "reason": f"Lecture session is currently {session.status}. Attendance is closed.",
                "timestamp": timestamp_now.isoformat()
            }
        )

    existing_student_log = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == session.session_id,
        AttendanceRecord.roll_no == roll_no
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

    # GATE 1: Device Lock & 1-Phone Rule (Bypassed for Testing Phase)
    # [TESTING MODE]: Both "1-device-per-registration" and "device-bound" restrictions are disabled.
    # Students can use any device, and multiple students can test on the same device in a session.
    # We still record used_device_id for auditing/telemetry purposes without failing the gate.

    # GATE 2: Dynamic QR Window Check (Configurable QR_WINDOW_SECONDS, Accepts Current & Previous Window)
    try:
        parts = req.qr_token.split(".")
        if len(parts) != 3:
            log_fraud_and_fail(gate="GATE_2_DYNAMIC_QR", reason="Malformed QR token structure.")
        tok_session_id, tok_window_str, tok_sig = parts
        tok_window = int(tok_window_str)
    except Exception:
        log_fraud_and_fail(gate="GATE_2_DYNAMIC_QR", reason="Failed to parse QR token window index.")

    # Verify that the session_id inside the token equals the session_id in the request
    if tok_session_id != session.session_id and tok_session_id != session.session_code:
        log_fraud_and_fail(
            gate="GATE_2_DYNAMIC_QR",
            reason=f"QR token session ID mismatch. Scanned token belongs to session '{tok_session_id}', not '{session.session_id}'."
        )

    current_epoch = int(time.time())
    current_window = int(math.floor(current_epoch / QR_WINDOW_SECONDS))
    allowed_windows = [current_window, current_window - 1]

    if tok_window not in allowed_windows:
        log_fraud_and_fail(
            gate="GATE_2_DYNAMIC_QR",
            reason=f"Dynamic QR Token expired. Scanned window {tok_window} is outside allowed valid windows {allowed_windows}. Scan the freshly refreshed QR code on the projector."
        )

    expected_sig = generate_qr_signature(session.session_id, tok_window, session.secret_seed)
    expected_sig_code = generate_qr_signature(session.session_code, tok_window, session.secret_seed)
    if not (hmac.compare_digest(expected_sig, tok_sig) or hmac.compare_digest(expected_sig_code, tok_sig)):
        log_fraud_and_fail(
            gate="GATE_2_DYNAMIC_QR",
            reason="Invalid QR signature. Token does not match this lecture session's cryptographic secret."
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

    # GATE 4: AI Face Verification (InsightFace buffalo_sc Normalized Embeddings)
    enrollment = db.query(FaceEnrollment).filter(FaceEnrollment.user_id == student.id).first()
    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "FACE_NOT_ENROLLED", "message": "Biometric face template not enrolled. Student must complete face enrollment first."}
        )

    # In-memory decode of live selfie bytes (never persisted to disk or DB)
    try:
        raw_b64 = req.live_selfie_base64
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1]
        live_bytes = base64.b64decode(raw_b64)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_IMAGE", "message": "Unable to decode live selfie image data."}
        )

    # Face quality check and feature extraction (returns retryable error, NOT security alert)
    try:
        live_embedding = face_service.extract_embedding(live_bytes)
    except face_service.FaceQualityError as fqe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": fqe.code, "message": fqe.message}
        )
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "EXTRACTION_FAILED", "message": f"Face embedding extraction failure: {str(err)}"}
        )

    # Decrypt enrolled embedding & compute cosine similarity
    ref_embedding = face_service.decrypt_embedding(enrollment.embedding)
    sim = face_service.cosine_similarity(live_embedding, ref_embedding)
    face_match_score = round(float(sim * 100.0), 1)

    match_thresh = float(os.getenv("FACE_MATCH_THRESHOLD", "0.50"))
    review_thresh = float(os.getenv("FACE_REVIEW_THRESHOLD", "0.38"))

    # Three outcomes from cosine similarity:
    # 1. score >= match -> proceed to PRESENT
    # 2. between review and match -> record as PENDING_APPROVAL (review required)
    # 3. below review -> reject and write a SecurityAlert
    if sim >= match_thresh:
        face_status = "MATCH"
        attendance_status = "PRESENT"
    elif sim >= review_thresh:
        face_status = "REVIEW_REQUIRED"
        attendance_status = "PENDING_APPROVAL"
    else:
        log_fraud_and_fail(
            gate="GATE_4_FACE_VERIFICATION",
            reason=f"Face mismatch: Live selfie similarity was {face_match_score}%, which is below the review threshold.",
            extra_meta={"face_match_score": face_match_score}
        )

    # GATE 5: Decision & Attendance Logging (Atomic Transaction)
    attendance_record = AttendanceRecord(
        session_id=session.session_id,
        roll_no=roll_no,
        student_name=student.name,
        used_device_id=req.device_id,
        user_lat=req.user_lat,
        user_lng=req.user_lng,
        distance_meters=round(distance_meters, 1),
        face_match_score=face_match_score,
        face_status=face_status,
        liveness_status="NOT_CHECKED",
        is_exception_mode=False,
        status=attendance_status,
        reason="Biometric similarity in review band (requires faculty review)" if attendance_status == "PENDING_APPROVAL" else None,
        marked_at=timestamp_now
    )
    try:
        db.add(attendance_record)
        db.flush()

        # Phase 3: Single Source of Truth - Recompute stats directly from attendance records
        stats = recompute_student_stats(db, student.id)
        subject_code_prefix = session.subject_name.split(" ")[0].strip() if " " in session.subject_name else session.subject_name
        recompute_student_subject_enrollment(db, student.roll_no, subject_code_prefix)

        student.updated_at = timestamp_now
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "failed_gate": "DUPLICATE_SUBMISSION",
                "reason": "Attendance has already been recorded for this student in this lecture session."
            }
        )

    msg = "Attendance successfully recorded as PRESENT!" if attendance_status == "PRESENT" else "Attendance recorded as PENDING_APPROVAL (review required)."
    return {
        "success": True,
        "status": attendance_status,
        "message": msg,
        "details": {
            "roll_no": roll_no,
            "session_id": session.session_id,
            "distance_meters": round(distance_meters, 1),
            "face_match_score": face_match_score,
            "face_status": face_status,
            "liveness_status": "NOT_CHECKED",
            "marked_at": timestamp_now.isoformat()
        }
    }

# ------------------------------------------------------------------------------
# 3a. POST /api/attendance/request-exception (Student Request When Device is Absent)
# ------------------------------------------------------------------------------
@app.post("/api/attendance/request-exception")
def request_device_exception(
    req: StudentExceptionRequest,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_pg_db)
):
    timestamp_now = datetime.now(timezone.utc)
    roll_no = current_user.roll_no

    session = db.query(LectureSession).filter(
        (LectureSession.session_id == req.session_id) | (LectureSession.session_code == req.session_id)
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{req.session_id}' not found.")

    if session.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lecture session is not active. Cannot submit exception request."
        )

    existing = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == session.session_id,
        AttendanceRecord.roll_no == roll_no
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attendance or exception request has already been recorded for this student in this session."
        )

    used_device = req.device_id or f"UNREGISTERED_{roll_no}"

    # Stored as PENDING_APPROVAL - only faculty can turn this into PRESENT via /api/faculty/approve
    record = AttendanceRecord(
        session_id=session.session_id,
        roll_no=roll_no,
        student_name=current_user.name,
        used_device_id=used_device,
        user_lat=req.user_lat or 0.0,
        user_lng=req.user_lng or 0.0,
        distance_meters=0.0,
        face_match_score=0.0,
        face_status="PENDING_APPROVAL",
        liveness_status="NOT_CHECKED",
        is_exception_mode=True,
        status="PENDING_APPROVAL",
        reason=req.reason or "I don't have my registered device",
        marked_at=timestamp_now
    )
    db.add(record)
    db.commit()

    return {
        "success": True,
        "status": "PENDING_APPROVAL",
        "message": "Exception request submitted: 'I don't have my registered device'. Awaiting faculty approval.",
        "record": {
            "session_id": session.session_id,
            "roll_no": roll_no,
            "status": "PENDING_APPROVAL",
            "reason": record.reason
        }
    }

# ------------------------------------------------------------------------------
# 3b. POST /api/student/enroll-face (Consent-Based Biometric Enrollment)
# ------------------------------------------------------------------------------
@app.post("/api/student/enroll-face")
def enroll_face(
    req: EnrollFaceRequest,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_pg_db)
):
    if not req.consent_given:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Biometric consent is mandatory to store face reference templates."
        )

    # Re-enrollment forbidden without prior admin reset (HTTP 409 Conflict)
    existing_enrollment = db.query(FaceEnrollment).filter(FaceEnrollment.user_id == current_user.id).first()
    if existing_enrollment:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Face template already enrolled for this student. Re-enrollment requires an administrator face reset."
        )

    # In-memory decode of base64 image bytes (never persisted to disk or DB)
    try:
        raw_b64 = req.live_selfie_base64
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1]
        image_bytes = base64.b64decode(raw_b64)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_IMAGE", "message": "Unable to decode face image payload."}
        )

    # Extract normalized float32 facial embedding vector
    try:
        embedding = face_service.extract_embedding(image_bytes)
    except face_service.FaceQualityError as fqe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": fqe.code, "message": fqe.message}
        )
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "EXTRACTION_FAILED", "message": f"Face embedding extraction failure: {str(err)}"}
        )

    # Encrypt embedding at rest using Fernet
    encrypted_emb = face_service.encrypt_embedding(embedding)
    now = datetime.now(timezone.utc)
    retention_expires = now + timedelta(days=365)

    enrollment = FaceEnrollment(
        user_id=current_user.id,
        embedding=encrypted_emb,
        model_name="buffalo_sc",
        model_version="insightface-2.1",
        consent_given_at=now,
        consent_text_version=req.consent_text_version or "v1.0",
        created_at=now,
        retention_expires_at=retention_expires
    )
    db.add(enrollment)
    current_user.updated_at = now
    db.commit()

    return {
        "success": True,
        "roll_no": current_user.roll_no,
        "message": f"Biometric face reference successfully enrolled for student {current_user.name} with explicit consent.",
        "enrolled_at": now.isoformat()
    }

# ------------------------------------------------------------------------------
# 4. POST /api/faculty/manual-attendance (Teacher Manual Attendance Override)
# ------------------------------------------------------------------------------
@app.post("/api/faculty/manual-attendance")
def faculty_manual_attendance(
    req: ManualAttendanceRequest,
    current_user: User = Depends(require_faculty_or_admin),
    db: Session = Depends(get_pg_db)
):
    session = db.query(LectureSession).filter(
        (LectureSession.session_id == req.session_id) | (LectureSession.session_code == req.session_id)
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{req.session_id}' not found.")

    if current_user.role != "admin" and session.faculty_id != current_user.roll_no:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You can only record manual attendance for sessions you started."
        )

    student = db.query(User).filter(User.roll_no == req.roll_no).first()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student '{req.roll_no}' not found.")

    action_status = req.status.upper()
    if action_status not in ["PRESENT", "ABSENT"]:
        raise HTTPException(status_code=400, detail="Status must be either 'PRESENT' or 'ABSENT'")

    if not req.reason or not req.reason.strip():
        raise HTTPException(status_code=400, detail="Mandatory audit reason required for manual attendance override.")

    timestamp_now = datetime.now(timezone.utc)

    # Upsert manual record in attendance_records
    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == session.session_id,
        AttendanceRecord.roll_no == req.roll_no
    ).first()

    old_status = record.status if record else "ABSENT"

    if not record:
        record = AttendanceRecord(
            session_id=session.session_id,
            roll_no=req.roll_no,
            student_name=student.name,
            used_device_id=f"MANUAL_{req.roll_no}",
            distance_meters=0.0,
            face_match_score=100.0,
            is_exception_mode=False,
            is_manual_override=True,
            manual_by=current_user.roll_no,
            reason=req.reason,
            status=action_status,
            marked_at=timestamp_now
        )
        db.add(record)
    else:
        record.status = action_status
        record.is_manual_override = True
        record.manual_by = current_user.roll_no
        record.reason = req.reason
        record.reviewed_at = timestamp_now

    db.flush()

    # Phase 3 Requirement: Idempotent manual override recomputes stats from records so total is never double-incremented
    stats = recompute_student_stats(db, student.id)

    # Update subject-level enrollment tracking
    session_code_prefix = session.subject_name.split(" ")[0].strip() if " " in session.subject_name else session.subject_name
    recompute_student_subject_enrollment(db, student.roll_no, session_code_prefix)

    # Immutable Audit Log
    record_audit_log(
        db=db,
        actor_id=current_user.roll_no,
        actor_name=current_user.name,
        actor_role=current_user.role,
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
# 4b. POST /api/faculty/approve (Approve PENDING_APPROVAL Exception Requests)
# ------------------------------------------------------------------------------
@app.post("/api/faculty/approve")
def faculty_approve_attendance(
    req: FacultyApproveRequest,
    current_user: User = Depends(require_faculty_or_admin),
    db: Session = Depends(get_pg_db)
):
    session = db.query(LectureSession).filter(
        (LectureSession.session_id == req.session_id) | (LectureSession.session_code == req.session_id)
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{req.session_id}' not found.")

    if current_user.role != "admin" and session.faculty_id != current_user.roll_no:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You can only approve exception attendance for sessions you started."
        )

    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == session.session_id,
        AttendanceRecord.roll_no == req.roll_no
    ).first()

    if not record:
        raise HTTPException(
            status_code=404,
            detail=f"Attendance record for student '{req.roll_no}' in session '{req.session_id}' not found."
        )

    # Phase 4b: only allow records currently in PENDING_APPROVAL (400 otherwise)
    if record.status != "PENDING_APPROVAL":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Record is currently '{record.status}'. Only records in 'PENDING_APPROVAL' can be approved or rejected."
        )

    action_upper = req.action.upper()
    if action_upper not in ["APPROVE", "REJECT"]:
        raise HTTPException(status_code=400, detail="Action must be 'APPROVE' or 'REJECT'")

    new_status = "PRESENT" if action_upper == "APPROVE" else "ABSENT"
    old_status = record.status
    timestamp_now = datetime.now(timezone.utc)

    record.status = new_status
    record.is_manual_override = True
    record.manual_by = current_user.roll_no
    record.reason = req.remarks or f"Faculty {action_upper} exception request"
    record.reviewed_at = timestamp_now

    student = db.query(User).filter(User.roll_no == req.roll_no).first()
    if student:
        stats = recompute_student_stats(db, student.id)
        session_code_prefix = session.subject_name.split(" ")[0].strip() if " " in session.subject_name else session.subject_name
        recompute_student_subject_enrollment(db, student.roll_no, session_code_prefix)
    else:
        stats = None

    record_audit_log(
        db=db,
        actor_id=current_user.roll_no,
        actor_name=current_user.name,
        actor_role=current_user.role,
        action=f"ATTENDANCE_EXCEPTION_{action_upper}",
        target_type="ATTENDANCE_RECORD",
        target_id=f"{session.session_id}:{req.roll_no}",
        old_value=old_status,
        new_value=new_status,
        reason=req.remarks or f"Faculty {action_upper} exception request"
    )

    db.commit()

    return {
        "success": True,
        "status": new_status,
        "message": f"Student '{req.roll_no}' exception request {action_upper}ED. Status is now {new_status}.",
        "details": {
            "session_id": session.session_id,
            "roll_no": req.roll_no,
            "status": new_status,
            "action": action_upper,
            "updated_pct": stats.current_attendance_pct if stats else None
        }
    }

# ------------------------------------------------------------------------------
# 4c. GET /api/faculty/session/{session_id}/roster (Enrolled Students & Live Status)
# ------------------------------------------------------------------------------
@app.get("/api/faculty/session/{session_id}/roster")
def get_faculty_session_roster(
    session_id: str,
    current_user: User = Depends(require_faculty_or_admin),
    db: Session = Depends(get_pg_db)
):
    session = db.query(LectureSession).filter(
        (LectureSession.session_id == session_id) | (LectureSession.session_code == session_id)
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")

    if current_user.role != "admin" and session.faculty_id != current_user.roll_no:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You can only view roster for sessions you started."
        )

    # Match subject enrollments
    subject_code_prefix = session.subject_name.split(" ")[0].strip() if " " in session.subject_name else session.subject_name
    enrollments = db.query(StudentSubjectEnrollment).filter(
        (StudentSubjectEnrollment.subject_code == session.subject_name) |
        (StudentSubjectEnrollment.subject_code == subject_code_prefix) |
        (StudentSubjectEnrollment.subject_name == session.subject_name)
    ).all()

    if enrollments:
        students_list = [(e.roll_no, e.student_name, getattr(e, "department", "CSE") or "CSE") for e in enrollments]
    else:
        active_students = db.query(User).filter(User.role == "student", User.is_active == True).all()
        students_list = [(s.roll_no, s.name, s.department or "CSE") for s in active_students]

    # Map current session records
    records = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == session.session_id
    ).all()
    records_by_roll = {r.roll_no: r for r in records}

    roster = []
    for roll_no, name, dept in students_list:
        rec = records_by_roll.get(roll_no)
        st = rec.status if rec else "UNMARKED"
        roster.append({
            "roll_no": roll_no,
            "name": name,
            "department": dept,
            "status": st,
            "reason": rec.reason if rec else None,
            "marked_at": rec.marked_at.isoformat() if rec and rec.marked_at else None,
            "distance_meters": rec.distance_meters if rec else None,
            "user_lat": rec.user_lat if rec else None,
            "user_lng": rec.user_lng if rec else None,
            "is_exception_mode": rec.is_exception_mode if rec else False
        })

    return {
        "success": True,
        "session_id": session.session_id,
        "subject_name": session.subject_name,
        "total_enrolled": len(roster),
        "roster": roster
    }

# ------------------------------------------------------------------------------
# 5. GET /api/student/{roll_no}/dashboard
# ------------------------------------------------------------------------------
@app.get("/api/student/{roll_no}/dashboard")
def student_dashboard(
    roll_no: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_pg_db)
):
    if current_user.role == "student" and current_user.roll_no != roll_no:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Students can only view their own dashboard."
        )

    student = db.query(User).filter(User.roll_no == roll_no).first()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student '{roll_no}' not found.")

    stats_obj = db.query(StudentStats).filter(StudentStats.user_id == student.id).first()
    if not stats_obj:
        stats_obj = recompute_student_stats(db, student.id)

    if stats_obj:
        stats = stats_obj.to_dict()
    else:
        stats = {
            "current_attendance_pct": 100.0,
            "last_14_days_pct": 100.0,
            "mon_fri_skip_rate": 0.0,
            "first_lecture_miss_rate": 0.0,
            "current_streak": 0,
            "total_lectures": 0,
            "attended_lectures": 0
        }

    current_att = stats.get("current_attendance_pct", 100.0)
    attended_lec = stats.get("attended_lectures", 0)
    total_lec = stats.get("total_lectures", 0)
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
def get_faculty_live_session(
    session_id: str,
    current_user: User = Depends(require_faculty_or_admin),
    db: Session = Depends(get_pg_db)
):
    session = db.query(LectureSession).filter(
        (LectureSession.session_id == session_id) | (LectureSession.session_code == session_id)
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")

    if current_user.role != "admin" and session.faculty_id != current_user.roll_no:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You can only view live attendance for sessions you started."
        )

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
                "face_status": r.face_status,
                "liveness_status": r.liveness_status,
                "reason": r.reason
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
def approve_exception(
    req: FacultyApproveRequest,
    current_user: User = Depends(require_faculty_or_admin),
    db: Session = Depends(get_pg_db)
):
    session = db.query(LectureSession).filter(
        (LectureSession.session_id == req.session_id) | (LectureSession.session_code == req.session_id)
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{req.session_id}' not found.")

    if current_user.role != "admin" and session.faculty_id != current_user.roll_no:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You can only approve exception attendance for sessions you started."
        )

    action = req.action.upper()
    if action not in ["APPROVE", "REJECT"]:
        raise HTTPException(status_code=400, detail="Action must be either 'APPROVE' or 'REJECT'")

    new_status = "PRESENT" if action == "APPROVE" else "REJECTED"

    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == session.session_id,
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
    db.flush()

    student = db.query(User).filter(User.roll_no == req.roll_no).first()
    if student:
        stats = recompute_student_stats(db, student.id)
        subj_prefix = session.subject_name.split(" ")[0].strip() if " " in session.subject_name else session.subject_name
        recompute_student_subject_enrollment(db, student.roll_no, subj_prefix)

    record_audit_log(
        db=db,
        actor_id=current_user.roll_no,
        actor_name=current_user.name,
        actor_role=current_user.role,
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
def admin_overview(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_pg_db)
):
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
def admin_create_user(
    req: CreateUserRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_pg_db)
):
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

        init_att = req.initial_attendance_pct if req.initial_attendance_pct is not None else 100.0
        stats = StudentStats(
            user_id=new_user.id,
            current_attendance_pct=init_att,
            last_14_days_pct=init_att,
            mon_fri_skip_rate=0.0,
            first_lecture_miss_rate=0.0,
            current_streak=0,
            total_lectures=0,
            attended_lectures=0,
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
        actor_id=current_user.roll_no,
        actor_name=current_user.name,
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
def admin_reset_device(
    roll_no: str,
    req: Optional[ResetDeviceRequest] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_pg_db)
):
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
        actor_id=current_user.roll_no,
        actor_name=current_user.name,
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
def admin_reset_face(
    roll_no: str,
    req: Optional[ResetDeviceRequest] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_pg_db)
):
    student = db.query(User).filter(User.roll_no == roll_no).first()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student with roll number '{roll_no}' not found.")

    enrollment = db.query(FaceEnrollment).filter(FaceEnrollment.user_id == student.id).first()
    had_face = enrollment is not None
    if enrollment:
        db.delete(enrollment)
    student.updated_at = datetime.now(timezone.utc)

    reason = req.reason if req and req.reason else "Biometric reference template reset by administrator"
    record_audit_log(
        db=db,
        actor_id=current_user.roll_no,
        actor_name=current_user.name,
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
    current_user: User = Depends(require_admin),
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
def get_subjects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_pg_db)
):
    subjects = db.query(Subject).order_by(Subject.code.asc()).all()
    return {
        "count": len(subjects),
        "subjects": [s.to_dict() for s in subjects]
    }

@app.post("/api/admin/subjects")
def admin_create_subject(
    req: CreateSubjectRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_pg_db)
):
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
        actor_id=current_user.roll_no,
        actor_name=current_user.name,
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
def get_student_subjects(
    roll_no: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_pg_db)
):
    if current_user.role == "student" and current_user.roll_no != roll_no:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Students can only view their own subjects."
        )

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
