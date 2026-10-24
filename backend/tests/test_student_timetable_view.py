"""
Integration and RBAC Test Suite for Phase 5: Student Timetable View.

Verifies:
1. Student personalized timetable retrieval via /api/timetable/my (scoped strictly to department, semester, section).
2. Student today schedule retrieval via /api/student/timetable/today with real-time slot indicators.
3. Strict published-entry filtering (draft/unpublished entries are hidden from students).
4. Student class/cohort isolation (Students from CSE Sem 6 Sec A cannot see IT Sem 4 Sec A, and cannot query other classes via /api/timetable/class).
5. Graceful handling of empty schedules (HTTP 200 with empty list).
6. Authorization & RBAC enforcement (Unauthenticated -> 401, Faculty calling student route -> 403,
   Student attempting to create, edit, delete, or publish -> 403, Student calling faculty route -> 403).
"""
import uuid
import pytest
from fastapi.testclient import TestClient
from main import app, limiter
from db_postgres import init_db_schema, get_session_factory
from seed_postgres import run_postgres_seed
from models import User, TimetableEntry
from auth import hash_password


@pytest.fixture(scope="session", autouse=True)
def setup_phase5_test_environment():
    """Ensure database schema is initialized and seeded with baseline users."""
    init_db_schema()
    run_postgres_seed()

    session = get_session_factory()()

    # Ensure Student 2 exists (Priya Patel - IT Sem 4 Sec A)
    stu02 = session.query(User).filter(User.roll_no == "STU02").first()
    if not stu02:
        stu02 = User(
            roll_no="STU02",
            name="Priya Patel",
            email="priya@smartattend.edu",
            password=hash_password("studentpassword"),
            role="student",
            department="Information Technology",
            semester=4,
            section="A",
            is_active=True
        )
        session.add(stu02)
        session.commit()

    # Ensure Empty-Schedule Student exists (Rohan Verma - ME Sem 2 Sec B)
    stu_empty = session.query(User).filter(User.roll_no == "STU_EMPTY").first()
    if not stu_empty:
        stu_empty = User(
            roll_no="STU_EMPTY",
            name="Rohan Verma",
            email="stu_empty@smartattend.edu",
            password=hash_password("studentpassword"),
            role="student",
            department="Mechanical Engineering",
            semester=2,
            section="B",
            is_active=True
        )
        session.add(stu_empty)
        session.commit()

    session.close()


@pytest.fixture
def client():
    limiter.reset()
    return TestClient(app)


@pytest.fixture
def admin_auth(client):
    res = client.post("/api/login", json={"roll_no": "admin", "password": "adminpassword"})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def student1_auth(client):
    """Primary student: Aarav Sharma - CSE Sem 6 Sec A"""
    res = client.post("/api/login", json={"roll_no": "student", "password": "studentpassword"})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def student2_auth(client):
    """Secondary student: Priya Patel - IT Sem 4 Sec A"""
    res = client.post("/api/login", json={"roll_no": "STU02", "password": "studentpassword"})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def student_empty_auth(client):
    """Empty schedule student: Rohan Verma - ME Sem 2 Sec B"""
    res = client.post("/api/login", json={"roll_no": "STU_EMPTY", "password": "studentpassword"})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def faculty_auth(client):
    res = client.post("/api/login", json={"roll_no": "faculty", "password": "facultypassword"})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ==============================================================================
# 1. PERSONALIZED STUDENT TIMETABLE RETRIEVAL TESTS
# ==============================================================================

def test_student_can_retrieve_own_cohort_weekly_timetable(client, student1_auth):
    """Student 1 retrieves their weekly timetable matching CSE Sem 6 Sec A."""
    res = client.get("/api/timetable/my", headers=student1_auth)
    assert res.status_code == 200
    data = res.json()
    assert data["role"] == "student"
    assert data["roll_no"] in ("student", "STU01")
    assert data["department"] == "Computer Science & Engineering"
    assert data["semester"] == 6
    assert data["section"] == "A"
    assert isinstance(data["timetable"], list)
    assert data["count"] == len(data["timetable"])
    assert data["count"] > 0

    # Verify each entry belongs strictly to the student's cohort and is published
    for entry in data["timetable"]:
        assert entry["department"] == "Computer Science & Engineering"
        assert entry["semester"] == 6
        assert entry["section"] == "A"
        assert entry["is_published"] is True
        assert "subject_code" in entry
        assert "subject_name" in entry
        assert "faculty_name" in entry
        assert "room_no" in entry
        assert "day_of_week" in entry
        assert "start_time" in entry
        assert "end_time" in entry


def test_student_today_schedule_retrieval(client, student1_auth):
    """Student retrieves today's schedule via /api/student/timetable/today."""
    # Query for FRIDAY (known to have lectures for CSE Sem 6 Sec A from seed)
    res = client.get("/api/student/timetable/today?day_of_week=FRIDAY", headers=student1_auth)
    assert res.status_code == 200
    data = res.json()
    assert data["department"] == "Computer Science & Engineering"
    assert data["semester"] == 6
    assert data["section"] == "A"
    assert data["day_of_week"] == "FRIDAY"
    assert isinstance(data["today_classes"], list)
    assert data["count"] == len(data["today_classes"])
    assert data["count"] >= 1

    # Check slot properties
    slot = data["today_classes"][0]
    assert "is_current_slot" in slot
    assert "is_upcoming_slot" in slot
    assert slot["department"] == "Computer Science & Engineering"
    assert slot["is_published"] is True


# ==============================================================================
# 2. DRAFT FILTERING & SECURITY ISOLATION TESTS
# ==============================================================================

def test_student_cannot_see_unpublished_draft_entries(client, admin_auth, student1_auth):
    """Unpublished/draft timetable entries must be strictly hidden from students."""
    # Admin creates a draft entry for CSE Sem 6 Sec A
    draft_payload = {
        "subject_code": "CS699-DRAFT",
        "subject_name": "Unpublished Advanced Seminar",
        "faculty_id": "faculty",
        "faculty_name": "Prof. Rajesh Sharma",
        "department": "Computer Science & Engineering",
        "semester": 6,
        "section": "A",
        "room_no": "LAB-RESEARCH",
        "day_of_week": "MONDAY",
        "start_time": "16:00",
        "end_time": "17:00",
        "is_published": False
    }
    create_res = client.post("/api/admin/timetable", json=draft_payload, headers=admin_auth)
    assert create_res.status_code == 201
    entry_id = create_res.json()["entry"]["id"]

    try:
        # 1. Student checks /api/timetable/my: CS699-DRAFT MUST NOT be present
        res_my = client.get("/api/timetable/my", headers=student1_auth)
        assert res_my.status_code == 200
        codes_my = [e["subject_code"] for e in res_my.json()["timetable"]]
        assert "CS699-DRAFT" not in codes_my

        # 2. Student checks /api/student/timetable/today?day_of_week=MONDAY: MUST NOT be present
        res_today = client.get("/api/student/timetable/today?day_of_week=MONDAY", headers=student1_auth)
        assert res_today.status_code == 200
        codes_today = [e["subject_code"] for e in res_today.json()["today_classes"]]
        assert "CS699-DRAFT" not in codes_today

    finally:
        client.delete(f"/api/admin/timetable/{entry_id}", headers=admin_auth)


def test_cross_student_cohort_isolation(client, student1_auth, student2_auth):
    """Students from different departments/classes only retrieve their own cohort timetable."""
    # Student 1 (CSE Sem 6 Sec A)
    res1 = client.get("/api/timetable/my", headers=student1_auth)
    assert res1.status_code == 200
    data1 = res1.json()
    assert all(e["department"] == "Computer Science & Engineering" for e in data1["timetable"])
    assert all(e["semester"] == 6 for e in data1["timetable"])

    # Student 2 (IT Sem 4 Sec A)
    res2 = client.get("/api/timetable/my", headers=student2_auth)
    assert res2.status_code == 200
    data2 = res2.json()
    assert all(e["department"] == "Information Technology" for e in data2["timetable"])
    assert all(e["semester"] == 4 for e in data2["timetable"])

    # Student 1 attempts to query Student 2's class via /api/timetable/class -> 403 Forbidden
    res_spoof = client.get(
        "/api/timetable/class",
        params={
            "department": "Information Technology",
            "semester": 4,
            "section": "A"
        },
        headers=student1_auth
    )
    assert res_spoof.status_code == 403
    assert "Access denied" in res_spoof.json()["detail"]

    # Student 2 attempts to query Student 1's class via /api/timetable/class -> 403 Forbidden
    res_spoof2 = client.get(
        "/api/timetable/class",
        params={
            "department": "Computer Science & Engineering",
            "semester": 6,
            "section": "A"
        },
        headers=student2_auth
    )
    assert res_spoof2.status_code == 403
    assert "Access denied" in res_spoof2.json()["detail"]


# ==============================================================================
# 3. EMPTY SCHEDULE & EDGE CASES
# ==============================================================================

def test_student_empty_schedule_returns_gracefully(client, student_empty_auth):
    """A student with no assigned timetable slots receives an empty list with HTTP 200."""
    res_my = client.get("/api/timetable/my", headers=student_empty_auth)
    assert res_my.status_code == 200
    data_my = res_my.json()
    assert data_my["role"] == "student"
    assert data_my["department"] == "Mechanical Engineering"
    assert data_my["count"] == 0
    assert data_my["timetable"] == []

    res_today = client.get("/api/student/timetable/today?day_of_week=WEDNESDAY", headers=student_empty_auth)
    assert res_today.status_code == 200
    data_today = res_today.json()
    assert data_today["count"] == 0
    assert data_today["today_classes"] == []


# ==============================================================================
# 4. AUTHORIZATION & RBAC ENFORCEMENT
# ==============================================================================

def test_unauthenticated_requests_are_rejected(client):
    """Unauthenticated calls are rejected with HTTP 401."""
    assert client.get("/api/timetable/my").status_code == 401
    assert client.get("/api/student/timetable/today").status_code == 401


def test_faculty_cannot_call_student_today_route(client, faculty_auth):
    """Faculty members cannot call student-only timetable endpoint."""
    res = client.get("/api/student/timetable/today", headers=faculty_auth)
    assert res.status_code == 403


def test_student_cannot_modify_or_publish_timetable(client, student1_auth):
    """Students cannot create, edit, delete, or publish official timetable entries."""
    dummy_payload = {
        "subject_code": "HACK101",
        "faculty_id": "faculty",
        "department": "Computer Science & Engineering",
        "semester": 6,
        "section": "A",
        "room_no": "LAB-302",
        "day_of_week": "MONDAY",
        "start_time": "08:00",
        "end_time": "09:00"
    }
    fake_id = str(uuid.uuid4())

    # Create slot -> 403
    assert client.post("/api/admin/timetable", json=dummy_payload, headers=student1_auth).status_code == 403

    # Update slot -> 403
    assert client.put(f"/api/admin/timetable/{fake_id}", json=dummy_payload, headers=student1_auth).status_code == 403

    # Delete slot -> 403
    assert client.delete(f"/api/admin/timetable/{fake_id}", headers=student1_auth).status_code == 403

    # Publish slot -> 403
    assert client.post(f"/api/admin/timetable/{fake_id}/publish", json={"is_published": True}, headers=student1_auth).status_code == 403

    # Access faculty route -> 403
    assert client.get("/api/faculty/timetable/today", headers=student1_auth).status_code == 403
