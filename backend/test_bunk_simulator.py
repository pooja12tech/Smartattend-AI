import pytest
from fastapi.testclient import TestClient
import main
main.DEVICE_BINDING_ENABLED = False
from main import app, calculate_bunk_metrics, simulate_attendance_scenario

client = TestClient(app)

def test_calculate_bunk_metrics_math():
    # 34 attended out of 40 = 85.0%, threshold 75%
    res = calculate_bunk_metrics(34, 40, 75.0)
    assert res["status"] == "SAFE"
    assert res["safe_skips"] == 5
    assert res["classes_needed"] == 0

    # 27 attended out of 40 = 67.5%, threshold 75%
    res_danger = calculate_bunk_metrics(27, 40, 75.0)
    assert res_danger["status"] == "DEFICIT"
    assert res_danger["safe_skips"] == 0
    assert res_danger["classes_needed"] == 12

    # Verification: 27 + 12 = 39, 40 + 12 = 52, 39 / 52 = 75.0%
    assert round((27 + res_danger["classes_needed"]) / (40 + res_danger["classes_needed"]) * 100.0, 1) >= 75.0

def test_simulate_attendance_scenario():
    # Aarav Sharma at 85% attendance, planning 2 bunks
    sim = simulate_attendance_scenario(34, 40, planned_bunks=2, planned_attends=0, threshold=75.0)
    assert sim["original_pct"] == 85.0
    # 34 / 42 = 80.95% -> 81.0%
    assert sim["projected_pct"] == 81.0
    assert sim["pct_delta"] == -4.0
    assert sim["status"] == "SAFE"
    assert sim["safe_skips"] == 3  # (34 - 0.75 * 42) / 0.75 = (34 - 31.5) / 0.75 = 2.5 / 0.75 = 3.33 -> 3
    assert len(sim["roadmap"]) > 0

    # Danger zone student: 27/40 = 67.5%
    sim_rec = simulate_attendance_scenario(27, 40, planned_bunks=0, planned_attends=0, threshold=75.0)
    assert sim_rec["status"] == "DEFICIT"
    assert sim_rec["classes_needed"] == 12
    # Verify roadmap has progressive recovery steps
    assert len(sim_rec["roadmap"]) > 0
    assert sim_rec["roadmap"][-1]["reached_target"] is True

def test_simulate_future_events():
    future_events = [
        {
            "date": "2026-10-24",
            "day": "Friday",
            "title": "Hackathon Leave",
            "action": "BUNK",
            "classes_count": 2
        },
        {
            "date": "2026-10-27",
            "day": "Monday",
            "title": "Full Attendance",
            "action": "ATTEND",
            "classes_count": 2
        }
    ]
    sim = simulate_attendance_scenario(34, 40, future_events=future_events, threshold=75.0)
    assert sim["planned_bunks"] == 2
    assert sim["planned_attends"] == 2
    # 34 + 2 = 36 attended, 40 + 4 = 44 total -> 36 / 44 = 81.8%
    assert sim["projected_attended"] == 36
    assert sim["projected_total"] == 44
    assert len(sim["event_timeline"]) == 2
    assert sim["event_timeline"][0]["action"] == "BUNK"

def test_api_student_simulate_endpoint():
    # 1. Login as student
    login_res = client.post("/api/login", json={"roll_no": "student", "password": "studentpassword"})
    assert login_res.status_code == 200, login_res.text
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Test simulation API with Friday Hackathon scenario
    payload = {
        "subject_code": "CS301",
        "planned_bunks": 2,
        "planned_attends": 0,
        "target_threshold": 75.0,
        "future_events": [
            {
                "date": "2026-10-24",
                "day": "Friday",
                "title": "National Hackathon Leave",
                "action": "BUNK",
                "classes_count": 2
            }
        ]
    }

    res = client.post("/api/student/student/simulate", json=payload, headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["success"] is True
    sim = data["simulation"]
    assert "projected_pct" in sim
    assert "safe_skips" in sim or "classes_needed" in sim
    assert "roadmap" in sim
    assert "event_timeline" in sim
    assert len(sim["event_timeline"]) == 1
    assert sim["event_timeline"][0]["title"] == "National Hackathon Leave"
