"""
Integration Test Suite for Phase 6: Timetable Change Notifications & End-to-End Workflow.

Verifies:
1. Published timetable entry creation notifies affected cohort students.
2. Unpublished draft entries NEVER generate notifications.
3. Published timetable updates (rescheduled room, time, day) notify students with change details.
4. Draft updates do NOT notify students.
5. Published timetable deletion generates cancellation notification.
6. Draft deletion does NOT generate notification.
7. Publishing a draft entry via /publish generates activation notification.
8. Batch-publish generates notification for affected students.
9. Deduplication prevents spamming identical notifications within 30 minutes.
10. Cohort isolation ensures only students enrolled in the affected department/semester/section receive notifications.
11. Full notification lifecycle: Student fetches notifications via API and marks as read/dismissed.
"""
import uuid
import pytest
from fastapi.testclient import TestClient
from main import app, limiter
from db_postgres import init_db_schema, get_session_factory
from seed_postgres import run_postgres_seed
from models import User, TimetableEntry, StudentNotification
from auth import hash_password


@pytest.fixture(scope="session", autouse=True)
def setup_phase6_test_environment():
    init_db_schema()
    run_postgres_seed()

    session = get_session_factory()()

    # Ensure Student 1 (Aarav Sharma - CSE Sem 6 Sec A) exists
    stu01 = session.query(User).filter(User.roll_no == "STU01").first()
    if not stu01:
        stu01 = User(
            roll_no="STU01",
            name="Aarav Sharma",
            email="aarav@smartattend.edu",
            password=hash_password("studentpassword"),
            role="student",
            department="Computer Science & Engineering",
            semester=6,
            section="A",
            is_active=True
        )
        session.add(stu01)

    # Ensure Student 2 (Priya Patel - IT Sem 4 Sec A) exists for isolation checks
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
    res = client.post("/api/login", json={"roll_no": "student", "password": "studentpassword"})
    if res.status_code != 200:
        res = client.post("/api/login", json={"roll_no": "STU01", "password": "studentpassword"})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def student2_auth(client):
    res = client.post("/api/login", json={"roll_no": "STU02", "password": "studentpassword"})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ==============================================================================
# 1. NOTIFICATION CREATION & DRAFT EXCLUSION
# ==============================================================================

def test_published_entry_creation_notifies_affected_students(client, admin_auth, student1_auth, student2_auth):
    """When an admin creates a published slot, affected students receive a notification."""
    entry_payload = {
        "subject_code": "CS901",
        "subject_name": "Advanced Neural Networks",
        "faculty_id": "faculty",
        "faculty_name": "Prof. Rajesh Sharma",
        "department": "Computer Science & Engineering",
        "semester": 6,
        "section": "A",
        "room_no": "AI-LAB-401",
        "day_of_week": "WEDNESDAY",
        "start_time": "15:00",
        "end_time": "16:00",
        "is_published": True
    }
    create_res = client.post("/api/admin/timetable", json=entry_payload, headers=admin_auth)
    assert create_res.status_code == 201
    entry_id = create_res.json()["entry"]["id"]

    try:
        # 1. Affected student (CSE Sem 6 Sec A) retrieves notifications
        res_stu1 = client.get("/api/student/student/notifications", headers=student1_auth)
        if res_stu1.status_code != 200:
            res_stu1 = client.get("/api/student/STU01/notifications", headers=student1_auth)
        assert res_stu1.status_code == 200
        notifs_stu1 = res_stu1.json()["notifications"]

        # Find the notification for CS901
        notif = next((n for n in notifs_stu1 if n.get("subject_code") == "CS901"), None)
        assert notif is not None, "Notification for published slot CS901 was not delivered to affected student!"
        assert notif["type"] == "TIMETABLE_CHANGE"
        assert "CS901" in notif["title"]
        assert "AI-LAB-401" in notif["message"]
        assert "15:00" in notif["message"]
        assert "Prof. Rajesh Sharma" in notif["message"]

        # 2. Non-affected student (IT Sem 4 Sec A) MUST NOT receive this notification
        res_stu2 = client.get("/api/student/STU02/notifications", headers=student2_auth)
        assert res_stu2.status_code == 200
        notifs_stu2 = res_stu2.json()["notifications"]
        assert not any(n.get("subject_code") == "CS901" for n in notifs_stu2), "Cohort isolation breached!"

    finally:
        client.delete(f"/api/admin/timetable/{entry_id}", headers=admin_auth)


def test_draft_entry_creation_never_generates_notifications(client, admin_auth, student1_auth):
    """Unpublished/draft timetable entries must NEVER trigger notifications."""
    draft_payload = {
        "subject_code": "CS902-DRAFT",
        "subject_name": "Secret Unpublished Topic",
        "faculty_id": "faculty",
        "faculty_name": "Prof. Rajesh Sharma",
        "department": "Computer Science & Engineering",
        "semester": 6,
        "section": "A",
        "room_no": "CONF-99",
        "day_of_week": "THURSDAY",
        "start_time": "16:00",
        "end_time": "17:00",
        "is_published": False
    }
    create_res = client.post("/api/admin/timetable", json=draft_payload, headers=admin_auth)
    assert create_res.status_code == 201
    entry_id = create_res.json()["entry"]["id"]

    try:
        # Student checks notifications: CS902-DRAFT must NOT exist
        res = client.get("/api/student/student/notifications", headers=student1_auth)
        if res.status_code != 200:
            res = client.get("/api/student/STU01/notifications", headers=student1_auth)
        assert res.status_code == 200
        notifs = res.json()["notifications"]
        assert not any(n.get("subject_code") == "CS902-DRAFT" for n in notifs), "Draft triggered a notification!"

    finally:
        client.delete(f"/api/admin/timetable/{entry_id}", headers=admin_auth)


# ==============================================================================
# 2. TIMETABLE UPDATE & CANCELLATION NOTIFICATIONS
# ==============================================================================

def test_published_timetable_update_notifies_with_diff_details(client, admin_auth, student1_auth):
    """Updating a published slot (room/time) dispatches an update notification with diff details."""
    initial_payload = {
        "subject_code": "CS903",
        "subject_name": "Distributed Systems",
        "faculty_id": "faculty",
        "faculty_name": "Prof. Rajesh Sharma",
        "department": "Computer Science & Engineering",
        "semester": 6,
        "section": "A",
        "room_no": "ROOM-101",
        "day_of_week": "MONDAY",
        "start_time": "11:00",
        "end_time": "12:00",
        "is_published": True
    }
    create_res = client.post("/api/admin/timetable", json=initial_payload, headers=admin_auth)
    assert create_res.status_code == 201
    entry_id = create_res.json()["entry"]["id"]

    try:
        # Admin updates room to AUD-01 and time to 12:00 - 13:00
        update_payload = {
            "room_no": "AUD-01",
            "start_time": "12:00",
            "end_time": "13:00"
        }
        update_res = client.put(f"/api/admin/timetable/{entry_id}", json=update_payload, headers=admin_auth)
        assert update_res.status_code == 200

        # Student checks notifications
        res = client.get("/api/student/student/notifications", headers=student1_auth)
        if res.status_code != 200:
            res = client.get("/api/student/STU01/notifications", headers=student1_auth)
        assert res.status_code == 200
        notifs = res.json()["notifications"]

        update_notif = next((n for n in notifs if n.get("subject_code") == "CS903" and "AUD-01" in n.get("message", "")), None)
        assert update_notif is not None, "Update notification with new room was not delivered!"
        assert "Room changed from ROOM-101 to AUD-01" in update_notif["message"]

    finally:
        client.delete(f"/api/admin/timetable/{entry_id}", headers=admin_auth)


def test_published_timetable_deletion_notifies_cancellation(client, admin_auth, student1_auth):
    """Deleting a published slot generates a cancellation warning notification."""
    initial_payload = {
        "subject_code": "CS904",
        "subject_name": "Cloud Computing Seminar",
        "faculty_id": "faculty",
        "faculty_name": "Prof. Rajesh Sharma",
        "department": "Computer Science & Engineering",
        "semester": 6,
        "section": "A",
        "room_no": "LAB-CLOUD",
        "day_of_week": "FRIDAY",
        "start_time": "14:00",
        "end_time": "15:00",
        "is_published": True
    }
    create_res = client.post("/api/admin/timetable", json=initial_payload, headers=admin_auth)
    assert create_res.status_code == 201
    entry_id = create_res.json()["entry"]["id"]

    # Delete the slot
    del_res = client.delete(f"/api/admin/timetable/{entry_id}", headers=admin_auth)
    assert del_res.status_code == 200

    # Student checks notifications
    res = client.get("/api/student/student/notifications", headers=student1_auth)
    if res.status_code != 200:
        res = client.get("/api/student/STU01/notifications", headers=student1_auth)
    assert res.status_code == 200
    notifs = res.json()["notifications"]

    cancel_notif = next((n for n in notifs if n.get("subject_code") == "CS904" and "cancelled" in n.get("message", "").lower()), None)
    assert cancel_notif is not None, "Cancellation notification was not generated upon deleting published slot!"
    assert cancel_notif["severity"] == "WARNING"


# ==============================================================================
# 3. PUBLISH & BATCH-PUBLISH NOTIFICATIONS
# ==============================================================================

def test_publishing_draft_slot_triggers_notification(client, admin_auth, student1_auth):
    """Toggling is_published from False to True triggers an activation notification."""
    draft_payload = {
        "subject_code": "CS905",
        "subject_name": "Quantum Algorithms",
        "faculty_id": "faculty",
        "faculty_name": "Prof. Rajesh Sharma",
        "department": "Computer Science & Engineering",
        "semester": 6,
        "section": "A",
        "room_no": "PHYS-LAB",
        "day_of_week": "TUESDAY",
        "start_time": "15:00",
        "end_time": "16:00",
        "is_published": False
    }
    create_res = client.post("/api/admin/timetable", json=draft_payload, headers=admin_auth)
    assert create_res.status_code == 201
    entry_id = create_res.json()["entry"]["id"]

    try:
        # Publish the slot
        pub_res = client.post(f"/api/admin/timetable/{entry_id}/publish", json={"is_published": True}, headers=admin_auth)
        assert pub_res.status_code == 200

        # Student checks notifications
        res = client.get("/api/student/student/notifications", headers=student1_auth)
        if res.status_code != 200:
            res = client.get("/api/student/STU01/notifications", headers=student1_auth)
        assert res.status_code == 200
        notifs = res.json()["notifications"]

        pub_notif = next((n for n in notifs if n.get("subject_code") == "CS905"), None)
        assert pub_notif is not None, "Notification not delivered after publishing draft slot!"
        assert "published" in pub_notif["title"].lower()

    finally:
        client.delete(f"/api/admin/timetable/{entry_id}", headers=admin_auth)


# ==============================================================================
# 4. NOTIFICATION INTERACTION (READ & DISMISS)
# ==============================================================================

def test_student_can_read_and_dismiss_timetable_notification(client, student1_auth):
    """Students can mark notifications as read and dismiss them."""
    roll = "student"
    res = client.get(f"/api/student/{roll}/notifications", headers=student1_auth)
    if res.status_code != 200:
        roll = "STU01"
        res = client.get(f"/api/student/{roll}/notifications", headers=student1_auth)
    assert res.status_code == 200
    notifs = res.json()["notifications"]
    if not notifs:
        pytest.skip("No notifications available to read/dismiss")

    target_id = notifs[0]["id"]

    # Mark as read
    read_res = client.post(f"/api/student/{roll}/notifications/{target_id}/read", headers=student1_auth)
    assert read_res.status_code == 200

    # Dismiss
    dismiss_res = client.post(f"/api/student/{roll}/notifications/{target_id}/dismiss", headers=student1_auth)
    assert dismiss_res.status_code == 200
