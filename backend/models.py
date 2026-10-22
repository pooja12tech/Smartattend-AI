import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import (
    String, Integer, Float, Boolean, Text, DateTime, LargeBinary,
    ForeignKey, UniqueConstraint, Index
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db_postgres import Base

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

# ==============================================================================
# 1. Users Model (Students, Faculty, Admins)
# ==============================================================================
class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    roll_no: Mapped[Optional[str]] = mapped_column(String(64), unique=True, index=True, nullable=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default="student")  # 'student', 'faculty', 'admin'
    department: Mapped[str] = mapped_column(String(255), default="Computer Science & Engineering")
    semester: Mapped[Optional[int]] = mapped_column(Integer, default=6, nullable=True)
    bound_device_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    registered_device_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    # Relationships
    stats: Mapped[Optional["StudentStats"]] = relationship(
        "StudentStats", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    face_enrollment: Mapped[Optional["FaceEnrollment"]] = relationship(
        "FaceEnrollment", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "roll_no": self.roll_no,
            "faculty_id": self.roll_no if self.role == "faculty" else None,
            "admin_id": self.roll_no if self.role == "admin" else None,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "department": self.department,
            "semester": self.semester,
            "bound_device_id": self.bound_device_id,
            "registered_device_id": self.registered_device_id,
            "has_registered_face": bool(self.face_enrollment is not None),
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

# ==============================================================================
# 2. Student Statistics (Attendance, ML Features, Momentum)
# ==============================================================================
class StudentStats(Base):
    __tablename__ = "student_stats"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    current_attendance_pct: Mapped[float] = mapped_column(Float, default=100.0)
    last_14_days_pct: Mapped[float] = mapped_column(Float, default=100.0)
    mon_fri_skip_rate: Mapped[float] = mapped_column(Float, default=0.0)
    first_lecture_miss_rate: Mapped[float] = mapped_column(Float, default=0.0)
    current_streak: Mapped[int] = mapped_column(Integer, default=0)
    total_lectures: Mapped[int] = mapped_column(Integer, default=0)
    attended_lectures: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="stats")

    def to_dict(self) -> dict:
        return {
            "current_attendance_pct": self.current_attendance_pct,
            "last_14_days_pct": self.last_14_days_pct,
            "mon_fri_skip_rate": self.mon_fri_skip_rate,
            "first_lecture_miss_rate": self.first_lecture_miss_rate,
            "current_streak": self.current_streak,
            "total_lectures": self.total_lectures,
            "attended_lectures": self.attended_lectures,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

# ==============================================================================
# 3. Lecture Sessions (Classroom Coordinates, Active QR Seed, Status)
# ==============================================================================
class LectureSession(Base):
    __tablename__ = "lecture_sessions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    subject_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True, index=True
    )
    session_id: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    session_code: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    subject_name: Mapped[str] = mapped_column(String(255), nullable=False)
    faculty_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    room_no: Mapped[str] = mapped_column(String(64), default="LAB-302")
    class_lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True, default=None)
    class_lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True, default=None)
    geofence_radius_meters: Mapped[int] = mapped_column(Integer, default=150)
    secret_seed: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="ACTIVE")  # 'ACTIVE', 'ENDED', 'COMPLETED', 'CANCELLED'
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    # Relationships
    attendance_records: Mapped[List["AttendanceRecord"]] = relationship(
        "AttendanceRecord", back_populates="session", cascade="all, delete-orphan"
    )
    security_alerts: Mapped[List["SecurityAlert"]] = relationship(
        "SecurityAlert", back_populates="session", cascade="all, delete-orphan"
    )

    def to_dict(self) -> dict:
        return {
            "session_id": self.session_id,
            "session_code": self.session_code,
            "subject_id": str(self.subject_id) if self.subject_id else None,
            "subject_name": self.subject_name,
            "faculty_id": self.faculty_id,
            "room_no": self.room_no,
            "class_lat": self.class_lat,
            "class_lng": self.class_lng,
            "geofence_radius_meters": self.geofence_radius_meters,
            "status": self.status,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

# ==============================================================================
# 4. Attendance Records (Enforces Double-Attendance & Anti-Proxy Uniqueness)
# ==============================================================================
class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("lecture_sessions.session_id", ondelete="CASCADE"), index=True, nullable=False
    )
    roll_no: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    student_name: Mapped[str] = mapped_column(String(255), default="Student")
    used_device_id: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    user_lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    user_lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    distance_meters: Mapped[float] = mapped_column(Float, default=0.0)
    face_match_score: Mapped[float] = mapped_column(Float, default=100.0)
    face_status: Mapped[str] = mapped_column(String(64), default="VERIFIED")
    is_exception_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    is_manual_override: Mapped[bool] = mapped_column(Boolean, default=False)
    manual_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="PRESENT")  # 'PRESENT', 'ABSENT', 'PENDING_APPROVAL', 'REJECTED'
    liveness_status: Mapped[str] = mapped_column(String(32), default="NOT_CHECKED", nullable=False)
    marked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    session: Mapped["LectureSession"] = relationship("LectureSession", back_populates="attendance_records")

    __table_args__ = (
        # Prevent same student attending twice in the same session
        UniqueConstraint("session_id", "roll_no", name="uq_session_student"),
        # Anti-Proxy 1-Phone constraint disabled for testing phase:
        # UniqueConstraint("session_id", "used_device_id", name="uq_session_device"),
        Index("idx_attendance_roll_marked", "roll_no", "marked_at"),
    )

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "session_id": self.session_id,
            "roll_no": self.roll_no,
            "student_name": self.student_name,
            "used_device_id": self.used_device_id,
            "user_lat": self.user_lat,
            "user_lng": self.user_lng,
            "distance_meters": self.distance_meters,
            "face_match_score": self.face_match_score,
            "face_status": self.face_status,
            "liveness_status": self.liveness_status,
            "is_exception_mode": self.is_exception_mode,
            "is_manual_override": self.is_manual_override,
            "manual_by": self.manual_by,
            "reason": self.reason,
            "status": self.status,
            "marked_at": self.marked_at.isoformat() if self.marked_at else None,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "remarks": self.remarks
        }

# ==============================================================================
# 5. Security Alerts (Forensics for Breached Anti-Proxy Gates)
# ==============================================================================
class SecurityAlert(Base):
    __tablename__ = "security_alerts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("lecture_sessions.session_id", ondelete="CASCADE"), index=True, nullable=False
    )
    roll_no: Mapped[Optional[str]] = mapped_column(String(64), index=True, nullable=True)
    used_device_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    failed_gate: Mapped[str] = mapped_column(String(64), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    user_lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    user_lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    distance_meters: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    face_match_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_exception_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    # Relationships
    session: Mapped["LectureSession"] = relationship("LectureSession", back_populates="security_alerts")

    __table_args__ = (
        Index("idx_alerts_session_time", "session_id", "created_at"),
    )

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "session_id": self.session_id,
            "roll_no": self.roll_no,
            "device_id": self.used_device_id,
            "failed_gate": self.failed_gate,
            "reason": self.reason,
            "user_lat": self.user_lat,
            "user_lng": self.user_lng,
            "distance_meters": self.distance_meters,
            "face_match_score": self.face_match_score,
            "is_exception_mode": self.is_exception_mode,
            "resolved": self.resolved,
            "timestamp": self.created_at.isoformat() if self.created_at else None
        }

# ==============================================================================
# 6. Academic Subject Model
# ==============================================================================
class Subject(Base):
    __tablename__ = "subjects"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[str] = mapped_column(String(255), default="Computer Science & Engineering")
    semester: Mapped[int] = mapped_column(Integer, default=6)
    faculty_id: Mapped[Optional[str]] = mapped_column(String(64), index=True, nullable=True)
    faculty_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    credits: Mapped[int] = mapped_column(Integer, default=4)
    min_attendance_pct: Mapped[float] = mapped_column(Float, default=75.0)
    total_conducted: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "code": self.code,
            "name": self.name,
            "department": self.department,
            "semester": self.semester,
            "faculty_id": self.faculty_id,
            "faculty_name": self.faculty_name,
            "credits": self.credits,
            "min_attendance_pct": self.min_attendance_pct,
            "total_conducted": self.total_conducted,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

# ==============================================================================
# 7. Student-Subject Enrollment (Per-Subject Attendance Tracking)
# ==============================================================================
class StudentSubjectEnrollment(Base):
    __tablename__ = "student_subject_enrollments"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    roll_no: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    student_name: Mapped[str] = mapped_column(String(255), default="Student")
    subject_code: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    subject_name: Mapped[str] = mapped_column(String(255), default="")
    total_classes: Mapped[int] = mapped_column(Integer, default=0)
    attended_classes: Mapped[int] = mapped_column(Integer, default=0)
    current_pct: Mapped[float] = mapped_column(Float, default=100.0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    __table_args__ = (
        UniqueConstraint("roll_no", "subject_code", name="uq_student_subject"),
        Index("idx_enrollment_roll_subject", "roll_no", "subject_code"),
    )

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "roll_no": self.roll_no,
            "student_name": self.student_name,
            "subject_code": self.subject_code,
            "subject_name": self.subject_name,
            "total_classes": self.total_classes,
            "attended_classes": self.attended_classes,
            "current_pct": round(self.current_pct, 1),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

# ==============================================================================
# 8. Audit Trail Log (Mandatory Logging of Overrides, Resets, and Changes)
# ==============================================================================
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    actor_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    actor_name: Mapped[str] = mapped_column(String(255), nullable=False)
    actor_role: Mapped[str] = mapped_column(String(32), nullable=False)  # 'faculty', 'admin', 'system'
    action: Mapped[str] = mapped_column(String(64), index=True, nullable=False)  # 'MANUAL_ATTENDANCE_OVERRIDE', 'DEVICE_RESET', 'FACE_RESET', etc.
    target_type: Mapped[str] = mapped_column(String(64), nullable=False)  # 'ATTENDANCE_RECORD', 'USER', 'SESSION'
    target_id: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    old_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    new_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)

    __table_args__ = (
        Index("idx_audit_actor_time", "actor_id", "created_at"),
        Index("idx_audit_action_time", "action", "created_at"),
    )

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "actor_id": self.actor_id,
            "actor_name": self.actor_name,
            "actor_role": self.actor_role,
            "action": self.action,
            "target_type": self.target_type,
            "target_id": self.target_id,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "reason": self.reason,
            "ip_address": self.ip_address,
            "timestamp": self.created_at.isoformat() if self.created_at else None
        }

# ==============================================================================
# 9. Face Enrollments (Fernet-Encrypted Normalized Float32 Embeddings at Rest)
# ==============================================================================
class FaceEnrollment(Base):
    __tablename__ = "face_enrollments"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    embedding: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    model_name: Mapped[str] = mapped_column(String(64), default="buffalo_sc", nullable=False)
    model_version: Mapped[str] = mapped_column(String(32), default="insightface-2.1", nullable=False)
    consent_given_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    consent_text_version: Mapped[str] = mapped_column(String(32), default="v1.0", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    retention_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="face_enrollment")

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "model_name": self.model_name,
            "model_version": self.model_version,
            "consent_given_at": self.consent_given_at.isoformat() if self.consent_given_at else None,
            "consent_text_version": self.consent_text_version,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "retention_expires_at": self.retention_expires_at.isoformat() if self.retention_expires_at else None
        }


