"""
Integration and RBAC Test Suite for Phase 4: Faculty Timetable View.

Verifies:
1. Faculty timetable retrieval via /api/timetable/my for authenticated faculty.
2. Faculty today schedule retrieval via /api/faculty/timetable/today with published filter.
3. Strict published-entry filtering (draft/unpublished entries are hidden from faculty).
4. Cross-faculty isolation (Faculty A cannot retrieve or see Faculty B's timetable).
5. Graceful handling of empty schedules (HTTP 200 with empty list).
6. Authorization & RBAC enforcement (Unauthenticated -> 401, Student calling faculty route -> 403,
   Faculty trying to edit/delete/publish -> 403).
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
def setup_phase4_test_environment():
    """Ensure database schema is initialized and seeded with baseline users."""
    init_db_schema()
    run_postgres_seed()

    session = get_session_factory()()
    # Ensure secondary faculty FAC02 exists for cross-faculty isolation testing
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

    # Ensure empty-schedule faculty FAC_EMPTY exists
    fac_empty = session.query(User).filter(User.roll_no == "FAC_EMPTY").first()
    if not fac_empty:
        fac_empty = User(
            roll_no="FAC_EMPTY",
            name="Prof. Empty Schedule",
            email="empty@smartattend.edu",
            password=hash_password("empty123"),
            role="faculty",
            department="Electrical Engineering",
            is_active=True
        )
        session.add(fac_empty)
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
def faculty_empty_auth(client):
    res = client.post("/api/login", json={"roll_no": "FAC_EMPTY", "password": "empty123"})
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
# 1. FACULTY TIMETABLE RETRIEVAL TESTS
# ==============================================================================

def test_faculty_can_retrieve_own_weekly_timetable(client, faculty_auth):
    """Faculty retrieves their own timetable via /api/timetable/my."""
    res = client.get("/api/timetable/my", headers=faculty_auth)
    assert res.status_code == 200
    data = res.json()
    assert data["role"] == "faculty"
    assert data["faculty_id"] == "faculty"
    assert isinstance(data["timetable"], list)
    assert data["count"] == len(data["timetable"])
    assert data["count"] > 0

    # Verify each entry has required fields
    for entry in data["timetable"]:
        assert entry["faculty_id"] == "faculty"
        assert entry["is_published"] is True
        assert "subject_code" in entry
        assert "subject_name" in entry
        assert "department" in entry
        assert "semester" in entry
        assert "section" in entry
        assert "room_no" in entry
        assert "day_of_week" in entry
        assert "start_time" in entry
        assert "end_time" in entry


def test_faculty_today_schedule_retrieval(client, faculty_auth):
    """Faculty retrieves today's schedule via /api/faculty/timetable/today."""
    # Query for a known day that has lectures (e.g. THURSDAY from seed data)
    res = client.get("/api/faculty/timetable/today?day_of_week=THURSDAY", headers=faculty_auth)
    assert res.status_code == 200
    data = res.json()
    assert data["faculty_id"] == "faculty"
    assert data["day_of_week"] == "THURSDAY"
    assert isinstance(data["today_classes"], list)
    assert data["count"] == len(data["today_classes"])
    assert data["count"] >= 1

    # Check slot properties
    first_slot = data["today_classes"][0]
    assert "is_current_slot" in first_slot
    assert "is_upcoming_slot" in first_slot
    assert first_slot["faculty_id"] == "faculty"
    assert first_slot["is_published"] is True


# ==============================================================================
# 2. DRAFT FILTERING & SECURITY ISOLATION TESTS
# ==============================================================================

def test_faculty_cannot_see_unpublished_draft_entries(client, admin_auth, faculty_auth):
    """Unpublished/draft timetable entries must be strictly hidden from faculty members."""
    # Admin creates a draft entry for 'faculty'
    draft_payload = {
        "subject_code": "CS999-DRAFT",
        "subject_name": "Classified Faculty Research Slot",
        "faculty_id": "faculty",
        "department": "Computer Science & Engineering",
        "semester": 6,
        "section": "A",
        "room_no": "LAB-CONFIDENTIAL",
        "day_of_week": "WEDNESDAY",
        "start_time": "17:00",
        "end_time": "18:00",
        "is_published": False
    }
    create_res = client.post("/api/admin/timetable", json=draft_payload, headers=admin_auth)
    assert create_res.status_code == 201
    entry_id = create_res.json()["entry"]["id"]

    try:
        # 1. Faculty checks /api/timetable/my: CS999-DRAFT MUST NOT be present
        res_my = client.get("/api/timetable/my", headers=faculty_auth)
        assert res_my.status_code == 200
        codes_my = [e["subject_code"] for e in res_my.json()["timetable"]]
        assert "CS999-DRAFT" not in codes_my

        # 2. Faculty checks /api/faculty/timetable/today?day_of_week=WEDNESDAY: MUST NOT be present
        res_today = client.get("/api/faculty/timetable/today?day_of_week=WEDNESDAY", headers=faculty_auth)
        assert res_today.status_code == 200
        codes_today = [e["subject_code"] for e in res_today.json()["today_classes"]]
        assert "CS999-DRAFT" not in codes_today

    finally:
        # Cleanup
        client.delete(f"/api/admin/timetable/{entry_id}", headers=admin_auth)


def test_cross_faculty_schedule_isolation(client, admin_auth, faculty_auth, faculty2_auth):
    """Faculty A cannot view Faculty B's schedule, and vice versa."""
    # Create a unique published slot for FAC02 on TUESDAY
    slot_fac02 = {
        "subject_code": "CS505",
        "subject_name": "Distributed Systems by Liskov",
        "faculty_id": "FAC02",
        "faculty_name": "Prof. Barbara Liskov",
        "department": "Computer Science & Engineering",
        "semester": 8,
        "section": "A",
        "room_no": "ROOM-505",
        "day_of_week": "TUESDAY",
        "start_time": "11:00",
        "end_time": "12:00",
        "is_published": True
    }
    create_res = client.post("/api/admin/timetable", json=slot_fac02, headers=admin_auth)
    assert create_res.status_code == 201
    entry_id = create_res.json()["entry"]["id"]

    try:
        # Faculty 1 queries their schedule: CS505 MUST NOT be in their schedule
        res_fac1 = client.get("/api/timetable/my", headers=faculty_auth)
        assert res_fac1.status_code == 200
        codes_fac1 = [e["subject_code"] for e in res_fac1.json()["timetable"]]
        assert "CS505" not in codes_fac1

        res_fac1_today = client.get("/api/faculty/timetable/today?day_of_week=TUESDAY", headers=faculty_auth)
        assert res_fac1_today.status_code == 200
        codes_fac1_today = [e["subject_code"] for e in res_fac1_today.json()["today_classes"]]
        assert "CS505" not in codes_fac1_today

        # Faculty 2 queries their schedule: CS505 MUST be present
        res_fac2 = client.get("/api/timetable/my", headers=faculty2_auth)
        assert res_fac2.status_code == 200
        assert res_fac2.json()["faculty_id"] == "FAC02"
        codes_fac2 = [e["subject_code"] for e in res_fac2.json()["timetable"]]
        assert "CS505" in codes_fac2
        # Faculty 2 must NOT see Faculty 1's classes (e.g. CS301)
        assert all(e["faculty_id"] == "FAC02" for e in res_fac2.json()["timetable"])

        # Attempt to spoof/manipulate query parameters on /api/timetable/my
        res_spoof = client.get("/api/timetable/my?faculty_id=faculty", headers=faculty2_auth)
        assert res_spoof.status_code == 200
        # It MUST still return FAC02's timetable, not 'faculty's!
        assert res_spoof.json()["faculty_id"] == "FAC02"
        assert all(e["faculty_id"] == "FAC02" for e in res_spoof.json()["timetable"])

    finally:
        client.delete(f"/api/admin/timetable/{entry_id}", headers=admin_auth)


# ==============================================================================
# 3. EMPTY SCHEDULE & EDGE CASE TESTS
# ==============================================================================

def test_faculty_empty_schedule_returns_gracefully(client, faculty_empty_auth):
    """A faculty member with no assigned lectures receives an empty schedule with HTTP 200."""
    res_my = client.get("/api/timetable/my", headers=faculty_empty_auth)
    assert res_my.status_code == 200
    data_my = res_my.json()
    assert data_my["role"] == "faculty"
    assert data_my["faculty_id"] == "FAC_EMPTY"
    assert data_my["count"] == 0
    assert data_my["timetable"] == []

    res_today = client.get("/api/faculty/timetable/today?day_of_week=MONDAY", headers=faculty_empty_auth)
    assert res_today.status_code == 200
    data_today = res_today.json()
    assert data_today["count"] == 0
    assert data_today["today_classes"] == []


# ==============================================================================
# 4. AUTHORIZATION AND RBAC TESTS
# ==============================================================================

def test_unauthenticated_requests_are_rejected(client):
    """Requests without a valid bearer token are rejected with HTTP 401."""
    assert client.get("/api/timetable/my").status_code == 401
    assert client.get("/api/faculty/timetable/today").status_code == 401


def test_student_cannot_access_faculty_today_timetable(client, student_auth):
    """Students are forbidden from accessing faculty-only timetable endpoint."""
    res = client.get("/api/faculty/timetable/today", headers=student_auth)
    assert res.status_code == 403


def test_faculty_cannot_modify_or_publish_official_timetable(client, faculty_auth):
    """Faculty members have read-only access and cannot POST, PUT, DELETE, or publish."""
    dummy_payload = {
        "subject_code": "MALICIOUS",
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
    assert client.post("/api/admin/timetable", json=dummy_payload, headers=faculty_auth).status_code == 403

    # Update slot -> 403
    assert client.put(f"/api/admin/timetable/{fake_id}", json=dummy_payload, headers=faculty_auth).status_code == 403

    # Delete slot -> 403
    assert client.delete(f"/api/admin/timetable/{fake_id}", headers=faculty_auth).status_code == 403

    # Publish slot -> 403
    assert client.post(f"/api/admin/timetable/{fake_id}/publish", json={"is_published": True}, headers=faculty_auth).status_code == 403

    # Batch publish -> 403
    assert client.post("/api/admin/timetable/batch-publish", json={"is_published": True}, headers=faculty_auth).status_code == 403
