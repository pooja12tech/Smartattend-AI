import os
import sys
import base64
import io
import numpy as np
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

# Mock face embedding extraction
import face_service
_dummy_vector = np.ones(512, dtype=np.float32) / np.linalg.norm(np.ones(512, dtype=np.float32))

# Import FastAPI app
import main
main.DEVICE_BINDING_ENABLED = False
from main import app

def create_synthetic_classroom_b64() -> str:
    """Create a wide 1280x720 synthetic classroom image with test face regions."""
    img = Image.new("RGB", (1280, 720), color=(40, 44, 52))
    draw = ImageDraw.Draw(img)
    
    # Draw simple simulated face ovals in classroom seats
    colors = [(240, 200, 180), (220, 180, 160), (200, 160, 140)]
    for i in range(5):
        cx = 200 + (i * 200)
        cy = 360
        draw.ellipse([cx - 40, cy - 50, cx + 40, cy + 50], fill=colors[i % len(colors)])
    
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")

def test_category2_suite():
    print("=" * 60)
    print(" SmartAttend-AI : Testing Category 2 (Next-Gen AI Biometrics & Fraud)")
    print("=" * 60)

    client = TestClient(app)

    # 1. Faculty Login
    res = client.post("/api/login", json={"roll_no": "faculty", "password": "facultypassword"})
    assert res.status_code == 200, f"Faculty login failed: {res.text}"
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[PASS] 1. Faculty Authenticated successfully.")

    # 2. Start a lecture session
    res = client.post("/api/sessions/start", json={
        "subject_name": "CS301 - Operating Systems",
        "class_lat": 28.5450,
        "class_lng": 77.1926,
        "geofence_radius_meters": 150
    }, headers=headers)
    assert res.status_code == 200, f"Session start failed: {res.text}"
    session_id = res.json()["session"]["session_id"]
    print(f"[PASS] 2. Active Session started: {session_id}")

    # 3. Test GET /api/faculty/session/{session_id}/fraud-syndicate
    res = client.get(f"/api/faculty/session/{session_id}/fraud-syndicate", headers=headers)
    assert res.status_code == 200, f"Fraud syndicate failed: {res.text}"
    data = res.json()
    assert "syndicates" in data, "Missing syndicates in response"
    assert "total_alerts" in data, "Missing total_alerts in response"
    print(f"[PASS] 3. Fraud Syndicate Intel API OK! Total alerts: {data['total_alerts']}, Syndicates: {data['syndicates_detected']}")

    # 4. Test POST /api/faculty/session/{session_id}/panoramic-attendance
    panoramic_b64 = create_synthetic_classroom_b64()
    res = client.post(
        f"/api/faculty/session/{session_id}/panoramic-attendance",
        json={"image_base64": panoramic_b64, "auto_mark": True},
        headers=headers
    )
    assert res.status_code == 200, f"Panoramic attendance failed: {res.text}"
    pan_data = res.json()
    assert pan_data["success"] is True
    assert "total_detected_faces" in pan_data
    assert "annotated_image_base64" in pan_data
    print(f"[PASS] 4. Panoramic Classroom Snapshot AI API OK! Detected: {pan_data['total_detected_faces']} faces, Matched: {pan_data['matched_count']}, Annotated: {len(pan_data['annotated_image_base64'])} chars")

    # 5. Clean up - end session
    res = client.post(f"/api/sessions/{session_id}/end", headers=headers)
    assert res.status_code == 200
    print("[PASS] 5. Session ended successfully.")

    print("=" * 60)
    print(" ALL CATEGORY 2 FEATURES VERIFIED AND PASSING 100%! ")
    print("=" * 60)

if __name__ == "__main__":
    test_category2_suite()
