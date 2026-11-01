"""
Live verification script for AI-Based Faculty Insights & Attendance Intelligence.
Can be executed against a running HTTP server (http://127.0.0.1:8000) or
falls back automatically to in-process FastAPI TestClient for standalone execution.
"""
import sys
import requests
from fastapi.testclient import TestClient

def get_client_or_session():
    # Test if live HTTP server is listening
    try:
        r = requests.get('http://127.0.0.1:8000/health', timeout=1.5)
        if r.status_code == 200:
            print("[INFO] Connected to live server at http://127.0.0.1:8000")
            class LiveClient:
                def post(self, url, **kwargs):
                    return requests.post(f'http://127.0.0.1:8000{url}', **kwargs)
                def get(self, url, **kwargs):
                    return requests.get(f'http://127.0.0.1:8000{url}', **kwargs)
            return LiveClient()
    except Exception:
        pass

    print("[INFO] Live server offline; executing in-process via FastAPI TestClient...")
    from main import app, limiter
    from db_postgres import init_db_schema
    from seed_postgres import run_postgres_seed
    init_db_schema()
    run_postgres_seed()
    limiter.reset()
    return TestClient(app)


def test_live():
    client = get_client_or_session()

    # 1. Faculty Login
    res = client.post('/api/login', json={'roll_no': 'FAC01', 'password': 'fac123'})
    if res.status_code != 200:
        res = client.post('/api/login', json={'roll_no': 'faculty', 'password': 'facultypassword'})
    print('Login status:', res.status_code)
    assert res.status_code == 200, res.text
    token = res.json().get('access_token') or res.json().get('token')
    headers = {'Authorization': f'Bearer {token}'}

    # 2. Filters
    res_filters = client.get('/api/faculty/insights/filters', headers=headers)
    print('Filters status:', res_filters.status_code)
    filters_data = res_filters.json()
    print('Sections:', filters_data.get('sections'))
    print('Subjects count:', len(filters_data.get('subjects', [])))
    print('Date ranges:', [d['id'] for d in filters_data.get('date_ranges', [])])

    # 3. Overview
    res_ov = client.get('/api/faculty/insights/overview?threshold=75.0', headers=headers)
    print('Overview status:', res_ov.status_code)
    ov_data = res_ov.json()
    assert ov_data.get('success') is True

    print('\n--- Insight Cards ---')
    cards = ov_data.get('cards') or ov_data.get('insight_cards') or []
    for c in cards:
        print(f"  [{c['id']}] {c['title']}: {c['value']} ({c['subtitle']}) -> {c['description']}")

    print('\n--- Metadata ---')
    print('  Sessions analyzed:', ov_data.get('metadata', {}).get('total_sessions_analyzed'))
    print('  Records analyzed:', ov_data.get('metadata', {}).get('total_records_analyzed'))
    print('  Threshold %:', ov_data.get('metadata', {}).get('threshold_pct'))

    print('\n--- Subject Trends ---')
    subj_data = ov_data.get('subject_trends', {})
    subjects = subj_data.get('subjects', []) if isinstance(subj_data, dict) else subj_data
    for s in subjects[:4]:
        name = s.get('subject_name') or s.get('subject_code')
        pct = s.get('overall_pct') if s.get('overall_pct') is not None else s.get('attendance_percentage')
        status = s.get('trend_status') or s.get('trend')
        delta = s.get('delta_pct') if s.get('delta_pct') is not None else s.get('trend_delta')
        print(f"  {name}: {pct}% | Trend: {status} | Delta: {delta}% | {s.get('trend_explanation', '')}")

    print('\n--- Weekday Patterns ---')
    day_data = ov_data.get('day_patterns', {})
    days = day_data.get('days', []) if isinstance(day_data, dict) else day_data
    for p in days:
        avg = p.get('average_attendance_pct') if p.get('average_attendance_pct') is not None else p.get('average_attendance')
        cnt = p.get('sessions_conducted') if p.get('sessions_conducted') is not None else p.get('lecture_count')
        print(f"  {p.get('day_name')}: {avg}% ({cnt} lectures) [recurring: {p.get('is_recurring_pattern')}]")
    if isinstance(day_data, dict) and day_data.get('insight_text'):
        print(f"  Observation: {day_data['insight_text']}")

    print('\n--- Personalized Student Interventions ---')
    interventions = ov_data.get('interventions') or ov_data.get('recommended_actions') or []
    for act in interventions[:4]:
        print(f"  * [{act.get('priority')}] {act.get('student_name')} ({act.get('roll_no')}): {act.get('current_pct')}% -> {act.get('summary')}")

    # 4. Students Drilldown
    res_stu = client.get('/api/faculty/insights/students?threshold=75.0', headers=headers)
    print('\nStudents Drilldown status:', res_stu.status_code)
    stu_data = res_stu.json()
    all_students = stu_data.get('students', [])
    print('Total students returned:', len(all_students))
    for s in all_students[:4]:
        print(f"  {s['name']} ({s['roll_no']}) - {s['current_pct']}% | Tier: {s['risk_tier']} | Attended: {s['attended_classes']}/{s['conducted_classes']} | Needed: {s['classes_needed']} | Safe Cuts: {s['safe_cuts_available']}")

    # 5. Notify Student Intervention
    if all_students:
        target = all_students[0]['roll_no']
        res_notif = client.post('/api/faculty/insights/notify-student', json={
            'roll_no': target,
            'title': 'Official Attendance Deficit Notice',
            'message': 'Official attendance alert: your attendance is below the 75% required threshold. Please attend upcoming lectures.',
            'severity': 'WARNING',
            'target_attendance': 75.0
        }, headers=headers)
        print('\nNotify student status:', res_notif.status_code)
        print('Notify student body:', res_notif.json())
        assert res_notif.status_code == 200

    print("\n[SUCCESS] All live faculty insights verification checks passed!")

if __name__ == '__main__':
    test_live()
