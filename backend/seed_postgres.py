import os
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from db_postgres import get_session_factory, init_db_schema, check_postgres_connection
from models import User, StudentStats, LectureSession
from auth import hash_password

def run_postgres_seed(session: Session = None) -> bool:
    print("=" * 65)
    print(" SmartAttend-AI : Relational Database Seeding ")
    print("=" * 65)

    close_session_at_end = False
    if session is None:
        init_db_schema()
        session_factory = get_session_factory()
        session = session_factory()
        close_session_at_end = True

    try:
        now = datetime.now(timezone.utc)

        # 1. Admin record
        admin = session.query(User).filter(User.roll_no == "ADM01").first()
        admin_pw_hash = hash_password("admin123")
        if not admin:
            admin = User(
                roll_no="ADM01",
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
            print("[Seed] Created Admin user: System Administrator (ADM01)")
        else:
            admin.name = "System Administrator"
            admin.email = "admin@smartattend.edu"
            admin.password = admin_pw_hash
            admin.role = "admin"
            print("[Seed] Updated Admin user: ADM01")

        # 2. Faculty record
        faculty = session.query(User).filter(User.roll_no == "FAC01").first()
        faculty_pw_hash = hash_password("fac123")
        if not faculty:
            faculty = User(
                roll_no="FAC01",
                name="Prof. Alan Turing",
                email="faculty@smartattend.edu",
                password=faculty_pw_hash,
                role="faculty",
                department="Computer Science & Engineering",
                is_active=True,
                created_at=now,
                updated_at=now
            )
            session.add(faculty)
            print("[Seed] Created Faculty user: Prof. Alan Turing (FAC01)")
        else:
            faculty.name = "Prof. Alan Turing"
            faculty.email = "faculty@smartattend.edu"
            faculty.password = faculty_pw_hash
            faculty.role = "faculty"
            print("[Seed] Updated Faculty user: FAC01")

        session.flush()

        # 3. Student records with StudentStats
        students_data = [
            {
                "roll_no": "STU01",
                "name": "Aarav Sharma",
                "email": "aarav@smartattend.edu",
                "password": "stu123",
                "role": "student",
                "department": "Computer Science & Engineering",
                "semester": 6,
                "bound_device_id": "DEV-AARAV-PHONE-01",
                "registered_device_id": "DEV-AARAV-PHONE-01",
                "stats": {
                    "current_attendance_pct": 85.5,
                    "last_14_days_pct": 88.0,
                    "mon_fri_skip_rate": 0.10,
                    "first_lecture_miss_rate": 0.08,
                    "current_streak": 8,
                    "total_lectures": 40,
                    "attended_lectures": 34
                }
            },
            {
                "roll_no": "STU02",
                "name": "Priya Patel",
                "email": "priya@smartattend.edu",
                "password": "stu123",
                "role": "student",
                "department": "Computer Science & Engineering",
                "semester": 6,
                "bound_device_id": "DEV-PRIYA-PHONE-02",
                "registered_device_id": "DEV-PRIYA-PHONE-02",
                "stats": {
                    "current_attendance_pct": 76.2,
                    "last_14_days_pct": 68.0,
                    "mon_fri_skip_rate": 0.42,
                    "first_lecture_miss_rate": 0.38,
                    "current_streak": -1,
                    "total_lectures": 40,
                    "attended_lectures": 30
                }
            },
            {
                "roll_no": "STU03",
                "name": "Rohan Verma",
                "email": "rohan@smartattend.edu",
                "password": "stu123",
                "role": "student",
                "department": "Computer Science & Engineering",
                "semester": 6,
                "bound_device_id": "DEV-ROHAN-PHONE-03",
                "registered_device_id": "DEV-ROHAN-PHONE-03",
                "stats": {
                    "current_attendance_pct": 64.8,
                    "last_14_days_pct": 50.0,
                    "mon_fri_skip_rate": 0.65,
                    "first_lecture_miss_rate": 0.60,
                    "current_streak": -4,
                    "total_lectures": 40,
                    "attended_lectures": 26
                }
            }
        ]

        def make_seed_face(color=(200, 150, 150)):
            import io, base64
            from PIL import Image
            img = Image.new("RGB", (100, 100), color=color)
            buf = io.BytesIO()
            img.save(buf, format="JPEG")
            return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")

        seed_face_b64 = make_seed_face()

        for s_data in students_data:
            stu = session.query(User).filter(User.roll_no == s_data["roll_no"]).first()
            stu_pw_hash = hash_password(s_data["password"])
            if not stu:
                stu = User(
                    roll_no=s_data["roll_no"],
                    name=s_data["name"],
                    email=s_data["email"],
                    password=stu_pw_hash,
                    role="student",
                    department=s_data["department"],
                    semester=s_data["semester"],
                    bound_device_id=s_data["bound_device_id"],
                    registered_device_id=s_data["registered_device_id"],
                    created_at=now,
                    updated_at=now
                )
                session.add(stu)
                session.flush()
                print(f"[Seed] Created Student: {stu.name} ({stu.roll_no})")
            else:
                stu.name = s_data["name"]
                stu.email = s_data["email"]
                stu.password = stu_pw_hash
                stu.bound_device_id = s_data["bound_device_id"]
                stu.registered_device_id = s_data["registered_device_id"]
                print(f"[Seed] Updated Student: {stu.name} ({stu.roll_no})")

            # Student stats
            st_stats = session.query(StudentStats).filter(StudentStats.user_id == stu.id).first()
            stats_vals = s_data["stats"]
            if not st_stats:
                st_stats = StudentStats(
                    user_id=stu.id,
                    current_attendance_pct=stats_vals["current_attendance_pct"],
                    last_14_days_pct=stats_vals["last_14_days_pct"],
                    mon_fri_skip_rate=stats_vals["mon_fri_skip_rate"],
                    first_lecture_miss_rate=stats_vals["first_lecture_miss_rate"],
                    current_streak=stats_vals["current_streak"],
                    total_lectures=stats_vals["total_lectures"],
                    attended_lectures=stats_vals["attended_lectures"],
                    updated_at=now
                )
                session.add(st_stats)
            else:
                st_stats.current_attendance_pct = stats_vals["current_attendance_pct"]
                st_stats.last_14_days_pct = stats_vals["last_14_days_pct"]
                st_stats.mon_fri_skip_rate = stats_vals["mon_fri_skip_rate"]
                st_stats.first_lecture_miss_rate = stats_vals["first_lecture_miss_rate"]
                st_stats.current_streak = stats_vals["current_streak"]
                st_stats.total_lectures = stats_vals["total_lectures"]
                st_stats.attended_lectures = stats_vals["attended_lectures"]
                st_stats.updated_at = now

        # 4. Active sample lecture session
        sample_session = session.query(LectureSession).filter(LectureSession.session_id == "CS301-SEC-A").first()
        if not sample_session:
            sample_session = LectureSession(
                session_id="CS301-SEC-A",
                session_code="CS301-SEC-A",
                subject_name="CS301 - Operating Systems",
                faculty_id="FAC01",
                room_no="LAB-302",
                class_lat=19.0760,
                class_lng=72.8777,
                geofence_radius_meters=60,
                secret_seed="default_smartattend_seed_2026",
                status="ACTIVE",
                started_at=now,
                created_at=now
            )
            session.add(sample_session)
            print("[Seed] Created Lecture Session: CS301-SEC-A")
        else:
            sample_session.status = "ACTIVE"
            sample_session.secret_seed = "default_smartattend_seed_2026"
            print("[Seed] Updated Lecture Session: CS301-SEC-A")

        # 5. Academic Subjects (CS301, CS302, CS303, CS304)
        from models import Subject, StudentSubjectEnrollment, AuditLog
        subjects_data = [
            {"code": "CS301", "name": "Operating Systems", "credits": 4, "total_conducted": 20, "faculty_id": "FAC01", "faculty_name": "Prof. Alan Turing"},
            {"code": "CS302", "name": "Database Management Systems", "credits": 4, "total_conducted": 18, "faculty_id": "FAC01", "faculty_name": "Prof. Alan Turing"},
            {"code": "CS303", "name": "Machine Learning & AI", "credits": 4, "total_conducted": 22, "faculty_id": "FAC01", "faculty_name": "Prof. Alan Turing"},
            {"code": "CS304", "name": "Distributed Systems", "credits": 3, "total_conducted": 16, "faculty_id": "FAC01", "faculty_name": "Prof. Alan Turing"},
        ]

        for s_info in subjects_data:
            subj = session.query(Subject).filter(Subject.code == s_info["code"]).first()
            if not subj:
                subj = Subject(
                    code=s_info["code"],
                    name=s_info["name"],
                    department="Computer Science & Engineering",
                    semester=6,
                    faculty_id=s_info["faculty_id"],
                    faculty_name=s_info["faculty_name"],
                    credits=s_info["credits"],
                    min_attendance_pct=75.0,
                    total_conducted=s_info["total_conducted"],
                    created_at=now
                )
                session.add(subj)
                print(f"[Seed] Created Subject: {subj.code} - {subj.name}")
            else:
                subj.name = s_info["name"]
                subj.faculty_id = s_info["faculty_id"]
                subj.faculty_name = s_info["faculty_name"]
                subj.total_conducted = s_info["total_conducted"]

        session.flush()

        cs301 = session.query(Subject).filter(Subject.code == "CS301").first()
        if cs301 and sample_session:
            sample_session.subject_id = cs301.id

        # 6. Student Subject Enrollments
        # STU01 (High: 85%), STU02 (Borderline: 76%), STU03 (At-risk: 65%)
        enrollments = [
            # STU01
            {"roll_no": "STU01", "name": "Aarav Sharma", "code": "CS301", "subj": "Operating Systems", "tot": 20, "att": 18},
            {"roll_no": "STU01", "name": "Aarav Sharma", "code": "CS302", "subj": "Database Management Systems", "tot": 18, "att": 16},
            {"roll_no": "STU01", "name": "Aarav Sharma", "code": "CS303", "subj": "Machine Learning & AI", "tot": 22, "att": 19},
            {"roll_no": "STU01", "name": "Aarav Sharma", "code": "CS304", "subj": "Distributed Systems", "tot": 16, "att": 13},
            # STU02
            {"roll_no": "STU02", "name": "Priya Patel", "code": "CS301", "subj": "Operating Systems", "tot": 20, "att": 15},
            {"roll_no": "STU02", "name": "Priya Patel", "code": "CS302", "subj": "Database Management Systems", "tot": 18, "att": 14},
            {"roll_no": "STU02", "name": "Priya Patel", "code": "CS303", "subj": "Machine Learning & AI", "tot": 22, "att": 17},
            {"roll_no": "STU02", "name": "Priya Patel", "code": "CS304", "subj": "Distributed Systems", "tot": 16, "att": 12},
            # STU03
            {"roll_no": "STU03", "name": "Rohan Verma", "code": "CS301", "subj": "Operating Systems", "tot": 20, "att": 12},
            {"roll_no": "STU03", "name": "Rohan Verma", "code": "CS302", "subj": "Database Management Systems", "tot": 18, "att": 11},
            {"roll_no": "STU03", "name": "Rohan Verma", "code": "CS303", "subj": "Machine Learning & AI", "tot": 22, "att": 14},
            {"roll_no": "STU03", "name": "Rohan Verma", "code": "CS304", "subj": "Distributed Systems", "tot": 16, "att": 9},
        ]

        for enr in enrollments:
            rec = session.query(StudentSubjectEnrollment).filter(
                StudentSubjectEnrollment.roll_no == enr["roll_no"],
                StudentSubjectEnrollment.subject_code == enr["code"]
            ).first()
            pct = (enr["att"] / max(1, enr["tot"])) * 100.0
            if not rec:
                rec = StudentSubjectEnrollment(
                    roll_no=enr["roll_no"],
                    student_name=enr["name"],
                    subject_code=enr["code"],
                    subject_name=enr["subj"],
                    total_classes=enr["tot"],
                    attended_classes=enr["att"],
                    current_pct=round(pct, 1),
                    updated_at=now
                )
                session.add(rec)
            else:
                rec.total_classes = enr["tot"]
                rec.attended_classes = enr["att"]
                rec.current_pct = round(pct, 1)

        # 7. Initial Audit Log entry
        initial_audit = session.query(AuditLog).filter(AuditLog.action == "SYSTEM_INIT").first()
        if not initial_audit:
            initial_audit = AuditLog(
                actor_id="ADM01",
                actor_name="System Administrator",
                actor_role="admin",
                action="SYSTEM_INIT",
                target_type="SYSTEM",
                target_id="DATABASE",
                old_value=None,
                new_value="Normalized Relational Schema v2.1 Initialized",
                reason="System startup database initialization & verification",
                created_at=now
            )
            session.add(initial_audit)

        session.commit()
        print("\n[SUCCESS] Relational seed completed successfully!")
        return True
    except Exception as exc:
        session.rollback()
        print(f"\n[ERROR] Seeding failed: {exc}")
        raise exc
    finally:
        if close_session_at_end:
            session.close()

if __name__ == "__main__":
    run_postgres_seed()
