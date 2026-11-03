import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import (
    String, Integer, Float, Boolean, Text, DateTime, LargeBinary,
    ForeignKey, UniqueConstraint, Index, CheckConstraint
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
    section: Mapped[Optional[str]] = mapped_column(String(16), default="A", nullable=True)
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
        sess = getattr(self, "session", None)
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
            "section": self.section or "A",
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
        sess = getattr(self, "session", None)
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
    challenge_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
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
            "challenge_id": self.challenge_id,
            "is_exception_mode": self.is_exception_mode,
            "is_manual_override": self.is_manual_override,
            "manual_by": self.manual_by,
            "reason": self.reason,
            "status": self.status,
            "marked_at": self.marked_at.isoformat() if self.marked_at else None,
            "timestamp": self.marked_at.isoformat() if self.marked_at else None,
            "date": self.marked_at.isoformat() if self.marked_at else None,
            "subject_name": getattr(getattr(self, "session", None), "subject_name", None),
            "room": getattr(getattr(self, "session", None), "room_no", None),
            "faculty_name": getattr(getattr(self, "session", None), "faculty_id", None),
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

# ==============================================================================
# 10. Student Attendance Notifications & Threshold Alerts (< 74%)
# ==============================================================================
class StudentNotification(Base):
    __tablename__ = "student_notifications"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=True
    )
    roll_no: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    type: Mapped[str] = mapped_column(String(64), default="ATTENDANCE_DEFICIT_WARNING", nullable=False)
    severity: Mapped[str] = mapped_column(String(32), default="CRITICAL", nullable=False)  # 'CRITICAL', 'WARNING', 'INFO'
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    subject_code: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)  # e.g. "CS301" or "OVERALL"
    subject_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    current_pct: Mapped[float] = mapped_column(Float, nullable=False)
    threshold_pct: Mapped[float] = mapped_column(Float, default=75.0, nullable=False)
    alert_cutoff_pct: Mapped[float] = mapped_column(Float, default=74.0, nullable=False)
    classes_needed: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    is_dismissed: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)

    # Relationships
    user: Mapped[Optional["User"]] = relationship("User")

    __table_args__ = (
        Index("idx_notif_roll_unread", "roll_no", "is_read", "is_dismissed"),
        Index("idx_notif_roll_time", "roll_no", "created_at"),
    )

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "roll_no": self.roll_no,
            "type": self.type,
            "severity": self.severity,
            "title": self.title,
            "message": self.message,
            "subject_code": self.subject_code,
            "subject_name": self.subject_name,
            "current_pct": round(self.current_pct, 1),
            "threshold_pct": self.threshold_pct,
            "alert_cutoff_pct": self.alert_cutoff_pct,
            "classes_needed": self.classes_needed,
            "is_read": self.is_read,
            "is_dismissed": self.is_dismissed,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

# ==============================================================================
# 11. Timetable Entries (Role-Based Weekly Academic Schedule)
# ==============================================================================
class TimetableEntry(Base):
    __tablename__ = "timetable_entries"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    subject_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True, index=True
    )
    subject_code: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    subject_name: Mapped[str] = mapped_column(String(255), nullable=False)
    faculty_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    faculty_name: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    semester: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    section: Mapped[str] = mapped_column(String(16), default="A", index=True, nullable=False)
    academic_year: Mapped[str] = mapped_column(String(32), default="2025-2026", nullable=False)
    room_no: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    day_of_week: Mapped[str] = mapped_column(String(16), index=True, nullable=False)
    start_time: Mapped[str] = mapped_column(String(8), nullable=False)
    end_time: Mapped[str] = mapped_column(String(8), nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, index=True, nullable=False)
    created_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    updated_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    # Relationships
    subject: Mapped[Optional["Subject"]] = relationship("Subject")

    __table_args__ = (
        CheckConstraint("end_time > start_time", name="ck_timetable_time_range"),
        Index("idx_timetable_faculty_slot", "faculty_id", "day_of_week"),
        Index("idx_timetable_class_slot", "department", "semester", "section", "day_of_week"),
        Index("idx_timetable_room_slot", "room_no", "day_of_week"),
    )

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "subject_id": str(self.subject_id) if self.subject_id else None,
            "subject_code": self.subject_code,
            "subject_name": self.subject_name,
            "faculty_id": self.faculty_id,
            "faculty_name": self.faculty_name,
            "department": self.department,
            "semester": self.semester,
            "section": self.section,
            "academic_year": self.academic_year,
            "room_no": self.room_no,
            "day_of_week": self.day_of_week,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "is_published": self.is_published,
            "created_by": self.created_by,
            "updated_by": self.updated_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


# ==============================================================================
# 12. Server-Issued Liveness Challenges (Phase 4B Single-Use Replay Protection)
# ==============================================================================
class LivenessChallenge(Base):
    __tablename__ = "liveness_challenges"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    challenge_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("lecture_sessions.session_id", ondelete="CASCADE"), index=True, nullable=False
    )
    roll_no: Mapped[str] = mapped_column(
        ForeignKey("users.roll_no", ondelete="CASCADE"), index=True, nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    is_consumed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    consumed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    __table_args__ = (
        Index("idx_challenge_lookup", "challenge_id", "roll_no", "session_id", "is_consumed"),
        Index("idx_challenge_expiry", "expires_at"),
    )

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "challenge_id": self.challenge_id,
            "session_id": self.session_id,
            "roll_no": self.roll_no,
            "is_consumed": self.is_consumed,
            "consumed_at": self.consumed_at.isoformat() if self.consumed_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


# ==============================================================================
# 13. Student Gamification Profiles (Level, XP, Coins, Cosmetics)
# ==============================================================================
class StudentGamificationProfile(Base):
    __tablename__ = "student_gamification_profiles"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    roll_no: Mapped[str] = mapped_column(
        ForeignKey("users.roll_no", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    current_level: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    level_name: Mapped[str] = mapped_column(String(64), default="Beginner", nullable=False)
    total_xp: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    attend_coins: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    current_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    longest_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_streak_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    active_avatar_id: Mapped[str] = mapped_column(String(64), default="default_student", nullable=False)
    active_frame_id: Mapped[str] = mapped_column(String(64), default="none", nullable=False)
    active_title: Mapped[str] = mapped_column(String(64), default="Freshman Explorer", nullable=False)
    active_theme: Mapped[str] = mapped_column(String(64), default="emerald", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    __table_args__ = (
        Index("idx_gamify_xp", "total_xp"),
        Index("idx_gamify_streak", "current_streak"),
    )

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "roll_no": self.roll_no,
            "current_level": self.current_level,
            "level_name": self.level_name,
            "total_xp": self.total_xp,
            "attend_coins": self.attend_coins,
            "current_streak": self.current_streak,
            "longest_streak": self.longest_streak,
            "last_streak_date": self.last_streak_date.isoformat() if self.last_streak_date else None,
            "active_avatar_id": self.active_avatar_id,
            "active_frame_id": self.active_frame_id,
            "active_title": self.active_title,
            "active_theme": self.active_theme,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

# ==============================================================================
# 14. XP Transaction Ledger (Persistent, Auditable, Idempotent)
# ==============================================================================
class XPTransaction(Base):
    __tablename__ = "xp_transactions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    roll_no: Mapped[str] = mapped_column(
        ForeignKey("users.roll_no", ondelete="CASCADE"), index=True, nullable=False
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[str] = mapped_column(String(64), nullable=False)  # 'LECTURE_ATTENDANCE', 'WEEKLY_GOAL', 'MISSION_COMPLETE', etc.
    reference_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)  # session_id, mission_id, etc.
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    balance_after: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("roll_no", "source", "reference_id", name="uq_xp_roll_source_ref"),
        Index("idx_xp_roll_time", "roll_no", "created_at"),
    )

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "roll_no": self.roll_no,
            "amount": self.amount,
            "source": self.source,
            "reference_id": self.reference_id,
            "description": self.description,
            "balance_after": self.balance_after,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

# ==============================================================================
# 15. AttendCoin Transaction Ledger (Virtual Currency)
# ==============================================================================
class AttendCoinTransaction(Base):
    __tablename__ = "attendcoin_transactions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    roll_no: Mapped[str] = mapped_column(
        ForeignKey("users.roll_no", ondelete="CASCADE"), index=True, nullable=False
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)  # Positive for earn, negative for spend
    source: Mapped[str] = mapped_column(String(64), nullable=False)  # 'XP_CONVERSION', 'MISSION_REWARD', 'STORE_PURCHASE'
    reference_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    balance_after: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True, nullable=False)

    __table_args__ = (
        Index("idx_coin_roll_time", "roll_no", "created_at"),
    )

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "roll_no": self.roll_no,
            "amount": self.amount,
            "source": self.source,
            "reference_id": self.reference_id,
            "description": self.description,
            "balance_after": self.balance_after,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

# ==============================================================================
# 16. Achievement Badges Catalog & Student Unlocks
# ==============================================================================
class AchievementBadge(Base):
    __tablename__ = "achievement_badges"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # e.g. 'early_bird', 'consistency_king'
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(64), default="ATTENDANCE", nullable=False)
    rarity: Mapped[str] = mapped_column(String(32), default="COMMON", nullable=False)  # 'COMMON', 'RARE', 'EPIC', 'LEGENDARY'
    icon: Mapped[str] = mapped_column(String(64), default="Award", nullable=False)
    xp_reward: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    coin_reward: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    criteria_type: Mapped[str] = mapped_column(String(64), nullable=False)
    criteria_threshold: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "rarity": self.rarity,
            "icon": self.icon,
            "xp_reward": self.xp_reward,
            "coin_reward": self.coin_reward,
            "criteria_type": self.criteria_type,
            "criteria_threshold": self.criteria_threshold
        }

class StudentBadge(Base):
    __tablename__ = "student_badges"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    roll_no: Mapped[str] = mapped_column(
        ForeignKey("users.roll_no", ondelete="CASCADE"), index=True, nullable=False
    )
    badge_id: Mapped[str] = mapped_column(
        ForeignKey("achievement_badges.id", ondelete="CASCADE"), index=True, nullable=False
    )
    unlocked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    __table_args__ = (
        UniqueConstraint("roll_no", "badge_id", name="uq_student_badge"),
        Index("idx_student_badge_lookup", "roll_no", "badge_id"),
    )

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "roll_no": self.roll_no,
            "badge_id": self.badge_id,
            "unlocked_at": self.unlocked_at.isoformat() if self.unlocked_at else None
        }

# ==============================================================================
# 17. Missions & Challenges (Daily, Weekly, Monthly, Faculty Custom)
# ==============================================================================
class Mission(Base):
    __tablename__ = "missions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(String(32), default="DAILY", nullable=False)  # 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'
    category: Mapped[str] = mapped_column(String(64), default="ATTENDANCE", nullable=False)
    difficulty: Mapped[str] = mapped_column(String(32), default="EASY", nullable=False)  # 'EASY', 'MEDIUM', 'HARD'
    target_section: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    target_subject_code: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    goal_type: Mapped[str] = mapped_column(String(64), default="ATTEND_CLASSES", nullable=False)
    goal_target: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    xp_reward: Mapped[int] = mapped_column(Integer, default=20, nullable=False)
    coin_reward: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    end_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)  # Faculty ID or 'SYSTEM'
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True, nullable=False)

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "title": self.title,
            "description": self.description,
            "type": self.type,
            "category": self.category,
            "difficulty": self.difficulty,
            "target_section": self.target_section,
            "target_subject_code": self.target_subject_code,
            "goal_type": self.goal_type,
            "goal_target": self.goal_target,
            "xp_reward": self.xp_reward,
            "coin_reward": self.coin_reward,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "created_by": self.created_by,
            "is_active": self.is_active
        }

class StudentMission(Base):
    __tablename__ = "student_missions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    roll_no: Mapped[str] = mapped_column(
        ForeignKey("users.roll_no", ondelete="CASCADE"), index=True, nullable=False
    )
    mission_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("missions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    current_progress: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    target_value: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, index=True, nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_claimed: Mapped[bool] = mapped_column(Boolean, default=False, index=True, nullable=False)
    claimed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("roll_no", "mission_id", name="uq_student_mission"),
        Index("idx_student_mission_status", "roll_no", "is_completed", "is_claimed"),
    )

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "roll_no": self.roll_no,
            "mission_id": str(self.mission_id),
            "current_progress": self.current_progress,
            "target_value": self.target_value,
            "is_completed": self.is_completed,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "is_claimed": self.is_claimed,
            "claimed_at": self.claimed_at.isoformat() if self.claimed_at else None
        }

# ==============================================================================
# 18. Store Rewards & Redemptions (Cosmetics, Themes, Frames, Titles)
# ==============================================================================
class StoreReward(Base):
    __tablename__ = "store_rewards"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # e.g. 'avatar_cyber_ninja'
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(String(32), default="AVATAR", nullable=False)  # 'AVATAR', 'FRAME', 'TITLE', 'THEME', 'EFFECT'
    coin_price: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    preview_asset: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "type": self.type,
            "coin_price": self.coin_price,
            "preview_asset": self.preview_asset,
            "is_available": self.is_available
        }

class RewardRedemption(Base):
    __tablename__ = "reward_redemptions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    roll_no: Mapped[str] = mapped_column(
        ForeignKey("users.roll_no", ondelete="CASCADE"), index=True, nullable=False
    )
    reward_id: Mapped[str] = mapped_column(
        ForeignKey("store_rewards.id", ondelete="CASCADE"), index=True, nullable=False
    )
    coin_cost: Mapped[int] = mapped_column(Integer, nullable=False)
    redeemed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    __table_args__ = (
        UniqueConstraint("roll_no", "reward_id", name="uq_student_reward"),
        Index("idx_redemption_lookup", "roll_no", "reward_id"),
    )

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "roll_no": self.roll_no,
            "reward_id": self.reward_id,
            "coin_cost": self.coin_cost,
            "redeemed_at": self.redeemed_at.isoformat() if self.redeemed_at else None
        }

# ==============================================================================
# 19. Team-Based Section Competitions
# ==============================================================================
class SectionCompetition(Base):
    __tablename__ = "section_competitions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    academic_year: Mapped[str] = mapped_column(String(32), default="2025-2026", nullable=False)
    semester: Mapped[int] = mapped_column(Integer, default=6, nullable=False)
    department: Mapped[str] = mapped_column(String(255), default="Computer Science & Engineering", nullable=False)
    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    end_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="ACTIVE", index=True, nullable=False)  # 'ACTIVE', 'COMPLETED'
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "title": self.title,
            "description": self.description,
            "academic_year": self.academic_year,
            "semester": self.semester,
            "department": self.department,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

# ==============================================================================
# 20. AI-Powered Personalized Challenges
# ==============================================================================
class PersonalizedChallenge(Base):
    __tablename__ = "personalized_challenges"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    roll_no: Mapped[str] = mapped_column(
        ForeignKey("users.roll_no", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)  # Explainable AI rationale
    risk_level: Mapped[str] = mapped_column(String(32), default="CONSISTENT", nullable=False)  # 'SHORTAGE_HIGH', 'SHORTAGE_MODERATE', 'CONSISTENT', 'IMPROVING'
    suggested_action: Mapped[str] = mapped_column(Text, nullable=False)
    target_classes: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    xp_reward: Mapped[int] = mapped_column(Integer, default=40, nullable=False)
    coin_reward: Mapped[int] = mapped_column(Integer, default=4, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "roll_no": self.roll_no,
            "title": self.title,
            "description": self.description,
            "reason": self.reason,
            "risk_level": self.risk_level,
            "suggested_action": self.suggested_action,
            "target_classes": self.target_classes,
            "xp_reward": self.xp_reward,
            "coin_reward": self.coin_reward,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
