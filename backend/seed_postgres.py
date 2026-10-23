import os
from datetime import datetime, timezone, timedelta
import numpy as np
from sqlalchemy.orm import Session
from db_postgres import get_session_factory, init_db_schema, check_postgres_connection
from models import User, StudentStats, LectureSession, Subject, StudentSubjectEnrollment, AttendanceRecord, SecurityAlert, AuditLog, FaceEnrollment
from auth import hash_password
import face_service

def run_postgres_seed(session: Session = None) -> bool:
    print("=" * 65)
    print(" SmartAttend-AI : Clean Relational Database Reset & Seed ")
    print("=" * 65)

    close_session_at_end = False
    if session is None:
        init_db_schema()
        session_factory = get_session_factory()
        session = session_factory()
        close_session_at_end = True

    try:
        now = datetime.now(timezone.utc)

        # ------------------------------------------------------------------
        # 1. ADMIN ACCOUNT (admin / adminpassword)
        # ------------------------------------------------------------------
        admin_pw_hash = hash_password("adminpassword")
        admin = session.query(User).filter(
            (User.roll_no == "admin") | (User.roll_no == "ADM01") | (User.email == "admin@smartattend.edu")
        ).first()

        if not admin:
            admin = User(
                roll_no="admin",
                name="System Administrator",
                email="admin@smartattend.edu",
                password=admin_pw_hash,
                role="admin",
                department="Administration",
                is_active=True,
                created_at=now,
                updated_at=now
            )
            session.add(admin)
            print("[Seed] Created Admin: admin / adminpassword")
        else:
            admin.roll_no = "admin"
            admin.name = "System Administrator"
            admin.email = "admin@smartattend.edu"
            admin.password = admin_pw_hash
            admin.role = "admin"
            admin.department = "Administration"
            print("[Seed] Updated Admin: admin / adminpassword")

        session.flush()

        # ------------------------------------------------------------------
        # 2. FACULTY ACCOUNT (faculty / facultypassword)
        # ------------------------------------------------------------------
        fac_pw_hash = hash_password("facultypassword")
        faculty = session.query(User).filter(
            (User.roll_no == "faculty") | (User.roll_no == "FAC01") | (User.email == "faculty@smartattend.edu")
        ).first()

        if not faculty:
            faculty = User(
                roll_no="faculty",
                name="Prof. Rajesh Sharma",
                email="faculty@smartattend.edu",
                password=fac_pw_hash,
                role="faculty",
                department="Computer Science & Engineering",
                is_active=True,
                created_at=now,
                updated_at=now
            )
            session.add(faculty)
            print("[Seed] Created Faculty: faculty / facultypassword")
        else:
            faculty.roll_no = "faculty"
            faculty.name = "Prof. Rajesh Sharma"
            faculty.email = "faculty@smartattend.edu"
            faculty.password = fac_pw_hash
            faculty.role = "faculty"
            faculty.department = "Computer Science & Engineering"
            print("[Seed] Updated Faculty: faculty / facultypassword")

        session.flush()

        # ------------------------------------------------------------------
        # 3. STUDENT ACCOUNTS (student / studentpassword)
        # ------------------------------------------------------------------
        stu_pw_hash = hash_password("studentpassword")

        # Primary student: 'student' (Aarav Sharma - CSE Sem 6)
        student1 = session.query(User).filter(
            (User.roll_no == "student") | (User.roll_no == "STU01") | (User.email == "student@smartattend.edu")
        ).first()

        if not student1:
            student1 = User(
                roll_no="student",
                name="Aarav Sharma",
                email="student@smartattend.edu",
                password=stu_pw_hash,
                role="student",
                department="Computer Science & Engineering",
                semester=6,
                bound_device_id=None,
                is_active=True,
                created_at=now,
                updated_at=now
            )
            session.add(student1)
            session.flush()
            print("[Seed] Created Student: student / studentpassword")
        else:
            student1.roll_no = "student"
            student1.name = "Aarav Sharma"
            student1.email = "student@smartattend.edu"
            student1.password = stu_pw_hash
            student1.department = "Computer Science & Engineering"
            student1.semester = 6
            print("[Seed] Updated Student: student / studentpassword")

        # Stats for student 1
        s1_stats = session.query(StudentStats).filter(StudentStats.user_id == student1.id).first()
        if not s1_stats:
            s1_stats = StudentStats(
                user_id=student1.id,
                current_attendance_pct=85.5,
                last_14_days_pct=88.0,
                mon_fri_skip_rate=0.08,
                first_lecture_miss_rate=0.05,
                current_streak=6,
                total_lectures=40,
                attended_lectures=34,
                updated_at=now
            )
            session.add(s1_stats)
        else:
            s1_stats.current_attendance_pct = 85.5
            s1_stats.attended_lectures = 34
            s1_stats.total_lectures = 40

        # Student 2: 'STU02' (Priya Patel - IT Sem 4)
        student2 = session.query(User).filter(
            (User.roll_no == "STU02") | (User.email == "priya@smartattend.edu")
        ).first()

        if not student2:
            student2 = User(
                roll_no="STU02",
                name="Priya Patel",
                email="priya@smartattend.edu",
                password=stu_pw_hash,
                role="student",
                department="Information Technology",
                semester=4,
                bound_device_id=None,
                is_active=True,
                created_at=now,
                updated_at=now
            )
            session.add(student2)
            session.flush()
            print("[Seed] Created Student: STU02 (Priya Patel)")
        else:
            student2.roll_no = "STU02"
            student2.name = "Priya Patel"
            student2.email = "priya@smartattend.edu"
            student2.password = stu_pw_hash
            student2.department = "Information Technology"
            student2.semester = 4

        s2_stats = session.query(StudentStats).filter(StudentStats.user_id == student2.id).first()
        if not s2_stats:
            s2_stats = StudentStats(
                user_id=student2.id,
                current_attendance_pct=78.0,
                last_14_days_pct=75.0,
                mon_fri_skip_rate=0.15,
                first_lecture_miss_rate=0.10,
                current_streak=3,
                total_lectures=36,
                attended_lectures=28,
                updated_at=now
            )
            session.add(s2_stats)

        # Student 3: 'STU03' (Rohan Verma - ECE Sem 6)
        student3 = session.query(User).filter(
            (User.roll_no == "STU03") | (User.email == "rohan@smartattend.edu")
        ).first()

        if not student3:
            student3 = User(
                roll_no="STU03",
                name="Rohan Verma",
                email="rohan@smartattend.edu",
                password=stu_pw_hash,
                role="student",
                department="Electronics & Communication",
                semester=6,
                bound_device_id=None,
                is_active=True,
                created_at=now,
                updated_at=now
            )
            session.add(student3)
            session.flush()
            print("[Seed] Created Student: STU03 (Rohan Verma)")
        else:
            student3.roll_no = "STU03"
            student3.name = "Rohan Verma"
            student3.email = "rohan@smartattend.edu"
            student3.password = stu_pw_hash
            student3.department = "Electronics & Communication"
            student3.semester = 6

        s3_stats = session.query(StudentStats).filter(StudentStats.user_id == student3.id).first()
        if not s3_stats:
            s3_stats = StudentStats(
                user_id=student3.id,
                current_attendance_pct=68.5,
                last_14_days_pct=60.0,
                mon_fri_skip_rate=0.35,
                first_lecture_miss_rate=0.30,
                current_streak=-2,
                total_lectures=40,
                attended_lectures=27,
                updated_at=now
            )
            session.add(s3_stats)

        # ------------------------------------------------------------------
        # 3b. OFFICIAL FACE BIOMETRIC TEMPLATES (Enrolled by Admin at Admission)
        # ------------------------------------------------------------------
        for idx, stu in enumerate([student1, student2, student3], start=1):
            if not stu:
                continue
            face_rec = session.query(FaceEnrollment).filter(FaceEnrollment.user_id == stu.id).first()
            rng = np.random.RandomState(42 + idx)
            emb = rng.randn(512).astype(np.float32)
            emb /= np.linalg.norm(emb)
            encrypted = face_service.encrypt_embedding(emb)
            if not face_rec:
                face_rec = FaceEnrollment(
                    user_id=stu.id,
                    embedding=encrypted,
                    model_name="buffalo_sc",
                    model_version="insightface-2.1",
                    consent_given_at=now,
                    consent_text_version="v1.0-admin-enrollment",
                    created_at=now,
                    retention_expires_at=now + timedelta(days=365)
                )
                session.add(face_rec)
                print(f"[Seed] Admin Enrolled Official Face Biometrics for {stu.roll_no} ({stu.name})")
            else:
                face_rec.embedding = encrypted

        # ------------------------------------------------------------------
        # 4. SUBJECTS
        # ------------------------------------------------------------------
        subjects_data = [
            {"code": "CS301", "name": "Operating Systems", "credits": 4, "department": "Computer Science & Engineering", "semester": 6, "faculty_id": "faculty", "faculty_name": "Prof. Rajesh Sharma"},
            {"code": "IT401", "name": "Web Technologies", "credits": 4, "department": "Information Technology", "semester": 4, "faculty_id": "faculty", "faculty_name": "Prof. Rajesh Sharma"},
            {"code": "EC601", "name": "Embedded Systems", "credits": 3, "department": "Electronics & Communication", "semester": 6, "faculty_id": "faculty", "faculty_name": "Prof. Rajesh Sharma"},
        ]

        for s_info in subjects_data:
            subj = session.query(Subject).filter(Subject.code == s_info["code"]).first()
            if not subj:
                subj = Subject(
                    code=s_info["code"],
                    name=s_info["name"],
                    department=s_info["department"],
                    semester=s_info["semester"],
                    faculty_id=s_info["faculty_id"],
                    faculty_name=s_info["faculty_name"],
                    credits=s_info["credits"],
                    min_attendance_pct=75.0,
                    total_conducted=10,
                    created_at=now
                )
                session.add(subj)
                print(f"[Seed] Created Subject: {subj.code} - {subj.name}")
            else:
                subj.faculty_id = s_info["faculty_id"]
                subj.faculty_name = s_info["faculty_name"]

        # ------------------------------------------------------------------
        # 4b. STUDENT SUBJECT ENROLLMENTS (Realistic Curriculum Baselines)
        # ------------------------------------------------------------------
        enrollments_seed = [
            # Student 1: Aarav Sharma (student / STU01) - 78.5% in CS301
            {"roll_no": "student", "name": "Aarav Sharma", "code": "CS301", "name_sub": "Machine Learning & OS", "attended": 22, "total": 28, "pct": 78.5},
            {"roll_no": "student", "name": "Aarav Sharma", "code": "CS302", "name_sub": "Database Systems", "attended": 24, "total": 30, "pct": 80.0},
            {"roll_no": "student", "name": "Aarav Sharma", "code": "CS303", "name_sub": "Machine Learning", "attended": 18, "total": 24, "pct": 75.0},
            # STU01 alias
            {"roll_no": "STU01", "name": "Aarav Sharma", "code": "CS301", "name_sub": "Machine Learning & OS", "attended": 22, "total": 28, "pct": 78.5},
            {"roll_no": "STU01", "name": "Aarav Sharma", "code": "CS302", "name_sub": "Database Systems", "attended": 24, "total": 30, "pct": 80.0},
            {"roll_no": "STU01", "name": "Aarav Sharma", "code": "CS303", "name_sub": "Machine Learning", "attended": 18, "total": 24, "pct": 75.0},
            # Student 3: Rohan Verma (STU03) - Danger zone (68.0%)
            {"roll_no": "STU03", "name": "Rohan Verma", "code": "CS301", "name_sub": "Machine Learning & OS", "attended": 17, "total": 25, "pct": 68.0},
            {"roll_no": "STU03", "name": "Rohan Verma", "code": "CS302", "name_sub": "Database Systems", "attended": 18, "total": 25, "pct": 72.0},
        ]

        for enr_data in enrollments_seed:
            enr_obj = session.query(StudentSubjectEnrollment).filter(
                StudentSubjectEnrollment.roll_no == enr_data["roll_no"],
                StudentSubjectEnrollment.subject_code == enr_data["code"]
            ).first()
            if not enr_obj:
                enr_obj = StudentSubjectEnrollment(
                    roll_no=enr_data["roll_no"],
                    student_name=enr_data["name"],
                    subject_code=enr_data["code"],
                    subject_name=enr_data["name_sub"],
                    total_classes=enr_data["total"],
                    attended_classes=enr_data["attended"],
                    current_pct=enr_data["pct"],
                    updated_at=now
                )
                session.add(enr_obj)
            else:
                enr_obj.total_classes = enr_data["total"]
                enr_obj.attended_classes = enr_data["attended"]
                enr_obj.current_pct = enr_data["pct"]

        # ------------------------------------------------------------------
        # 5. ACTIVE LECTURE SESSION
        # ------------------------------------------------------------------
        sample_session = session.query(LectureSession).filter(LectureSession.session_id == "CS301-SEC-A").first()
        if not sample_session:
            sample_session = LectureSession(
                session_id="CS301-SEC-A",
                session_code="CS301-SEC-A",
                subject_name="CS301 - Operating Systems",
                faculty_id="faculty",
                room_no="HALL-101",
                class_lat=19.0760,
                class_lng=72.8777,
                geofence_radius_meters=150,
                secret_seed="default_smartattend_seed_2026",
                status="ACTIVE",
                started_at=now,
                created_at=now
            )
            session.add(sample_session)
        else:
            sample_session.status = "ACTIVE"
            sample_session.faculty_id = "faculty"
            sample_session.geofence_radius_meters = 150

        session.commit()
        print("=" * 65)
        print(" [Seed] Database Cleaned & Configured Successfully! ")
        print(" -> Admin:   admin   / adminpassword")
        print(" -> Faculty: faculty / facultypassword")
        print(" -> Student: student / studentpassword")
        print("=" * 65)
        return True

    except Exception as e:
        session.rollback()
        print(f"[Seed Error]: {e}")
        return False
    finally:
        if close_session_at_end:
            session.close()

if __name__ == "__main__":
    run_postgres_seed()
