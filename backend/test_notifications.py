import math
import pytest
from fastapi.testclient import TestClient
import main
main.DEVICE_BINDING_ENABLED = False
from main import app, check_and_generate_attendance_notifications
from db_postgres import get_session_factory
from models import StudentNotification, User

client = TestClient(app)

def test_recovery_math_formula():
    """Verify formula for classes needed to recover from < 74% to >= 75%."""
    # Scenario A: 71.4% (20 attended out of 28 total)
    attended, total = 20, 28
    current_pct = round((attended / total) * 100.0, 1)
    assert current_pct < 74.0
    
    # y = ceil((0.75 * total - attended) / 0.25)
    needed = max(1, math.ceil((0.75 * total - attended) / 0.25))
    assert needed == 4
    new_pct = round((attended + needed) / (total + needed) * 100.0, 1)
    assert new_pct >= 75.0  # 24 / 32 = 75.0%

    # Scenario B: 68.0% (17 attended out of 25 total)
    attended2, total2 = 17, 25
    needed2 = max(1, math.ceil((0.75 * total2 - attended2) / 0.25))
    assert needed2 == 7
    new_pct2 = round((attended2 + needed2) / (total2 + needed2) * 100.0, 1)
    assert new_pct2 >= 75.0  # 24 / 32 = 75.0%

def test_check_and_generate_attendance_notifications_unit():
    Session = get_session_factory()
    db = Session()
    try:
        # STU03 has ~68% in CS301 (seeded below 74%)
        notifs = check_and_generate_attendance_notifications(db, "STU03", alert_threshold=74.0, target_criteria=75.0)
        assert isinstance(notifs, list)
        
        # Should have detected at least one deficit below 74%
        deficit_notifs = [n for n in notifs if n.current_pct < 74.0]
        assert len(deficit_notifs) >= 1
        
        alert = deficit_notifs[0]
        assert alert.severity == "CRITICAL"
        assert alert.alert_cutoff_pct == 74.0
        assert alert.threshold_pct == 75.0
        assert alert.classes_needed >= 1
        assert "74%" in alert.title or "74%" in alert.message
        assert f"{alert.classes_needed}" in alert.message
    finally:
        db.close()

def test_student_notifications_api():
    # 1. Login as STU03 (student in deficit) or student
    login_res = client.post("/api/login", json={"roll_no": "STU03", "password": "stu123"})
    if login_res.status_code != 200:
        login_res = client.post("/api/login", json={"roll_no": "student", "password": "studentpassword"})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    roll_no = login_res.json()["user"]["roll_no"]

    # 2. Trigger test warning alert to ensure active alert exists
    test_alert_res = client.post(f"/api/student/{roll_no}/test-warning-alert", headers=headers)
    assert test_alert_res.status_code == 200
    alert_data = test_alert_res.json()
    assert alert_data["success"] is True
    alert_info = alert_data["notification"]
    assert alert_info["current_pct"] < 74.0
    assert alert_info["classes_needed"] >= 1
    assert "consecutive" in alert_info["message"].lower() or "attend" in alert_info["message"].lower()

    # 3. Check dashboard returns notifications and attendance_alert
    dash_res = client.get(f"/api/student/{roll_no}/dashboard", headers=headers)
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert "notifications" in dash_data
    assert "unread_notifications_count" in dash_data
    assert "attendance_alert" in dash_data
    assert dash_data["attendance_alert"] is not None
    assert dash_data["attendance_alert"]["current_pct"] < 74.0

    # 4. Check list notifications endpoint
    list_res = client.get(f"/api/student/{roll_no}/notifications", headers=headers)
    assert list_res.status_code == 200
    notif_list = list_res.json()["notifications"]
    assert len(notif_list) >= 1
    notif_id = notif_list[0]["id"]

    # 5. Mark individual notification as read
    read_res = client.post(f"/api/student/{roll_no}/notifications/{notif_id}/read", headers=headers)
    assert read_res.status_code == 200
    assert read_res.json()["success"] is True

    # 6. Mark all as read
    mark_all_res = client.post(f"/api/student/{roll_no}/notifications/mark-all-read", headers=headers)
    assert mark_all_res.status_code == 200
    assert mark_all_res.json()["success"] is True

    # 7. Dismiss notification
    dismiss_res = client.post(f"/api/student/{roll_no}/notifications/{notif_id}/dismiss", headers=headers)
    assert dismiss_res.status_code == 200
    assert dismiss_res.json()["success"] is True
