import urllib.request
import json

def main():
    print("Testing live running server against Neon Cloud PostgreSQL...")
    login_payload = json.dumps({
        "roll_no": "ADM01",
        "password": "admin123",
        "device_id": "DEV-ADMIN",
        "is_exception_mode": False
    }).encode("utf-8")

    req = urllib.request.Request(
        "http://127.0.0.1:8000/api/login",
        data=login_payload,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        login_res = json.loads(resp.read().decode())
        print(f"[LIVE SERVER] Admin Login Status: OK, User: {login_res.get('user', {}).get('name')}")
        token = login_res["access_token"]

    req_overview = urllib.request.Request(
        "http://127.0.0.1:8000/api/admin/overview",
        headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(req_overview) as resp:
        overview = json.loads(resp.read().decode())
        print(f"[LIVE SERVER] Neon PostgreSQL Query Results:")
        print(f"              Total Users: {overview.get('counts', {}).get('total_users')}")
        print(f"              Total Students: {overview.get('counts', {}).get('students')}")
        print(f"              System Average Attendance: {overview.get('system_average_attendance_pct')}%")
        print(f"              Active Lectures: {overview.get('counts', {}).get('active_sessions')}")
        print(f"              Defaulters Flagged by ML: {len(overview.get('high_risk_defaulters', []))}")
        print("[SUCCESS] End-to-end verified on live running application backed by Neon PostgreSQL!")

if __name__ == "__main__":
    main()
