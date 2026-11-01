"""
Faculty Insights & Attendance Intelligence Service
===================================================
Provides statistical and mathematical attendance intelligence for faculty members:
1. Attendance Shortage Risk Detection (Classes needed calculation, threshold breaches)
2. Subject-Wise Weekly Attendance Trend Analysis (Consistent declines, deltas, slope)
3. Day-Wise Attendance Pattern Analysis (Weekday averages, lowest attendance day detection)
4. Personalized Student Intervention Recommendations (Explainable rule-based actions)
5. Comprehensive Filterable Aggregates (Section, Subject, Semester, Date Range, Risk Category)
"""

import math
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_

from models import (
    User, LectureSession, AttendanceRecord, Subject,
    StudentSubjectEnrollment, StudentStats, StudentNotification
)


def _safe_float(val: Any, default: float = 0.0) -> float:
    try:
        f = float(val)
        return 0.0 if math.isnan(f) or math.isinf(f) else f
    except (TypeError, ValueError):
        return default


def calculate_classes_needed(attended: int, conducted: int, threshold_pct: float) -> Optional[int]:
    """
    Computes minimum consecutive future classes a student must attend to reach or maintain threshold_pct.
    Formula:
        (attended + x) / (conducted + x) >= T
        attended + x >= T * conducted + T * x
        x * (1 - T) >= T * conducted - attended
        x = ceil((T * conducted - attended) / (1 - T))
    Returns:
        int: Number of consecutive classes needed (0 if already at or above threshold).
        None: If mathematically impossible (e.g. threshold >= 100% and student has missed >= 1 class).
    """
    if conducted <= 0:
        return 0

    t = threshold_pct / 100.0

    # If threshold >= 1.0 (100%), any absence makes 100% impossible
    if t >= 1.0:
        return 0 if attended >= conducted else None

    current_pct = (attended / conducted) * 100.0
    if current_pct >= threshold_pct:
        return 0

    numerator = (t * conducted) - attended
    denominator = 1.0 - t

    if denominator <= 0:
        return None

    # Use round(..., 9) to eliminate binary float precision artifacts (e.g. 1.0 / 0.2 -> 5.000000000000001)
    needed = math.ceil(round(numerator / denominator, 9))
    return max(0, needed)


def calculate_safe_cuts(attended: int, conducted: int, threshold_pct: float) -> int:
    """
    Computes maximum classes a student can skip while remaining at or above threshold_pct.
    Formula:
        attended / (conducted + y) >= T
        y <= (attended / T) - conducted
        y = floor(attended / T - conducted)
    """
    if conducted <= 0 or attended <= 0:
        return 0
    t = threshold_pct / 100.0
    if t <= 0:
        return 999
    max_total = math.floor(round(attended / t, 9))
    return max(0, max_total - conducted)


def get_risk_tier(current_pct: float, threshold_pct: float) -> Tuple[str, str]:
    """
    Classifies student attendance risk into explainable tiers:
    - CRITICAL: < (threshold - 10%)
    - WARNING: between (threshold - 10%) and threshold
    - BORDERLINE: between threshold and (threshold + 5%)
    - SAFE: >= (threshold + 5%)
    """
    if current_pct < (threshold_pct - 10.0):
        return "CRITICAL", f"Attendance is {current_pct:.1f}%, far below the required {threshold_pct:.1f}%."
    elif current_pct < threshold_pct:
        return "WARNING", f"Attendance is {current_pct:.1f}%, below the required {threshold_pct:.1f}%."
    elif current_pct <= (threshold_pct + 5.0):
        return "BORDERLINE", f"Attendance is {current_pct:.1f}%, close to the {threshold_pct:.1f}% cutoff."
    else:
        return "SAFE", f"Attendance is {current_pct:.1f}%, in safe standing above {threshold_pct:.1f}%."


# ------------------------------------------------------------------------------
# 1. CORE QUERY HELPERS
# ------------------------------------------------------------------------------

def get_faculty_sessions_query(
    db: Session,
    faculty_id: Optional[str] = None,
    subject_code: Optional[str] = None,
    subject_name: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
):
    """Retrieves lecture sessions taught by this faculty within date boundaries."""
    query = db.query(LectureSession)

    if faculty_id and faculty_id != "admin":
        # Allow matching either roll_no or faculty name/ID
        query = query.filter(
            or_(
                LectureSession.faculty_id == faculty_id,
                LectureSession.faculty_id == "faculty"
            )
        )

    if subject_name and subject_name != "ALL":
        query = query.filter(LectureSession.subject_name.ilike(f"%{subject_name}%"))

    if subject_code and subject_code != "ALL":
        query = query.filter(LectureSession.subject_name.ilike(f"%{subject_code}%"))

    if start_date:
        query = query.filter(LectureSession.started_at >= start_date)
    if end_date:
        query = query.filter(LectureSession.started_at <= end_date)

    return query.order_by(LectureSession.started_at.asc())


# ------------------------------------------------------------------------------
# 2. SHORTAGE RISK & STUDENT INTELLIGENCE
# ------------------------------------------------------------------------------

def analyze_student_attendance_risks(
    db: Session,
    faculty_id: Optional[str] = None,
    section: Optional[str] = None,
    semester: Optional[int] = None,
    subject_filter: Optional[str] = None,
    threshold_override: Optional[float] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> Dict[str, Any]:
    """
    Computes section and student-level attendance shortage intelligence:
    - Identifies students below or approaching threshold
    - Calculates mathematical classes needed to recover
    - Calculates safe cuts for students in good standing
    """
    # 1. Identify Target Subject and Threshold
    threshold_pct = 75.0
    if threshold_override is not None and 10.0 <= threshold_override <= 100.0:
        threshold_pct = float(threshold_override)
    else:
        # Check if subject has custom min_attendance_pct
        if subject_filter and subject_filter != "ALL":
            subj_obj = db.query(Subject).filter(
                or_(Subject.code == subject_filter, Subject.name.ilike(f"%{subject_filter}%"))
            ).first()
            if subj_obj and subj_obj.min_attendance_pct:
                threshold_pct = float(subj_obj.min_attendance_pct)

    # 2. Filter Students
    student_query = db.query(User).filter(User.role == "student", User.is_active == True)
    if section and section != "ALL":
        student_query = student_query.filter(User.section == section)
    if semester and semester != 0:
        student_query = student_query.filter(User.semester == semester)

    students = student_query.order_by(User.roll_no.asc()).all()

    # 3. Filter relevant sessions
    sessions_query = get_faculty_sessions_query(
        db,
        faculty_id=faculty_id,
        subject_name=subject_filter,
        start_date=start_date,
        end_date=end_date
    )
    sessions = sessions_query.all()
    session_ids = [s.session_id for s in sessions]

    # Map session date and subject for chronology
    session_map = {s.session_id: s for s in sessions}

    # 4. Fetch all attendance records for these sessions
    records = []
    if session_ids:
        records = db.query(AttendanceRecord).filter(
            AttendanceRecord.session_id.in_(session_ids)
        ).order_by(AttendanceRecord.marked_at.asc()).all()

    # Group records by roll_no
    student_records_map: Dict[str, List[AttendanceRecord]] = {}
    for r in records:
        student_records_map.setdefault(r.roll_no, []).append(r)

    # 5. Analyze each student
    students_analysis = []
    below_threshold_count = 0
    at_risk_count = 0  # CRITICAL + WARNING + BORDERLINE
    critical_count = 0
    warning_count = 0
    borderline_count = 0
    safe_count = 0

    total_classes_conducted = len(sessions)

    for st in students:
        st_recs = student_records_map.get(st.roll_no, [])
        # Determine conducted count for this student
        # If student has records in student_subject_enrollments, consider that as fallback baseline if sessions are few
        enrolled_classes = len(st_recs)
        attended_classes = sum(
            1 for r in st_recs if r.status in ("PRESENT", "MANUAL_PRESENT")
        )
        absent_classes = sum(
            1 for r in st_recs if r.status == "ABSENT"
        )
        pending_classes = sum(
            1 for r in st_recs if r.status == "PENDING_APPROVAL"
        )

        # Baseline fallback to enrolled table if session records in current filter are empty
        conducted = enrolled_classes if enrolled_classes > 0 else total_classes_conducted
        if conducted == 0:
            # Check student_subject_enrollments for overall record
            enrollment = db.query(StudentSubjectEnrollment).filter(
                StudentSubjectEnrollment.roll_no == st.roll_no
            ).first()
            if enrollment and enrollment.total_classes > 0:
                conducted = enrollment.total_classes
                attended_classes = enrollment.attended_classes

        current_pct = (attended_classes / conducted * 100.0) if conducted > 0 else 100.0
        current_pct = round(current_pct, 1)

        tier, tier_desc = get_risk_tier(current_pct, threshold_pct)
        classes_needed = calculate_classes_needed(attended_classes, conducted, threshold_pct)
        safe_cuts = calculate_safe_cuts(attended_classes, conducted, threshold_pct)

        # Consecutive absences detection
        recent_statuses = [r.status for r in sorted(st_recs, key=lambda x: x.marked_at, reverse=True)[:5]]
        consecutive_absences = 0
        for s in recent_statuses:
            if s == "ABSENT":
                consecutive_absences += 1
            else:
                break

        # Recent trend (last 4 records vs prior records)
        recent_trend = "STABLE"
        if len(st_recs) >= 4:
            recent_4 = st_recs[-4:]
            prior = st_recs[:-4]
            recent_pct = (sum(1 for r in recent_4 if r.status in ("PRESENT", "MANUAL_PRESENT")) / 4.0) * 100.0
            if prior:
                prior_pct = (sum(1 for r in prior if r.status in ("PRESENT", "MANUAL_PRESENT")) / float(len(prior))) * 100.0
                if recent_pct - prior_pct >= 8.0:
                    recent_trend = "IMPROVING"
                elif prior_pct - recent_pct >= 8.0:
                    recent_trend = "DECLINING"

        if current_pct < threshold_pct:
            below_threshold_count += 1

        if tier in ("CRITICAL", "WARNING", "BORDERLINE"):
            at_risk_count += 1

        if tier == "CRITICAL":
            critical_count += 1
        elif tier == "WARNING":
            warning_count += 1
        elif tier == "BORDERLINE":
            borderline_count += 1
        else:
            safe_count += 1

        # Intervention flags
        intervention_needed = tier in ("CRITICAL", "WARNING") or consecutive_absences >= 2
        recommendation_text = "Maintain current attendance regular standing."
        if tier == "CRITICAL":
            recommendation_text = f"Urgent student counselling required. Must attend {classes_needed} consecutive classes to reach minimum {threshold_pct:.0f}% requirement."
        elif tier == "WARNING":
            recommendation_text = f"Send attendance warning notification. Needs {classes_needed} consecutive classes to reach {threshold_pct:.0f}% threshold."
        elif consecutive_absences >= 3:
            recommendation_text = f"Student missed {consecutive_absences} consecutive lectures. Contact student to assess academic or personal hardship."
        elif recent_trend == "DECLINING":
            recommendation_text = f"Downward attendance drift detected over recent sessions. Monitor upcoming lectures closely."
        elif recent_trend == "IMPROVING" and current_pct < threshold_pct:
            recommendation_text = f"Positive recovery in recent weeks (+{recent_trend}). Encourage continued consistency."

        students_analysis.append({
            "roll_no": st.roll_no,
            "name": st.name,
            "department": st.department,
            "semester": st.semester,
            "section": st.section or "A",
            "current_pct": current_pct,
            "threshold_pct": threshold_pct,
            "attended_classes": attended_classes,
            "conducted_classes": conducted,
            "classes_needed": classes_needed,
            "safe_cuts_available": safe_cuts,
            "risk_tier": tier,
            "risk_description": tier_desc,
            "consecutive_absences": consecutive_absences,
            "recent_trend": recent_trend,
            "intervention_needed": intervention_needed,
            "recommendation": recommendation_text,
            "last_active": st_recs[-1].marked_at.isoformat() if st_recs else None,
            # Backward-compatible aliases
            "attendance_percentage": current_pct,
            "classes_attended": attended_classes,
            "classes_conducted": conducted,
            "classes_needed_for_target": classes_needed,
            "safe_cuts_remaining": safe_cuts
        })

    # Sort students: CRITICAL first, then WARNING, BORDERLINE, SAFE
    tier_order = {"CRITICAL": 0, "WARNING": 1, "BORDERLINE": 2, "SAFE": 3}
    students_analysis.sort(key=lambda x: (tier_order.get(x["risk_tier"], 9), x["current_pct"]))

    return {
        "threshold_pct": threshold_pct,
        "total_students": len(students),
        "at_risk_count": at_risk_count,
        "below_threshold_count": below_threshold_count,
        "critical_count": critical_count,
        "warning_count": warning_count,
        "borderline_count": borderline_count,
        "safe_count": safe_count,
        "total_sessions_analyzed": len(sessions),
        "total_attendance_records": len(records),
        "students": students_analysis
    }


# ------------------------------------------------------------------------------
# 3. SUBJECT-WISE ATTENDANCE TREND ANALYSIS
# ------------------------------------------------------------------------------

def analyze_subject_attendance_trends(
    db: Session,
    faculty_id: Optional[str] = None,
    section: Optional[str] = None,
    semester: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> Dict[str, Any]:
    """
    Analyzes attendance separately for each subject:
    - Weekly average attendance across chronological weeks
    - Percentage-point change between recent week and prior weeks
    - Meaningful decline detection (>= 3.0 percentage points with >= 2 sessions)
    - Distinguishes random noise from systemic drops
    """
    # 1. Fetch sessions
    sessions_query = get_faculty_sessions_query(
        db, faculty_id=faculty_id, start_date=start_date, end_date=end_date
    )
    sessions = sessions_query.all()

    if not sessions:
        return {
            "subjects_analyzed": 0,
            "declining_subjects_count": 0,
            "subjects": [],
            "weekly_timeline": []
        }

    # Group sessions by normalized subject name
    subject_sessions: Dict[str, List[LectureSession]] = {}
    for s in sessions:
        subj = s.subject_name.strip()
        subject_sessions.setdefault(subj, []).append(s)

    all_session_ids = [s.session_id for s in sessions]
    records = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id.in_(all_session_ids)
    ).all()

    # Session ID -> list of attendance records
    session_records_map: Dict[str, List[AttendanceRecord]] = {}
    for r in records:
        session_records_map.setdefault(r.session_id, []).append(r)

    # Calculate weekly attendance for each subject
    subject_summaries = []
    declining_count = 0
    all_weekly_points: Dict[str, Dict[str, float]] = {}  # week_key -> {subject: pct}

    for subj_name, s_list in subject_sessions.items():
        # Sort sessions chronologically
        sorted_s = sorted(s_list, key=lambda x: x.started_at)
        total_sessions = len(sorted_s)

        # Overall subject stats
        total_present = 0
        total_records = 0

        # Group by week (ISO year, week number)
        weeks_data: Dict[str, Dict[str, Any]] = {}
        for sess in sorted_s:
            sess_recs = session_records_map.get(sess.session_id, [])
            p_count = sum(1 for r in sess_recs if r.status in ("PRESENT", "MANUAL_PRESENT"))
            tot_count = len(sess_recs)
            total_present += p_count
            total_records += tot_count

            dt = sess.started_at
            iso_year, iso_week, _ = dt.isocalendar()
            week_key = f"{iso_year}-W{iso_week:02d}"
            week_label = f"Wk {iso_week} ({dt.strftime('%b %d')})"

            if week_key not in weeks_data:
                weeks_data[week_key] = {
                    "week_key": week_key,
                    "week_label": week_label,
                    "date": dt,
                    "present": 0,
                    "total": 0,
                    "sessions_count": 0
                }
            weeks_data[week_key]["present"] += p_count
            weeks_data[week_key]["total"] += tot_count
            weeks_data[week_key]["sessions_count"] += 1

        overall_pct = (total_present / total_records * 100.0) if total_records > 0 else 0.0

        # Compute chronological weekly list
        weekly_series = []
        for wk in sorted(weeks_data.keys()):
            w_info = weeks_data[wk]
            w_pct = (w_info["present"] / w_info["total"] * 100.0) if w_info["total"] > 0 else 0.0
            weekly_series.append({
                "week_key": wk,
                "week_label": w_info["week_label"],
                "attendance_pct": round(w_pct, 1),
                "sessions_conducted": w_info["sessions_count"],
                "total_records": w_info["total"]
            })
            all_weekly_points.setdefault(w_info["week_label"], {})[subj_name] = round(w_pct, 1)

        # Detect trend with minimum change requirement
        trend_status = "STABLE"
        percentage_point_delta = 0.0
        trend_explanation = "Attendance is holding stable across recent weeks."

        if len(weekly_series) >= 2:
            recent_pct = weekly_series[-1]["attendance_pct"]
            prev_pct = weekly_series[-2]["attendance_pct"]
            percentage_point_delta = round(recent_pct - prev_pct, 1)

            # Lookback at last 3 weeks if available
            if len(weekly_series) >= 3:
                w1 = weekly_series[-3]["attendance_pct"]
                w2 = weekly_series[-2]["attendance_pct"]
                w3 = weekly_series[-1]["attendance_pct"]
                # Consistent decline
                if w3 < w2 < w1 and (w1 - w3) >= 3.0:
                    trend_status = "CONSISTENT_DECLINE"
                    declining_count += 1
                    trend_explanation = f"{subj_name} attendance has declined consistently over the last 3 weeks ({w1:.1f}% -> {w2:.1f}% -> {w3:.1f}%, drop of {w1 - w3:.1f}%)."
                elif w3 > w2 > w1 and (w3 - w1) >= 3.0:
                    trend_status = "CONSISTENT_INCREASE"
                    trend_explanation = f"{subj_name} attendance has grown consistently over the last 3 weeks (+{w3 - w1:.1f}% gain)."
                elif percentage_point_delta <= -4.0:
                    trend_status = "RECENT_DROP"
                    declining_count += 1
                    trend_explanation = f"Noticeable drop of {abs(percentage_point_delta):.1f}% in the most recent week."
                elif percentage_point_delta >= 4.0:
                    trend_status = "RECENT_BOOST"
                    trend_explanation = f"Recent weekly increase of +{percentage_point_delta:.1f}%."
            else:
                if percentage_point_delta <= -3.0:
                    trend_status = "RECENT_DROP"
                    declining_count += 1
                    trend_explanation = f"Recent drop of {abs(percentage_point_delta):.1f}% compared to prior week."
                elif percentage_point_delta >= 3.0:
                    trend_status = "RECENT_BOOST"
                    trend_explanation = f"Recent improvement of +{percentage_point_delta:.1f}% compared to prior week."

        subject_summaries.append({
            "subject_name": subj_name,
            "overall_pct": round(overall_pct, 1),
            "sessions_count": total_sessions,
            "total_records": total_records,
            "trend_status": trend_status,
            "delta_pct": percentage_point_delta,
            "trend_explanation": trend_explanation,
            "weekly_series": weekly_series
        })

    # Sort subjects: declining first, then by lowest overall percentage
    subject_summaries.sort(key=lambda s: (0 if "DECLINE" in s["trend_status"] or "DROP" in s["trend_status"] else 1, s["overall_pct"]))

    # Build aligned weekly timeline for charts
    timeline_labels = sorted(all_weekly_points.keys())
    chart_timeline = []
    for label in timeline_labels:
        item = {"label": label}
        item.update(all_weekly_points[label])
        chart_timeline.append(item)

    return {
        "subjects_analyzed": len(subject_summaries),
        "declining_subjects_count": declining_count,
        "subjects": subject_summaries,
        "weekly_chart_data": chart_timeline
    }


# ------------------------------------------------------------------------------
# 4. DAY-WISE ATTENDANCE PATTERN ANALYSIS
# ------------------------------------------------------------------------------

def analyze_day_wise_attendance_patterns(
    db: Session,
    faculty_id: Optional[str] = None,
    subject_filter: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> Dict[str, Any]:
    """
    Analyzes attendance according to weekdays (Monday through Saturday):
    - Calculates average attendance for each weekday
    - Identifies the weekday with the lowest average attendance
    - Flags recurring patterns with sufficient sample size (>= 2 sessions)
    """
    weekday_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    sessions_query = get_faculty_sessions_query(
        db, faculty_id=faculty_id, subject_name=subject_filter, start_date=start_date, end_date=end_date
    )
    sessions = sessions_query.all()

    if not sessions:
        return {
            "has_sufficient_data": False,
            "total_sessions": 0,
            "lowest_day": None,
            "highest_day": None,
            "insight_text": "Insufficient attendance data to evaluate day-wise patterns.",
            "days": []
        }

    session_ids = [s.session_id for s in sessions]
    records = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id.in_(session_ids)
    ).all()

    session_records_map: Dict[str, List[AttendanceRecord]] = {}
    for r in records:
        session_records_map.setdefault(r.session_id, []).append(r)

    # Accumulate by weekday index (0 = Monday, ..., 5 = Saturday)
    day_stats: Dict[int, Dict[str, Any]] = {
        i: {
            "day_index": i,
            "day_name": weekday_names[i],
            "sessions_count": 0,
            "present_count": 0,
            "total_records": 0,
            "session_percentages": []
        }
        for i in range(6)  # Mon to Sat
    }

    for sess in sessions:
        w_idx = sess.started_at.weekday()
        if w_idx not in day_stats:
            continue
        sess_recs = session_records_map.get(sess.session_id, [])
        p_count = sum(1 for r in sess_recs if r.status in ("PRESENT", "MANUAL_PRESENT"))
        tot_count = len(sess_recs)

        day_stats[w_idx]["sessions_count"] += 1
        day_stats[w_idx]["present_count"] += p_count
        day_stats[w_idx]["total_records"] += tot_count

        if tot_count > 0:
            day_stats[w_idx]["session_percentages"].append((p_count / tot_count) * 100.0)

    # Filter only days that had scheduled sessions
    days_list = []
    overall_total_present = 0
    overall_total_records = 0

    for i in range(6):
        d = day_stats[i]
        if d["sessions_count"] > 0:
            avg_pct = (d["present_count"] / d["total_records"] * 100.0) if d["total_records"] > 0 else 0.0
            overall_total_present += d["present_count"]
            overall_total_records += d["total_records"]
            days_list.append({
                "day_index": i,
                "day_name": d["day_name"],
                "sessions_conducted": d["sessions_count"],
                "total_records": d["total_records"],
                "average_attendance_pct": round(avg_pct, 1),
                "is_recurring_pattern": d["sessions_count"] >= 2
            })

    if not days_list:
        return {
            "has_sufficient_data": False,
            "total_sessions": len(sessions),
            "lowest_day": None,
            "highest_day": None,
            "insight_text": "No attendance records found on weekdays.",
            "days": []
        }

    overall_avg_pct = (overall_total_present / overall_total_records * 100.0) if overall_total_records > 0 else 0.0

    # Sort days by average attendance
    days_by_att = sorted(days_list, key=lambda x: x["average_attendance_pct"])
    lowest_day = days_by_att[0]
    highest_day = days_by_att[-1]

    # Generate explainable insight
    gap_from_avg = round(overall_avg_pct - lowest_day["average_attendance_pct"], 1)

    if lowest_day["is_recurring_pattern"] and gap_from_avg >= 4.0:
        insight_text = (
            f"{lowest_day['day_name']} lectures have an average attendance of {lowest_day['average_attendance_pct']:.1f}%, "
            f"which is {gap_from_avg:.1f}% lower than the overall weekday average ({overall_avg_pct:.1f}%). "
            f"Observed across {lowest_day['sessions_conducted']} recurring lecture sessions."
        )
    elif lowest_day["is_recurring_pattern"]:
        insight_text = (
            f"Attendance across weekdays is relatively uniform. {lowest_day['day_name']} is slightly lower at "
            f"{lowest_day['average_attendance_pct']:.1f}% compared to {highest_day['day_name']} at {highest_day['average_attendance_pct']:.1f}%."
        )
    else:
        insight_text = (
            f"{lowest_day['day_name']} recorded {lowest_day['average_attendance_pct']:.1f}% attendance, but has only "
            f"1 session recorded so far. More data needed to confirm a recurring pattern."
        )

    return {
        "has_sufficient_data": True,
        "total_sessions": len(sessions),
        "overall_weekday_average": round(overall_avg_pct, 1),
        "lowest_day": lowest_day,
        "highest_day": highest_day,
        "gap_percentage_points": gap_from_avg,
        "insight_text": insight_text,
        "days": days_list
    }


# ------------------------------------------------------------------------------
# 5. PERSONALIZED STUDENT INTERVENTION RECOMMENDATIONS
# ------------------------------------------------------------------------------

def generate_personalized_interventions(
    db: Session,
    faculty_id: Optional[str] = None,
    section: Optional[str] = None,
    semester: Optional[int] = None,
    subject_filter: Optional[str] = None,
    threshold_override: Optional[float] = None
) -> List[Dict[str, Any]]:
    """
    Extracts high-priority students requiring proactive faculty intervention:
    - Critical attendance shortages (< threshold)
    - Consecutive missed lectures (3+)
    - Downward momentum drift
    - Significant positive recovery
    """
    student_risks = analyze_student_attendance_risks(
        db,
        faculty_id=faculty_id,
        section=section,
        semester=semester,
        subject_filter=subject_filter,
        threshold_override=threshold_override
    )

    interventions = []
    for s in student_risks["students"]:
        actions = []
        priority = "LOW"

        if s["risk_tier"] == "CRITICAL":
            priority = "URGENT"
            actions.append({
                "type": "COUNSELLING",
                "label": "Schedule 1-on-1 Counselling",
                "description": f"Student requires urgent academic mentoring to recover from {s['current_pct']:.1f}% attendance."
            })
            actions.append({
                "type": "SHORTAGE_NOTICE",
                "label": "Issue Official Shortage Notice",
                "description": f"Formal notification regarding statutory UGC minimum attendance deficit."
            })

        elif s["risk_tier"] == "WARNING":
            priority = "HIGH"
            actions.append({
                "type": "SHORTAGE_NOTICE",
                "label": "Send Attendance Alert",
                "description": f"Notify student that attendance is currently at {s['current_pct']:.1f}%, below {s['threshold_pct']:.0f}% requirement."
            })
            actions.append({
                "type": "MONITOR",
                "label": "Target for Upcoming Session Attendance",
                "description": f"Flag student on the live classroom wall during next lecture."
            })

        elif s["consecutive_absences"] >= 2:
            priority = "MEDIUM"
            actions.append({
                "type": "CHECKIN",
                "label": "Inquire Regarding Absences",
                "description": f"Student missed {s['consecutive_absences']} consecutive lectures. Confirm wellness or medical leave."
            })

        elif s["recent_trend"] == "DECLINING":
            priority = "MEDIUM"
            actions.append({
                "type": "MONITOR",
                "label": "Monitor Trend Trajectory",
                "description": "Recent attendance has shown downward drift. Prevent slide into warning territory."
            })

        elif s["recent_trend"] == "IMPROVING" and s["current_pct"] < s["threshold_pct"]:
            priority = "POSITIVE"
            actions.append({
                "type": "COMMEND",
                "label": "Acknowledge Positive Improvement",
                "description": "Student has attended recent sessions consistently. Encourage ongoing recovery."
            })

        if actions:
            interventions.append({
                "roll_no": s["roll_no"],
                "student_name": s["name"],
                "department": s["department"],
                "section": s["section"],
                "current_pct": s["current_pct"],
                "threshold_pct": s["threshold_pct"],
                "classes_needed": s["classes_needed"],
                "risk_tier": s["risk_tier"],
                "priority": priority,
                "consecutive_absences": s["consecutive_absences"],
                "recent_trend": s["recent_trend"],
                "recommended_actions": actions,
                "summary": s["recommendation"]
            })

    # Sort: URGENT first, then HIGH, MEDIUM, POSITIVE
    p_order = {"URGENT": 0, "HIGH": 1, "MEDIUM": 2, "POSITIVE": 3, "LOW": 4}
    interventions.sort(key=lambda x: (p_order.get(x["priority"], 9), x["current_pct"]))
    return interventions


# ------------------------------------------------------------------------------
# 6. COMPREHENSIVE FACULTY INSIGHTS OVERVIEW
# ------------------------------------------------------------------------------

def get_comprehensive_faculty_insights(
    db: Session,
    faculty_id: Optional[str] = None,
    section: Optional[str] = None,
    semester: Optional[int] = None,
    subject: Optional[str] = None,
    threshold: Optional[float] = None,
    date_range: Optional[str] = "30d"
) -> Dict[str, Any]:
    """
    Main aggregator for the 'AI Attendance Insights' dashboard.
    Returns:
    - 6 Top-Level Insight Summary Cards
    - Shortage Risk Distribution
    - Subject-Wise Trend Analysis & Line Charts
    - Day-Wise Pattern Analysis & Bar Charts
    - Student Intervention Roster
    - Metadata and Explainability Breadcrumbs
    """
    now = datetime.now(timezone.utc)
    start_date = None
    if date_range == "7d":
        start_date = now - timedelta(days=7)
    elif date_range == "14d":
        start_date = now - timedelta(days=14)
    elif date_range == "30d":
        start_date = now - timedelta(days=30)
    elif date_range == "90d":
        start_date = now - timedelta(days=90)
    elif date_range == "all":
        start_date = None
    else:
        start_date = now - timedelta(days=30)

    # 1. Run Shortage Risk Analytics
    shortage_data = analyze_student_attendance_risks(
        db,
        faculty_id=faculty_id,
        section=section,
        semester=semester,
        subject_filter=subject,
        threshold_override=threshold,
        start_date=start_date,
        end_date=now
    )

    # 2. Run Subject Trend Analytics
    subject_trends = analyze_subject_attendance_trends(
        db,
        faculty_id=faculty_id,
        section=section,
        semester=semester,
        start_date=start_date,
        end_date=now
    )

    # 3. Run Day-Wise Pattern Analytics
    day_patterns = analyze_day_wise_attendance_patterns(
        db,
        faculty_id=faculty_id,
        subject_filter=subject,
        start_date=start_date,
        end_date=now
    )

    # 4. Generate Personalized Interventions
    interventions = generate_personalized_interventions(
        db,
        faculty_id=faculty_id,
        section=section,
        semester=semester,
        subject_filter=subject,
        threshold_override=threshold
    )

    # 5. Extract Positive Attendance Trends
    positive_trends = [
        s for s in shortage_data["students"]
        if s["recent_trend"] == "IMPROVING" or s["risk_tier"] == "SAFE" and s["current_pct"] >= 85.0
    ]

    # 6. Synthesize the 6 Insight Cards
    # Card 1: AT-RISK STUDENTS
    card_at_risk = {
        "id": "at_risk_students",
        "title": "At-Risk Students",
        "value": shortage_data["at_risk_count"],
        "subtitle": f"{shortage_data['below_threshold_count']} below {shortage_data['threshold_pct']:.0f}% minimum",
        "status": "CRITICAL" if shortage_data["below_threshold_count"] > 0 else "NORMAL",
        "description": f"{shortage_data['at_risk_count']} students are in warning or borderline zones and require attention."
    }

    # Card 2: DECLINING SUBJECTS
    declining_count = subject_trends["declining_subjects_count"]
    card_declining_subjects = {
        "id": "declining_subjects",
        "title": "Declining Subjects",
        "value": declining_count,
        "subtitle": f"{declining_count} of {subject_trends['subjects_analyzed']} subjects dropping",
        "status": "WARNING" if declining_count > 0 else "NORMAL",
        "description": "Subjects showing consistent week-over-week attendance drops of >= 3%."
    }

    # Card 3: LOW ATTENDANCE DAYS
    lowest_day_info = day_patterns["lowest_day"]
    card_low_days = {
        "id": "low_attendance_days",
        "title": "Lowest Attendance Day",
        "value": lowest_day_info["day_name"] if lowest_day_info else "N/A",
        "subtitle": f"{lowest_day_info['average_attendance_pct']:.1f}% average" if lowest_day_info else "No session data",
        "status": "WARNING" if (day_patterns.get("gap_percentage_points") or 0) >= 4.0 else "NORMAL",
        "description": day_patterns["insight_text"]
    }

    # Card 4: STUDENTS NEEDING ATTENTION
    urgent_count = sum(1 for item in interventions if item["priority"] in ("URGENT", "HIGH"))
    card_attention = {
        "id": "students_needing_attention",
        "title": "Students Needing Action",
        "value": urgent_count,
        "subtitle": f"{len(interventions)} total flagged for review",
        "status": "CRITICAL" if urgent_count > 0 else "NORMAL",
        "description": "Students with chronic shortages, multi-session skips, or momentum drift."
    }

    # Card 5: POSITIVE TRENDS
    card_positive = {
        "id": "positive_trends",
        "title": "Positive Momentum",
        "value": len(positive_trends),
        "subtitle": f"Improving or high-attendance students",
        "status": "SUCCESS",
        "description": "Students showing active recovery or high consistent attendance (>= 85%)."
    }

    # Card 6: RECOMMENDED ACTIONS
    card_actions = {
        "id": "recommended_actions",
        "title": "Actionable Suggestions",
        "value": sum(len(item["recommended_actions"]) for item in interventions[:6]),
        "subtitle": "Interventions ready to dispatch",
        "status": "INFO",
        "description": "1-click notices, academic counselling sessions, and reminder alerts."
    }

    # Risk Distribution for Donut / Bar Charts
    risk_distribution = [
        {"name": "Critical (<65%)", "count": shortage_data["critical_count"], "color": "#EF4444"},
        {"name": "Warning (65-75%)", "count": shortage_data["warning_count"], "color": "#F59E0B"},
        {"name": "Borderline (75-80%)", "count": shortage_data["borderline_count"], "color": "#3B82F6"},
        {"name": "Safe Standing (>80%)", "count": shortage_data["safe_count"], "color": "#10B981"},
    ]

    return {
        "success": True,
        "metadata": {
            "analysis_timestamp": now.isoformat(),
            "date_range": date_range,
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": now.isoformat(),
            "section_filter": section or "ALL",
            "subject_filter": subject or "ALL",
            "semester_filter": semester or "ALL",
            "threshold_pct": shortage_data["threshold_pct"],
            "total_sessions_analyzed": shortage_data["total_sessions_analyzed"],
            "total_records_analyzed": shortage_data["total_attendance_records"]
        },
        "cards": [
            card_at_risk,
            card_declining_subjects,
            card_low_days,
            card_attention,
            card_positive,
            card_actions
        ],
        "insight_cards": [
            card_at_risk,
            card_declining_subjects,
            card_low_days,
            card_attention,
            card_positive,
            card_actions
        ],
        "shortage_summary": {
            "threshold_pct": shortage_data["threshold_pct"],
            "total_students": shortage_data["total_students"],
            "at_risk_count": shortage_data["at_risk_count"],
            "below_threshold_count": shortage_data["below_threshold_count"],
            "risk_distribution": risk_distribution
        },
        "subject_trends": subject_trends,
        "day_patterns": day_patterns,
        "interventions": interventions,
        "recommended_actions": interventions,
        "students": shortage_data["students"]
    }
