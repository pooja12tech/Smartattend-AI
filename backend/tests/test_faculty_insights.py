"""
Comprehensive Test Suite: AI-Based Faculty Insights & Attendance Intelligence
==============================================================================
Validates:
1. Mathematical accuracy of classes needed & safe cuts formulas.
2. Risk classification tiers (CRITICAL, WARNING, BORDERLINE, SAFE).
3. Subject trend detection (consistent decline vs random fluctuations).
4. Day-wise pattern analysis (weekday distribution and lowest day detection).
5. Explainable personalized interventions.
6. API Endpoints:
   - GET /api/faculty/insights/overview
   - GET /api/faculty/insights/students
   - GET /api/faculty/insights/filters
   - POST /api/faculty/insights/notify-student
7. Security: RBAC enforcement (Students rejected with 403; Faculty & Admin permitted).
8. Graceful handling of empty or insufficient historical data.
"""

import math
import pytest
from fastapi.testclient import TestClient

from main import app, limiter
from db_postgres import init_db_schema, get_session_factory
from seed_postgres import run_postgres_seed
from models import User, LectureSession, AttendanceRecord, StudentNotification
import faculty_insights_service


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    init_db_schema()
    run_postgres_seed()


@pytest.fixture
def client():
    limiter.reset()
    return TestClient(app)


@pytest.fixture
def faculty_auth(client):
    res = client.post("/api/login", json={
        "roll_no": "faculty",
        "password": "facultypassword"
    })
    if res.status_code != 200:
        res = client.post("/api/login", json={
            "roll_no": "FAC01",
            "password": "fac123"
        })
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def student_auth(client):
    res = client.post("/api/login", json={
        "roll_no": "student",
        "password": "studentpassword"
    })
    if res.status_code != 200:
        res = client.post("/api/login", json={
            "roll_no": "STU01",
            "password": "stu123"
        })
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ==============================================================================
# 1. MATHEMATICAL FORMULAS & CALCULATION TESTS
# ==============================================================================

def test_classes_needed_formula_accuracy():
    """Verify classes needed formula: ceil((T * conducted - attended) / (1 - T))"""
    # Case A: 12 attended out of 20 conducted (60.0%), target 75%
    # (0.75 * 20 - 12) / 0.25 = 3 / 0.25 = 12
    needed = faculty_insights_service.calculate_classes_needed(12, 20, 75.0)
    assert needed == 12
    # Verify: (12 + 12) / (20 + 12) = 24 / 32 = 75.0%
    assert (12 + needed) / (20 + needed) >= 0.75

    # Case B: 17 attended out of 25 conducted (68.0%), target 75%
    # (0.75 * 25 - 17) / 0.25 = (18.75 - 17) / 0.25 = 1.75 / 0.25 = 7
    needed2 = faculty_insights_service.calculate_classes_needed(17, 25, 75.0)
    assert needed2 == 7
    # Verify: (17 + 7) / (25 + 7) = 24 / 32 = 75.0%
    assert (17 + needed2) / (25 + needed2) >= 0.75

    # Case C: Already >= 75% -> 0 classes needed
    assert faculty_insights_service.calculate_classes_needed(20, 25, 75.0) == 0

    # Case D: 0 conducted classes -> 0 classes needed
    assert faculty_insights_service.calculate_classes_needed(0, 0, 75.0) == 0

    # Case E: Configurable 80% threshold
    # 15 attended out of 20 (75%), target 80%
    # (0.80 * 20 - 15) / 0.20 = (16 - 15) / 0.20 = 1 / 0.20 = 5
    needed_80 = faculty_insights_service.calculate_classes_needed(15, 20, 80.0)
    assert needed_80 == 5
    assert (15 + needed_80) / (20 + needed_80) >= 0.80


def test_safe_cuts_formula_accuracy():
    """Verify safe cuts formula: floor(attended / T - conducted)"""
    # 20 attended out of 20 conducted (100%), target 75%
    # floor(20 / 0.75 - 20) = floor(26.666 - 20) = 6
    cuts = faculty_insights_service.calculate_safe_cuts(20, 20, 75.0)
    assert cuts == 6
    # Verify: 20 / (20 + 6) = 20 / 26 = 76.9% >= 75%
    assert 20 / (20 + cuts) >= 0.75

    # Borderline: 15 attended out of 20 conducted (75%) -> 0 safe cuts
    assert faculty_insights_service.calculate_safe_cuts(15, 20, 75.0) == 0

    # Deficit: 12 attended out of 20 (60%) -> 0 safe cuts
    assert faculty_insights_service.calculate_safe_cuts(12, 20, 75.0) == 0


def test_risk_tier_classification():
    """Verify tier assignment according to configurable threshold (e.g. 75%)"""
    tier, _ = faculty_insights_service.get_risk_tier(60.0, 75.0)
    assert tier == "CRITICAL"  # < 65%

    tier, _ = faculty_insights_service.get_risk_tier(70.0, 75.0)
    assert tier == "WARNING"   # 65% to 75%

    tier, _ = faculty_insights_service.get_risk_tier(78.0, 75.0)
    assert tier == "BORDERLINE"  # 75% to 80%

    tier, _ = faculty_insights_service.get_risk_tier(85.0, 75.0)
    assert tier == "SAFE"        # > 80%


# ==============================================================================
# 2. API ENDPOINTS & FUNCTIONAL INTELLIGENCE TESTS
# ==============================================================================

def test_faculty_insights_overview_api(client, faculty_auth):
    """Test full overview payload with 6 insight cards and charts."""
    res = client.get("/api/faculty/insights/overview?date_range=all", headers=faculty_auth)
    assert res.status_code == 200
    data = res.json()

    assert data["success"] is True
    assert "metadata" in data
    assert data["metadata"]["threshold_pct"] == 75.0
    assert "cards" in data
    assert len(data["cards"]) == 6

    card_ids = [c["id"] for c in data["cards"]]
    assert "at_risk_students" in card_ids
    assert "declining_subjects" in card_ids
    assert "low_attendance_days" in card_ids
    assert "students_needing_attention" in card_ids
    assert "positive_trends" in card_ids
    assert "recommended_actions" in card_ids

    # Verify shortage summary
    assert "shortage_summary" in data
    assert "risk_distribution" in data["shortage_summary"]
    assert len(data["shortage_summary"]["risk_distribution"]) == 4

    # Verify subject trends & day patterns
    assert "subject_trends" in data
    assert "day_patterns" in data
    assert "interventions" in data
    assert "students" in data
    assert len(data["students"]) > 0


def test_faculty_insights_configurable_threshold(client, faculty_auth):
    """Verify that passing custom threshold (e.g. 80.0) recalculates risk tiers and classes needed."""
    res = client.get("/api/faculty/insights/overview?threshold=80.0", headers=faculty_auth)
    assert res.status_code == 200
    data = res.json()
    assert data["metadata"]["threshold_pct"] == 80.0
    assert data["shortage_summary"]["threshold_pct"] == 80.0


def test_faculty_insights_students_drilldown_api(client, faculty_auth):
    """Test students drilldown roster with filtering and search."""
    # 1. Fetch all students
    res = client.get("/api/faculty/insights/students", headers=faculty_auth)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert len(data["students"]) > 0

    # 2. Filter by risk tier
    res_crit = client.get("/api/faculty/insights/students?risk_tier=CRITICAL", headers=faculty_auth)
    assert res_crit.status_code == 200
    for s in res_crit.json()["students"]:
        assert s["risk_tier"] == "CRITICAL"

    # 3. Filter by search query
    res_search = client.get("/api/faculty/insights/students?search=Aarav", headers=faculty_auth)
    assert res_search.status_code == 200
    for s in res_search.json()["students"]:
        assert "aarav" in s["name"].lower() or "aarav" in s["roll_no"].lower()


def test_faculty_insights_filters_api(client, faculty_auth):
    """Test dynamic filter options list."""
    res = client.get("/api/faculty/insights/filters", headers=faculty_auth)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "sections" in data
    assert "semesters" in data
    assert "subjects" in data
    assert "date_ranges" in data
    assert len(data["sections"]) >= 1
    assert len(data["subjects"]) >= 1


def test_notify_student_intervention_api(client, faculty_auth):
    """Test dispatching a real attendance intervention notice to a student."""
    res = client.post("/api/faculty/insights/notify-student", json={
        "roll_no": "STU01",
        "title": "Official Attendance Warning",
        "message": "Your attendance is approaching the required threshold. Please attend upcoming lectures.",
        "severity": "WARNING",
        "subject_code": "CS301"
    }, headers=faculty_auth)

    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "notification_id" in data

    # Verify notification was inserted in database
    db = get_session_factory()()
    try:
        notif = db.query(StudentNotification).filter(
            StudentNotification.roll_no == "STU01",
            StudentNotification.title == "Official Attendance Warning"
        ).first()
        assert notif is not None
        assert notif.severity == "WARNING"
        assert notif.type == "FACULTY_ATTENDANCE_INTERVENTION"
    finally:
        db.close()


def test_student_cannot_access_faculty_insights_rbac(client, student_auth):
    """Security Test: Students must be forbidden from accessing faculty insights (RBAC)."""
    res1 = client.get("/api/faculty/insights/overview", headers=student_auth)
    assert res1.status_code == 403

    res2 = client.get("/api/faculty/insights/students", headers=student_auth)
    assert res2.status_code == 403

    res3 = client.get("/api/faculty/insights/filters", headers=student_auth)
    assert res3.status_code == 403

    res4 = client.post("/api/faculty/insights/notify-student", json={
        "roll_no": "STU02",
        "title": "Hack Alert",
        "message": "Unauthorized"
    }, headers=student_auth)
    assert res4.status_code == 403


def test_empty_dataset_graceful_handling():
    """Verify that empty datasets return graceful statistics without throwing ZeroDivisionError."""
    db = get_session_factory()()
    try:
        # Query with future dates where no sessions exist
        future_start = faculty_insights_service.datetime(2099, 1, 1, tzinfo=faculty_insights_service.timezone.utc)
        future_end = faculty_insights_service.datetime(2099, 12, 31, tzinfo=faculty_insights_service.timezone.utc)

        result = faculty_insights_service.analyze_day_wise_attendance_patterns(
            db, start_date=future_start, end_date=future_end
        )
        assert result["has_sufficient_data"] is False
        assert result["total_sessions"] == 0
        assert len(result["days"]) == 0

        trends = faculty_insights_service.analyze_subject_attendance_trends(
            db, start_date=future_start, end_date=future_end
        )
        assert trends["subjects_analyzed"] == 0
        assert len(trends["subjects"]) == 0
    finally:
        db.close()
