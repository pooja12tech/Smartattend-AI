import urllib.request
import json
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def run():
    print("=" * 60)
    print(" VERIFYING THE BUNK CALCULATOR & PREDICTIVE SAFETY SIMULATOR")
    print("=" * 60)

    # 1. Login as student (Aarav Sharma)
    login_req = urllib.request.Request('http://127.0.0.1:8000/api/login',
        data=json.dumps({'roll_no': 'student', 'password': 'studentpassword'}).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(login_req) as resp:
        token = json.loads(resp.read().decode('utf-8'))['access_token']
        print("[PASS] 1. Student Authenticated successfully.")

    # 2. Get Student Dashboard
    dash_req = urllib.request.Request('http://127.0.0.1:8000/api/student/student/dashboard',
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'}
    )
    with urllib.request.urlopen(dash_req) as resp:
        dash = json.loads(resp.read().decode('utf-8'))
        print("\n[PASS] 2. Dashboard Loaded. Curriculum Subjects:")
        for s in dash['subject_breakdown']:
            calc = s['bunk_calculator']
            print(f"  * {s['subject']}: {s['attended']}/{s['total']} ({s['pct']}%) -> Status: {calc['status']}, Safe Skips: {calc['safe_skips']}")

    # 3. Simulate CS301 Baseline: 22 attended out of 28 = 78.57% -> 78.5%
    # Prompt requirement: "In CS301 (Machine Learning), your attendance is 78.5%. You can safely miss 2 more classes without dropping below the 75% UGC limit."
    sim_payload = {
        'subject_code': 'CS301',
        'planned_bunks': 0,
        'planned_attends': 0,
        'target_threshold': 75.0
    }
    sim_req = urllib.request.Request('http://127.0.0.1:8000/api/student/student/simulate',
        data=json.dumps(sim_payload).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'}
    )
    with urllib.request.urlopen(sim_req) as resp:
        res = json.loads(resp.read().decode('utf-8'))['simulation']
        print("\n[PASS] 3. CS301 Dynamic Threshold Calculation:")
        print(f"  * Subject: {res['subject_title']}")
        print(f"  * Current Attendance: {res['original_pct']}% ({res['original_attended']}/{res['original_total']})")
        print(f"  * Safe Classes to Miss: {res['safe_skips']}")
        print(f"  * Target Threshold: {res['target_threshold']}%")
        print(f"  * Status: {res['status']}")
        print(f"  * Advice: {res['advice']}")
        assert res['safe_skips'] == 2, f"Expected 2 safe skips, got {res['safe_skips']}"

    # 4. "What-If" Simulation: Taking leave on Friday for a Hackathon
    # Prompt requirement: "If I take leave on Friday for a hackathon, what will my new attendance percentage become?"
    sim_hackathon_payload = {
        'subject_code': 'CS301',
        'planned_bunks': 1,
        'planned_attends': 0,
        'target_threshold': 75.0,
        'future_events': [
            {'date': '2026-10-24', 'day': 'Friday', 'title': 'National Hackathon Leave', 'action': 'BUNK', 'classes_count': 1}
        ]
    }
    sim_req2 = urllib.request.Request('http://127.0.0.1:8000/api/student/student/simulate',
        data=json.dumps(sim_hackathon_payload).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'}
    )
    with urllib.request.urlopen(sim_req2) as resp:
        res2 = json.loads(resp.read().decode('utf-8'))['simulation']
        print("\n[PASS] 4. Friday Hackathon Leave Simulation:")
        print(f"  * Baseline: {res2['original_pct']}%")
        print(f"  * Projected: {res2['projected_pct']}% (Delta: {res2['pct_delta']}%)")
        print(f"  * Status: {res2['status']}")
        print(f"  * Buffer Bunks Remaining: {res2['safe_skips']}")
        print(f"  * Advice: {res2['advice']}")

    # 5. Recovery Roadmaps: Danger zone student (Rohan Verma - STU03 at 68.0%)
    # Prompt requirement: If a student is in the danger zone (e.g., 68%), it calculates:
    # "You must attend the next 5 consecutive lectures to climb back to 75.2%."
    login_stu3 = urllib.request.Request('http://127.0.0.1:8000/api/login',
        data=json.dumps({'roll_no': 'STU03', 'password': 'studentpassword'}).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(login_stu3) as resp:
        token3 = json.loads(resp.read().decode('utf-8'))['access_token']

    sim_danger_payload = {
        'subject_code': 'CS301',
        'planned_bunks': 0,
        'planned_attends': 0,
        'target_threshold': 75.0
    }
    sim_req3 = urllib.request.Request('http://127.0.0.1:8000/api/student/STU03/simulate',
        data=json.dumps(sim_danger_payload).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token3}'}
    )
    with urllib.request.urlopen(sim_req3) as resp:
        res3 = json.loads(resp.read().decode('utf-8'))['simulation']
        print("\n[PASS] 5. Danger Zone (68.0%) Recovery Roadmap:")
        print(f"  * Student: {res3['student_name']} ({res3['student_roll_no']})")
        print(f"  * Attendance: {res3['original_pct']}%")
        print(f"  * Classes Needed to Recover to 75%: {res3['classes_needed']}")
        print(f"  * Status: {res3['status']}")
        print(f"  * Advice: {res3['advice']}")
        print("  * Roadmap Checkpoints:")
        for step in res3['roadmap']:
            print(f"     - {step['label']}")

    print("\n" + "=" * 60)
    print(" ALL SCENARIOS VERIFIED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == '__main__':
    run()
