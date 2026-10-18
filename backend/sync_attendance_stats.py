"""
Sync Attendance Stats Migration / Maintenance Script (Phase 3)
Recomputes all StudentStats and StudentSubjectEnrollment records directly from AttendanceRecord rows.
Run via: python backend/sync_attendance_stats.py
"""
import sys
import os

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db_postgres import get_session_factory
from models import User, StudentStats, AttendanceRecord, StudentSubjectEnrollment
from main import recompute_student_stats, recompute_student_subject_enrollment

def sync_all_attendance_stats():
    session = get_session_factory()()
    try:
        students = session.query(User).filter(User.role == "student").all()
        print(f"[Sync] Found {len(students)} student(s) to synchronize.")
        for student in students:
            stats = recompute_student_stats(session, student.id)
            if stats:
                print(f"[Sync] Student '{student.roll_no}' ({student.name}): "
                      f"{stats.attended_lectures}/{stats.total_lectures} attended ({stats.current_attendance_pct}%), streak: {stats.current_streak}")

            # Also sync any subject enrollments
            enrollments = session.query(StudentSubjectEnrollment).filter(
                StudentSubjectEnrollment.roll_no == student.roll_no
            ).all()
            for enr in enrollments:
                recompute_student_subject_enrollment(session, student.roll_no, enr.subject_code)

        session.commit()
        print("[Sync] All student attendance statistics successfully synchronized from records.")
    except Exception as e:
        session.rollback()
        print(f"[Sync Error]: {e}")
        raise
    finally:
        session.close()

if __name__ == "__main__":
    sync_all_attendance_stats()
