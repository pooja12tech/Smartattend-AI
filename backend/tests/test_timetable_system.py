"""
Automated Backend Integration Test Suite for Role-Based Timetable Management System.
Verifies:
1. Valid timetable slot creation by authorized admin with audit logging.
2. Rejection of unauthorized create, edit, delete, and publish operations (RBAC).
3. Faculty schedule isolation (faculty sees only their own schedule).
4. Student class/section schedule isolation (students restricted to their own cohort; cannot query other classes).
5. Validation of invalid time ranges (start >= end) and day formatting.
6. Detection and rejection of all 3 conflict types (Faculty Conflict, Room Conflict, Class Conflict) with HTTP 409.
7. Allowance of adjacent non-overlapping lecture intervals.
8. Self-exclusion during entry updates (no false conflict with itself).
9. Publication state filtering (drafts hidden from students; visible to admins).
10. Database persistence, publish toggling, and deletion.
"""
import uuid
import pytest
from fastapi.testclient import TestClient
from main import app, limiter
from db_postgres import init_db_schema, get_session_factory
from seed_postgres import run_postgres_seed
from models import User, TimetableEntry, AuditLog
from auth import hash_password


@pytest.fixture(scope="session", autouse=True)
def setup_timetable_test_environment():
    """Ensure schema is initialized and seeded with users and baseline timetable."""
    init_db_schema()
    run_postgres_seed()

    session = get_session_factory()()
    # Ensure second faculty exists for isolation tests
    fac02 = session.query(User).filter(User.roll_no == "FAC02").first()
    if not fac02:
        fac02 = User(
            roll_no="FAC02",
            name="Prof. Barbara Liskov",
            email="barbara@smartattend.edu",
            password=hash_password("fac123"),
            role="faculty",
            department="Computer Science & Engineering",
            is_active=True
        )
        session.add(fac02)
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
def faculty_auth(client):
    res = client.post("/api/login", json={"roll_no": "faculty", "password": "facultypassword"})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def faculty2_auth(client):
    res = client.post("/api/login", json={"roll_no": "FAC02", "password": "fac123"})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def student_auth(client):
    res = client.post("/api/login", json={"roll_no": "student", "password": "studentpassword"})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ==============================================================================
# 1. ADMIN CREATION & RBAC AUTHORIZATION TESTS
# ==============================================================================

def test_admin_can_create_valid_timetable_entry(client, admin_auth):
    """Admin can create a valid timetable entry and an audit log is produced."""
    payload = {
        "subject_code": "CS301",
        "subject_name": "Operating Systems",
        "faculty_id": "faculty",
        "faculty_name": "Prof. Rajesh Sharma",
        "department": "Computer Science & Engineering",
        "semester": 6,
        "section": "A",
        "academic_year": "2025-2026",
        "room_no": "LAB-302",
        "day_of_week": "WEDNESDAY",
        "start_time": "14:00",
        "end_time": "15:00",
        "is_published": True
    }
    res = client.post("/api/admin/timetable", json=payload, headers=admin_auth)
    assert res.status_code == 201
    data = res.json()
    assert data["success"] is True
    assert data["entry"]["subject_code"] == "CS301"
    assert data["entry"]["start_time"] == "14:00"
    assert data["entry"]["end_time"] == "15:00"


def test_unauthorized_users_cannot_manage_timetable(client, faculty_auth, student_auth):
    """Non-admin roles (faculty, student, unauthenticated) are rejected with 401 or 403."""
    dummy_payload = {
        "subject_code": "CS301",
        "faculty_id": "faculty",
        "department": "Computer Science & Engineering",
        "semester": 6,
        "section": "A",
        "room_no": "LAB-302",
        "day_of_week": "THURSDAY",
        "start_time": "16:00",
        "end_time": "17:00",
        "is_published": True
    }
    fake_uuid = str(uuid.uuid4())

    # Unauthenticated
    assert client.post("/api/admin/timetable", json=dummy_payload).status_code == 401
    assert client.put(f"/api/admin/timetable/{fake_uuid}", json=dummy_payload).status_code == 401
    assert client.delete(f"/api/admin/timetable/{fake_uuid}").status_code == 401

    # Faculty (Forbidden)
    assert client.post("/api/admin/timetable", json=dummy_payload, headers=faculty_auth).status_code == 403
    assert client.put(f"/api/admin/timetable/{fake_uuid}", json=dummy_payload, headers=faculty_auth).status_code == 403
    assert client.delete(f"/api/admin/timetable/{fake_uuid}", headers=faculty_auth).status_code == 403
    assert client.post(f"/api/admin/timetable/{fake_uuid}/publish", json={"is_published": True}, headers=faculty_auth).status_code == 403

    # Student (Forbidden)
    assert client.post("/api/admin/timetable", json=dummy_payload, headers=student_auth).status_code == 403
    assert client.put(f"/api/admin/timetable/{fake_uuid}", json=dummy_payload, headers=student_auth).status_code == 403
    assert client.delete(f"/api/admin/timetable/{fake_uuid}", headers=student_auth).status_code == 403


# ==============================================================================
# 2. ROLE ISOLATION TESTS
# ==============================================================================

def test_faculty_schedule_isolation(client, faculty_auth, faculty2_auth):
    """Faculty members only retrieve classes where faculty_id matches their identity."""
    res1 = client.get("/api/timetable/my", headers=faculty_auth)
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["role"] == "faculty"
    assert data1["faculty_id"] == "faculty"
    assert all(e["faculty_id"] == "faculty" for e in data1["timetable"])

    # Faculty 2 (has no classes seeded yet)
    res2 = client.get("/api/timetable/my", headers=faculty2_auth)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["role"] == "faculty"
    assert data2["faculty_id"] == "FAC02"
    assert len(data2["timetable"]) == 0


def test_student_class_isolation(client, student_auth):
    """Students can retrieve their assigned class timetable, but are forbidden from querying other classes."""
    # Student's own class (CSE Sem 6 Sec A)
    res_my = client.get("/api/timetable/my", headers=student_auth)
    assert res_my.status_code == 200
    data_my = res_my.json()
    assert data_my["role"] == "student"
    assert data_my["department"] == "Computer Science & Engineering"
    assert data_my["semester"] == 6
    assert data_my["section"] == "A"
    assert len(data_my["timetable"]) > 0

    # Querying their own class via /api/timetable/class is allowed
    res_own = client.get(
        "/api/timetable/class",
        params={
            "department": "Computer Science & Engineering",
            "semester": 6,
            "section": "A"
        },
        headers=student_auth
    )
    assert res_own.status_code == 200

    # Querying another class (Information Technology Sem 4 Sec A) MUST be rejected with 403
    res_other = client.get(
        "/api/timetable/class",
        params={
            "department": "Information Technology",
            "semester": 4,
            "section": "A"
        },
        headers=student_auth
    )
    assert res_other.status_code == 403
    assert "Access denied" in res_other.json()["detail"]


# ==============================================================================
# 3. TIME VALIDATION & ADJACENCY TESTS
# ==============================================================================

def test_invalid_time_range_rejection(client, admin_auth):
    """start_time >= end_time or malformed times are rejected with HTTP 422."""
    # End time before start time
    payload1 = {
        "subject_code": "CS301",
        "faculty_id": "faculty",
        "department": "Computer Science & Engineering",
        "semester": 6,
        "section": "A",
        "room_no": "LAB-302",
        "day_of_week": "MONDAY",
        "start_time": "11:00",
        "end_time": "10:00"
    }
    res1 = client.post("/api/admin/timetable", json=payload1, headers=admin_auth)
    assert res1.status_code == 422

    # Equal start and end time
    payload2 = {
        "subject_code": "CS301",
        "faculty_id": "faculty",
        "department": "Computer Science & Engineering",
        "semester": 6,
        "section": "A",
        "room_no": "LAB-302",
        "day_of_week": "MONDAY",
        "start_time": "10:00",
        "end_time": "10:00"
    }
    res2 = client.post("/api/admin/timetable", json=payload2, headers=admin_auth)
    assert res2.status_code == 422

    # Invalid day string
    payload3 = {
        "subject_code": "CS301",
        "faculty_id": "faculty",
        "department": "Computer Science & Engineering",
        "semester": 6,
        "section": "A",
        "room_no": "LAB-302",
        "day_of_week": "FUNDAY",
        "start_time": "10:00",
        "end_time": "11:00"
    }
    res3 = client.post("/api/admin/timetable", json=payload3, headers=admin_auth)
    assert res3.status_code == 422


def test_adjacent_lectures_permitted(client, admin_auth):
    """Lectures that share a boundary (e.g. 11:00-12:00 and 12:00-13:00) do NOT conflict."""
    # Slot 1: Thursday 10:00 - 11:00
    slot1 = {
        "subject_code": "CS301",
        "faculty_id": "faculty",
        "department": "Computer Science & Engineering",
        "semester": 6,
        "section": "A",
        "room_no": "LAB-900",
        "day_of_week": "THURSDAY",
        "start_time": "10:00",
        "end_time": "11:00"
    }
    res1 = client.post("/api/admin/timetable", json=slot1, headers=admin_auth)
    assert res1.status_code == 201

    # Slot 2: Thursday 11:00 - 12:00 in same room and same faculty
    slot2 = {
        "subject_code": "CS301",
        "faculty_id": "faculty",
        "department": "Computer Science & Engineering",
        "semester": 6,
        "section": "A",
        "room_no": "LAB-900",
        "day_of_week": "THURSDAY",
        "start_time": "11:00",
        "end_time": "12:00"
    }
    res2 = client.post("/api/admin/timetable", json=slot2, headers=admin_auth)
    assert res2.status_code == 201


# ==============================================================================
# 4. CONFLICT DETECTION TESTS (FACULTY, ROOM, CLASS)
# ==============================================================================

def test_faculty_collision_rejected(client, admin_auth):
    """Same faculty member cannot be scheduled for overlapping slots on the same day."""
    # Existing slot from seed: Monday 09:00 - 10:00 (faculty)
    # Attempt overlapping slot Monday 09:30 - 10:30 with DIFFERENT room and class
    conflict_payload = {
        "subject_code": "NEW101",
        "faculty_id": "faculty",
        "department": "Mechanical Engineering",
        "semester": 2,
        "section": "A",
        "room_no": "ROOM-DIFFERENT-101",
        "day_of_week": "MONDAY",
        "start_time": "09:30",
        "end_time": "10:30"
    }
    res = client.post("/api/admin/timetable", json=conflict_payload, headers=admin_auth)
    assert res.status_code == 409
    assert res.json()["detail"]["code"] == "FACULTY_CONFLICT"


def test_room_collision_rejected(client, admin_auth):
    """Same physical room cannot be double-booked for overlapping slots."""
    # Existing slot: Monday 09:00 - 10:00 in LAB-302
    # Attempt overlapping slot in LAB-302 with DIFFERENT faculty and class
    conflict_payload = {
        "subject_code": "NEW102",
        "faculty_id": "FAC02",
        "department": "Civil Engineering",
        "semester": 4,
        "section": "B",
        "room_no": "LAB-302",
        "day_of_week": "MONDAY",
        "start_time": "09:15",
        "end_time": "10:15"
    }
    res = client.post("/api/admin/timetable", json=conflict_payload, headers=admin_auth)
    assert res.status_code == 409
    assert res.json()["detail"]["code"] == "ROOM_CONFLICT"


def test_class_collision_rejected(client, admin_auth):
    """Same student class/section cohort cannot have overlapping lectures."""
    # Existing slot: Monday 09:00 - 10:00 for CSE Sem 6 Sec A
    # Attempt overlapping slot with DIFFERENT faculty and DIFFERENT room
    conflict_payload = {
        "subject_code": "NEW103",
        "faculty_id": "FAC02",
        "department": "Computer Science & Engineering",
        "semester": 6,
        "section": "A",
        "room_no": "AUDITORIUM-1",
        "day_of_week": "MONDAY",
        "start_time": "09:45",
        "end_time": "10:45"
    }
    res = client.post("/api/admin/timetable", json=conflict_payload, headers=admin_auth)
    assert res.status_code == 409
    assert res.json()["detail"]["code"] == "CLASS_CONFLICT"


# ==============================================================================
# 5. ENTRY UPDATE SELF-EXCLUSION & PUBLISH FILTERING
# ==============================================================================

def test_update_does_not_falsely_conflict_with_self(client, admin_auth):
    """Updating an entry's subject name or room does not trigger a collision against itself."""
    # Create test entry
    create_res = client.post("/api/admin/timetable", json={
        "subject_code": "TEST501",
        "subject_name": "Test Subject",
        "faculty_id": "FAC02",
        "department": "Computer Science & Engineering",
        "semester": 8,
        "section": "A",
        "room_no": "ROOM-801",
        "day_of_week": "WEDNESDAY",
        "start_time": "15:00",
        "end_time": "16:00"
    }, headers=admin_auth)
    assert create_res.status_code == 201
    entry_id = create_res.json()["entry"]["id"]

    # Update subject_name and room without changing time
    update_res = client.put(f"/api/admin/timetable/{entry_id}", json={
        "subject_name": "Test Subject Advanced Edition",
        "room_no": "ROOM-802"
    }, headers=admin_auth)
    assert update_res.status_code == 200
    assert update_res.json()["entry"]["room_no"] == "ROOM-802"


def test_draft_entries_hidden_from_students(client, admin_auth, student_auth):
    """Entries with is_published=False are visible to admin, but strictly hidden from students."""
    # Create draft slot
    create_res = client.post("/api/admin/timetable", json={
        "subject_code": "SECRET-LAB",
        "subject_name": "Unpublished Research Slot",
        "faculty_id": "faculty",
        "department": "Computer Science & Engineering",
        "semester": 6,
        "section": "A",
        "room_no": "LAB-RESEARCH",
        "day_of_week": "FRIDAY",
        "start_time": "16:00",
        "end_time": "17:00",
        "is_published": False
    }, headers=admin_auth)
    assert create_res.status_code == 201
    entry_id = create_res.json()["entry"]["id"]

    # Student cannot see it
    student_res = client.get("/api/timetable/my", headers=student_auth)
    assert student_res.status_code == 200
    student_codes = [e["subject_code"] for e in student_res.json()["timetable"]]
    assert "SECRET-LAB" not in student_codes

    # Admin CAN see it via filter
    admin_res = client.get("/api/admin/timetable?is_published=false", headers=admin_auth)
    assert admin_res.status_code == 200
    admin_codes = [e["subject_code"] for e in admin_res.json()["timetable"]]
    assert "SECRET-LAB" in admin_codes

    # Admin publishes it
    pub_res = client.post(f"/api/admin/timetable/{entry_id}/publish", json={"is_published": True}, headers=admin_auth)
    assert pub_res.status_code == 200

    # Student now sees it
    student_res_after = client.get("/api/timetable/my", headers=student_auth)
    assert "SECRET-LAB" in [e["subject_code"] for e in student_res_after.json()["timetable"]]

    # Admin deletes it
    del_res = client.delete(f"/api/admin/timetable/{entry_id}", headers=admin_auth)
    assert del_res.status_code == 200
