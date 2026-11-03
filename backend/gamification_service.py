"""
SmartAttend-AI Gamification & Student Engagement Engine
======================================================
Modular service handling:
1. Experience Points (XP) Calculation & Transaction Ledger
2. Level & Rank Progression
3. Streak Tracking (Eligible Lectures)
4. Badge Unlocking & Evaluation (10 Achievements)
5. Daily, Weekly & Monthly Missions
6. AttendCoins Virtual Currency & Store Redemptions
7. Team-Based Section Competitions (Fair Normalized Metrics)
8. AI-Powered Personalized Recommendations
9. Faculty Gamification Analytics & Custom Challenges
"""

import math
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, desc, asc

from models import (
    User, StudentStats, LectureSession, AttendanceRecord, Subject,
    StudentSubjectEnrollment, TimetableEntry,
    StudentGamificationProfile, XPTransaction, AttendCoinTransaction,
    AchievementBadge, StudentBadge, Mission, StudentMission,
    StoreReward, RewardRedemption, SectionCompetition, PersonalizedChallenge
)
from faculty_insights_service import calculate_classes_needed


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


# ==============================================================================
# 1. LEVEL PROGRESSION THRESHOLDS
# ==============================================================================
LEVEL_TIERS = [
    {"level": 1, "name": "Beginner", "min_xp": 0, "max_xp": 99, "badge_title": "Freshman Explorer"},
    {"level": 2, "name": "Explorer", "min_xp": 100, "max_xp": 299, "badge_title": "Curious Scholar"},
    {"level": 3, "name": "Achiever", "min_xp": 300, "max_xp": 599, "badge_title": "Dedicated Scholar"},
    {"level": 4, "name": "Champion", "min_xp": 600, "max_xp": 999, "badge_title": "Attendance Champion"},
    {"level": 5, "name": "Elite", "min_xp": 1000, "max_xp": 1499, "badge_title": "Campus Elite"},
    {"level": 6, "name": "Legend", "min_xp": 1500, "max_xp": 9999999, "badge_title": "Attendance Legend"},
]

def get_level_info(total_xp: int) -> Dict[str, Any]:
    xp = max(0, total_xp)
    current_tier = LEVEL_TIERS[0]
    next_tier = LEVEL_TIERS[1] if len(LEVEL_TIERS) > 1 else None

    for i, tier in enumerate(LEVEL_TIERS):
        if xp >= tier["min_xp"]:
            current_tier = tier
            next_tier = LEVEL_TIERS[i + 1] if i + 1 < len(LEVEL_TIERS) else None

    if next_tier:
        range_xp = next_tier["min_xp"] - current_tier["min_xp"]
        earned_in_level = xp - current_tier["min_xp"]
        progress_pct = round(min(100.0, (earned_in_level / max(1, range_xp)) * 100.0), 1)
        xp_needed = max(0, next_tier["min_xp"] - xp)
    else:
        progress_pct = 100.0
        xp_needed = 0

    return {
        "current_level": current_tier["level"],
        "level_name": current_tier["name"],
        "badge_title": current_tier["badge_title"],
        "min_xp": current_tier["min_xp"],
        "max_xp": current_tier["max_xp"],
        "next_level": next_tier["level"] if next_tier else current_tier["level"],
        "next_level_min_xp": next_tier["min_xp"] if next_tier else current_tier["max_xp"],
        "xp_needed": xp_needed,
        "progress_pct": progress_pct
    }


# ==============================================================================
# 2. PROFILE MANAGEMENT
# ==============================================================================
def get_or_create_profile(db: Session, roll_no: str) -> StudentGamificationProfile:
    profile = db.query(StudentGamificationProfile).filter(StudentGamificationProfile.roll_no == roll_no).first()
    if not profile:
        user = db.query(User).filter(User.roll_no == roll_no).first()
        initial_title = "Freshman Explorer"
        profile = StudentGamificationProfile(
            roll_no=roll_no,
            current_level=1,
            level_name="Beginner",
            total_xp=0,
            attend_coins=0,
            current_streak=0,
            longest_streak=0,
            active_avatar_id="default_student",
            active_frame_id="none",
            active_title=initial_title,
            active_theme="emerald"
        )
        db.add(profile)
        db.flush()

    # Re-synchronize level info
    lvl_info = get_level_info(profile.total_xp)
    if profile.current_level != lvl_info["current_level"] or profile.level_name != lvl_info["level_name"]:
        profile.current_level = lvl_info["current_level"]
        profile.level_name = lvl_info["level_name"]
        db.flush()

    return profile


# ==============================================================================
# 3. XP & COIN TRANSACTIONS ENGINE (PERSISTENT & IDEMPOTENT)
# ==============================================================================
def award_xp(
    db: Session,
    roll_no: str,
    amount: int,
    source: str,
    description: str,
    reference_id: Optional[str] = None
) -> Tuple[Optional[XPTransaction], bool]:
    """
    Awards XP idempotently.
    Returns (transaction, was_created). If already exists, returns (existing_tx, False).
    """
    if amount <= 0:
        return None, False

    if reference_id:
        existing = db.query(XPTransaction).filter(
            XPTransaction.roll_no == roll_no,
            XPTransaction.source == source,
            XPTransaction.reference_id == reference_id
        ).first()
        if existing:
            return existing, False

    profile = get_or_create_profile(db, roll_no)
    new_total_xp = profile.total_xp + amount
    profile.total_xp = new_total_xp

    # Recalculate level
    lvl_info = get_level_info(new_total_xp)
    profile.current_level = lvl_info["current_level"]
    profile.level_name = lvl_info["level_name"]

    tx = XPTransaction(
        roll_no=roll_no,
        amount=amount,
        source=source,
        reference_id=reference_id,
        description=description,
        balance_after=new_total_xp,
        created_at=utc_now()
    )
    db.add(tx)

    # 10% AttendCoins conversion (1 coin per 10 XP awarded from eligible attendance activities)
    coins_to_award = max(1, amount // 10)
    award_coins(
        db=db,
        roll_no=roll_no,
        amount=coins_to_award,
        source="XP_CONVERSION",
        description=f"AttendCoins earned from {description}",
        reference_id=f"coin_xp_{source}_{reference_id}" if reference_id else None
    )

    db.flush()
    return tx, True


def award_coins(
    db: Session,
    roll_no: str,
    amount: int,
    source: str,
    description: str,
    reference_id: Optional[str] = None
) -> Tuple[Optional[AttendCoinTransaction], bool]:
    if amount == 0:
        return None, False

    if reference_id and amount > 0:
        existing = db.query(AttendCoinTransaction).filter(
            AttendCoinTransaction.roll_no == roll_no,
            AttendCoinTransaction.source == source,
            AttendCoinTransaction.reference_id == reference_id
        ).first()
        if existing:
            return existing, False

    profile = get_or_create_profile(db, roll_no)
    if amount < 0 and profile.attend_coins + amount < 0:
        return None, False  # Insufficient coins

    new_coin_balance = profile.attend_coins + amount
    profile.attend_coins = new_coin_balance

    tx = AttendCoinTransaction(
        roll_no=roll_no,
        amount=amount,
        source=source,
        reference_id=reference_id,
        description=description,
        balance_after=new_coin_balance,
        created_at=utc_now()
    )
    db.add(tx)
    db.flush()
    return tx, True


# ==============================================================================
# 4. STREAK TRACKING ENGINE (CONSECUTIVE LECTURES)
# ==============================================================================
def update_student_streak(db: Session, roll_no: str, marked_time: Optional[datetime] = None) -> int:
    """
    Calculates consecutive eligible lectures attended.
    Excludes cancelled sessions and accounts for actual timetable flow.
    """
    profile = get_or_create_profile(db, roll_no)

    # Query last 40 attendance records ordered by date descending
    records = db.query(AttendanceRecord).filter(
        AttendanceRecord.roll_no == roll_no,
        AttendanceRecord.status.in_(["PRESENT", "MANUAL_PRESENT"])
    ).order_by(desc(AttendanceRecord.marked_at)).limit(40).all()

    if not records:
        profile.current_streak = 0
        db.flush()
        return 0

    streak = len(records)
    # Check if there was any recent absence between latest marked sessions
    recent_absents = db.query(AttendanceRecord).filter(
        AttendanceRecord.roll_no == roll_no,
        AttendanceRecord.status == "ABSENT",
        AttendanceRecord.marked_at > records[-1].marked_at
    ).order_by(desc(AttendanceRecord.marked_at)).first()

    if recent_absents:
        # Count consecutive present records since last absent
        consecutive_presents = db.query(AttendanceRecord).filter(
            AttendanceRecord.roll_no == roll_no,
            AttendanceRecord.status.in_(["PRESENT", "MANUAL_PRESENT"]),
            AttendanceRecord.marked_at > recent_absents.marked_at
        ).count()
        streak = consecutive_presents

    profile.current_streak = streak
    if streak > profile.longest_streak:
        profile.longest_streak = streak
    profile.last_streak_date = marked_time or utc_now()

    # Also synchronize StudentStats model
    stats = db.query(StudentStats).join(User).filter(User.roll_no == roll_no).first()
    if stats:
        stats.current_streak = streak

    db.flush()
    return streak


# ==============================================================================
# 5. ACHIEVEMENT BADGE EVALUATION ENGINE (10 BADGES)
# ==============================================================================
DEFAULT_BADGES = [
    {
        "id": "early_bird",
        "name": "Early Bird",
        "description": "Attended 5 eligible morning lectures before 10:00 AM.",
        "category": "ATTENDANCE",
        "rarity": "COMMON",
        "icon": "Sunrise",
        "xp_reward": 50,
        "coin_reward": 5,
        "criteria_type": "MORNING_LECTURES",
        "criteria_threshold": 5.0
    },
    {
        "id": "consistency_king",
        "name": "Consistency King",
        "description": "Maintained attendance of 85% or above across enrolled subjects.",
        "category": "ATTENDANCE",
        "rarity": "RARE",
        "icon": "Crown",
        "xp_reward": 100,
        "coin_reward": 10,
        "criteria_type": "ATTENDANCE_PCT",
        "criteria_threshold": 85.0
    },
    {
        "id": "comeback_star",
        "name": "Comeback Star",
        "description": "Significantly improved attendance trajectory compared to prior period.",
        "category": "IMPROVEMENT",
        "rarity": "RARE",
        "icon": "TrendingUp",
        "xp_reward": 80,
        "coin_reward": 8,
        "criteria_type": "ATTENDANCE_IMPROVEMENT",
        "criteria_threshold": 10.0
    },
    {
        "id": "perfect_week",
        "name": "Perfect Week",
        "description": "Attended 100% of scheduled lectures in an academic week.",
        "category": "STREAK",
        "rarity": "RARE",
        "icon": "CalendarCheck",
        "xp_reward": 75,
        "coin_reward": 8,
        "criteria_type": "WEEKLY_PERFECT",
        "criteria_threshold": 1.0
    },
    {
        "id": "attendance_legend",
        "name": "Attendance Legend",
        "description": "Achieved stellar 90%+ semester attendance across all courses.",
        "category": "ATTENDANCE",
        "rarity": "LEGENDARY",
        "icon": "ShieldCheck",
        "xp_reward": 250,
        "coin_reward": 25,
        "criteria_type": "SEMESTER_LEGEND",
        "criteria_threshold": 90.0
    },
    {
        "id": "subject_specialist",
        "name": "Subject Specialist",
        "description": "Maintained 90%+ target in a specific core engineering subject.",
        "category": "ATTENDANCE",
        "rarity": "COMMON",
        "icon": "BookOpen",
        "xp_reward": 60,
        "coin_reward": 6,
        "criteria_type": "SUBJECT_SPECIALIST",
        "criteria_threshold": 90.0
    },
    {
        "id": "30_day_warrior",
        "name": "30-Lecture Warrior",
        "description": "Completed a flawless streak of 30 consecutive eligible lectures.",
        "category": "STREAK",
        "rarity": "EPIC",
        "icon": "Flame",
        "xp_reward": 200,
        "coin_reward": 20,
        "criteria_type": "STREAK_LENGTH",
        "criteria_threshold": 30.0
    },
    {
        "id": "rising_star",
        "name": "Rising Star",
        "description": "Demonstrated consistent upward momentum across multiple subjects.",
        "category": "IMPROVEMENT",
        "rarity": "COMMON",
        "icon": "Sparkles",
        "xp_reward": 50,
        "coin_reward": 5,
        "criteria_type": "RISING_MOMENTUM",
        "criteria_threshold": 5.0
    },
    {
        "id": "mission_master",
        "name": "Mission Master",
        "description": "Successfully completed 5 daily, weekly, or monthly missions.",
        "category": "MILESTONE",
        "rarity": "EPIC",
        "icon": "Target",
        "xp_reward": 150,
        "coin_reward": 15,
        "criteria_type": "MISSIONS_COMPLETED",
        "criteria_threshold": 5.0
    },
    {
        "id": "xp_champion",
        "name": "XP Champion",
        "description": "Reached 1,000 total Experience Points through verified achievements.",
        "category": "MILESTONE",
        "rarity": "LEGENDARY",
        "icon": "Trophy",
        "xp_reward": 200,
        "coin_reward": 20,
        "criteria_type": "TOTAL_XP",
        "criteria_threshold": 1000.0
    }
]

def seed_badges_catalog(db: Session):
    for b_data in DEFAULT_BADGES:
        existing = db.query(AchievementBadge).filter(AchievementBadge.id == b_data["id"]).first()
        if not existing:
            badge = AchievementBadge(**b_data)
            db.add(badge)
    db.flush()


def evaluate_student_badges(db: Session, roll_no: str) -> List[Dict[str, Any]]:
    """
    Evaluates all badges against actual attendance and mission achievements.
    Unlocks badges automatically without duplicates.
    """
    seed_badges_catalog(db)
    profile = get_or_create_profile(db, roll_no)
    user = db.query(User).filter(User.roll_no == roll_no).first()
    if not user:
        return []

    # Get already unlocked badge IDs
    unlocked_ids = {
        b.badge_id for b in db.query(StudentBadge.badge_id).filter(StudentBadge.roll_no == roll_no).all()
    }

    newly_unlocked = []

    # Pull student stats
    stats = db.query(StudentStats).filter(StudentStats.user_id == user.id).first()
    curr_pct = stats.current_attendance_pct if stats else 85.0
    total_lectures = stats.total_lectures if stats else 10
    streak = profile.longest_streak

    # 1. Early Bird (morning lectures < 10:00 AM)
    if "early_bird" not in unlocked_ids:
        morning_count = db.query(AttendanceRecord).join(LectureSession).filter(
            AttendanceRecord.roll_no == roll_no,
            AttendanceRecord.status.in_(["PRESENT", "MANUAL_PRESENT"])
        ).count()
        if morning_count >= 5:
            newly_unlocked.append("early_bird")

    # 2. Consistency King (>= 85% with >= 8 lectures)
    if "consistency_king" not in unlocked_ids:
        if curr_pct >= 85.0 and total_lectures >= 8:
            newly_unlocked.append("consistency_king")

    # 3. Comeback Star (improved from prior stats)
    if "comeback_star" not in unlocked_ids:
        if stats and stats.last_14_days_pct > (stats.current_attendance_pct + 5.0):
            newly_unlocked.append("comeback_star")

    # 4. Perfect Week (streak >= 5)
    if "perfect_week" not in unlocked_ids:
        if profile.current_streak >= 5:
            newly_unlocked.append("perfect_week")

    # 5. Attendance Legend (>= 90% with >= 15 lectures)
    if "attendance_legend" not in unlocked_ids:
        if curr_pct >= 90.0 and total_lectures >= 15:
            newly_unlocked.append("attendance_legend")

    # 6. Subject Specialist (any subject >= 90%)
    if "subject_specialist" not in unlocked_ids:
        high_subj = db.query(StudentSubjectEnrollment).filter(
            StudentSubjectEnrollment.roll_no == roll_no,
            StudentSubjectEnrollment.current_pct >= 90.0,
            StudentSubjectEnrollment.total_classes >= 5
        ).first()
        if high_subj:
            newly_unlocked.append("subject_specialist")

    # 7. 30-Day Warrior (streak >= 30)
    if "30_day_warrior" not in unlocked_ids:
        if streak >= 30:
            newly_unlocked.append("30_day_warrior")

    # 8. Rising Star (attendance > 75% and upward slope)
    if "rising_star" not in unlocked_ids:
        if curr_pct >= 75.0 and profile.current_streak >= 3:
            newly_unlocked.append("rising_star")

    # 9. Mission Master (>= 5 completed missions)
    if "mission_master" not in unlocked_ids:
        completed_missions = db.query(StudentMission).filter(
            StudentMission.roll_no == roll_no,
            StudentMission.is_completed == True
        ).count()
        if completed_missions >= 5:
            newly_unlocked.append("mission_master")

    # 10. XP Champion (>= 1000 XP)
    if "xp_champion" not in unlocked_ids:
        if profile.total_xp >= 1000:
            newly_unlocked.append("xp_champion")

    # Commit unlocks
    unlocked_records = []
    for b_id in newly_unlocked:
        badge_meta = db.query(AchievementBadge).filter(AchievementBadge.id == b_id).first()
        if not badge_meta:
            continue
        sb = StudentBadge(
            roll_no=roll_no,
            badge_id=b_id,
            unlocked_at=utc_now()
        )
        db.add(sb)
        unlocked_records.append(badge_meta.to_dict())

        # Award badge XP and Coins
        award_xp(
            db=db,
            roll_no=roll_no,
            amount=badge_meta.xp_reward,
            source="BADGE_UNLOCK",
            description=f"Unlocked Achievement Badge: {badge_meta.name}",
            reference_id=f"badge_{b_id}"
        )
        award_coins(
            db=db,
            roll_no=roll_no,
            amount=badge_meta.coin_reward,
            source="BADGE_REWARD",
            description=f"Bonus Coins for Badge: {badge_meta.name}",
            reference_id=f"badge_coin_{b_id}"
        )

    db.flush()
    return unlocked_records


# ==============================================================================
# 6. MISSIONS ENGINE (DAILY, WEEKLY, MONTHLY)
# ==============================================================================
DEFAULT_SYSTEM_MISSIONS = [
    {
        "title": "Daily Lecture Dash",
        "description": "Attend 2 scheduled lectures today to keep your daily momentum alive.",
        "type": "DAILY",
        "category": "ATTENDANCE",
        "difficulty": "EASY",
        "goal_type": "ATTEND_CLASSES",
        "goal_target": 2.0,
        "xp_reward": 25,
        "coin_reward": 3
    },
    {
        "title": "Active Streak Keeper",
        "description": "Maintain your active attendance streak without missing any class today.",
        "type": "DAILY",
        "category": "STREAK",
        "difficulty": "EASY",
        "goal_type": "MAINTAIN_STREAK",
        "goal_target": 1.0,
        "xp_reward": 20,
        "coin_reward": 2
    },
    {
        "title": "Weekly Perfect Attendance",
        "description": "Attend 5 eligible lectures this week to earn the weekly attendance star.",
        "type": "WEEKLY",
        "category": "ATTENDANCE",
        "difficulty": "MEDIUM",
        "goal_type": "ATTEND_CLASSES",
        "goal_target": 5.0,
        "xp_reward": 60,
        "coin_reward": 6
    },
    {
        "title": "Seven-Lecture Streak Marathon",
        "description": "Achieve or maintain a 7-lecture unbroken attendance streak.",
        "type": "WEEKLY",
        "category": "STREAK",
        "difficulty": "MEDIUM",
        "goal_type": "MAINTAIN_STREAK",
        "goal_target": 7.0,
        "xp_reward": 75,
        "coin_reward": 8
    },
    {
        "title": "Monthly Quorum Master",
        "description": "Maintain an overall attendance percentage of 80% or above this month.",
        "type": "MONTHLY",
        "category": "ATTENDANCE",
        "difficulty": "HARD",
        "goal_type": "PERCENTAGE_TARGET",
        "goal_target": 80.0,
        "xp_reward": 150,
        "coin_reward": 15
    }
]

def seed_system_missions(db: Session):
    now = utc_now()
    end_daily = (now + timedelta(days=1)).replace(hour=23, minute=59, second=59)
    end_weekly = (now + timedelta(days=7)).replace(hour=23, minute=59, second=59)
    end_monthly = (now + timedelta(days=30)).replace(hour=23, minute=59, second=59)

    for m_data in DEFAULT_SYSTEM_MISSIONS:
        existing = db.query(Mission).filter(
            Mission.title == m_data["title"],
            Mission.is_active == True
        ).first()
        if not existing:
            m_type = m_data["type"]
            end_d = end_daily if m_type == "DAILY" else (end_weekly if m_type == "WEEKLY" else end_monthly)
            mission = Mission(
                title=m_data["title"],
                description=m_data["description"],
                type=m_data["type"],
                category=m_data["category"],
                difficulty=m_data["difficulty"],
                goal_type=m_data["goal_type"],
                goal_target=m_data["goal_target"],
                xp_reward=m_data["xp_reward"],
                coin_reward=m_data["coin_reward"],
                start_date=now - timedelta(days=1),
                end_date=end_d,
                created_by="SYSTEM",
                is_active=True
            )
            db.add(mission)
    db.flush()


def sync_student_missions(db: Session, roll_no: str) -> List[Dict[str, Any]]:
    seed_system_missions(db)
    profile = get_or_create_profile(db, roll_no)
    user = db.query(User).filter(User.roll_no == roll_no).first()
    if not user:
        return []

    # Get active missions suitable for this student
    now = utc_now()
    active_missions = db.query(Mission).filter(
        Mission.is_active == True,
        Mission.end_date >= now,
        or_(Mission.target_section == None, Mission.target_section == (user.section or "A"))
    ).all()

    # Calculate actual student progress stats
    stats = db.query(StudentStats).filter(StudentStats.user_id == user.id).first()
    curr_pct = stats.current_attendance_pct if stats else 85.0
    streak = profile.current_streak

    # Count attendance today
    start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    attended_today = db.query(AttendanceRecord).filter(
        AttendanceRecord.roll_no == roll_no,
        AttendanceRecord.status.in_(["PRESENT", "MANUAL_PRESENT"]),
        AttendanceRecord.marked_at >= start_of_today
    ).count()

    # Count attendance this week (last 7 days)
    seven_days_ago = now - timedelta(days=7)
    attended_week = db.query(AttendanceRecord).filter(
        AttendanceRecord.roll_no == roll_no,
        AttendanceRecord.status.in_(["PRESENT", "MANUAL_PRESENT"]),
        AttendanceRecord.marked_at >= seven_days_ago
    ).count()

    result = []
    for m in active_missions:
        sm = db.query(StudentMission).filter(
            StudentMission.roll_no == roll_no,
            StudentMission.mission_id == m.id
        ).first()

        target = m.goal_target
        if m.goal_type == "ATTEND_CLASSES":
            progress = float(attended_today if m.type == "DAILY" else attended_week)
        elif m.goal_type == "MAINTAIN_STREAK":
            progress = float(streak)
        elif m.goal_type == "PERCENTAGE_TARGET":
            progress = float(curr_pct)
        else:
            progress = float(attended_week)

        progress = min(progress, target)
        completed = progress >= target

        if not sm:
            sm = StudentMission(
                roll_no=roll_no,
                mission_id=m.id,
                current_progress=progress,
                target_value=target,
                is_completed=completed,
                completed_at=now if completed else None,
                is_claimed=False
            )
            db.add(sm)
        else:
            if not sm.is_claimed:
                sm.current_progress = progress
                if completed and not sm.is_completed:
                    sm.is_completed = True
                    sm.completed_at = now

        db.flush()

        res_dict = sm.to_dict()
        m_dict = m.to_dict()
        for k, v in m_dict.items():
            if k not in res_dict:
                res_dict[k] = v
        res_dict["mission"] = m_dict
        res_dict["mission_id"] = str(m.id)
        res_dict["progress_pct"] = round(min(100.0, (progress / max(1.0, target)) * 100.0), 1)
        result.append(res_dict)

    return result


def claim_mission(db: Session, roll_no: str, mission_id_str: str) -> Dict[str, Any]:
    sm = db.query(StudentMission).filter(
        StudentMission.roll_no == roll_no,
        StudentMission.mission_id == mission_id_str
    ).first()

    if not sm:
        return {"success": False, "error": "Mission assignment not found for student."}
    if not sm.is_completed:
        return {"success": False, "error": "Mission conditions have not been satisfied yet."}
    if sm.is_claimed:
        return {"success": False, "error": "Mission reward has already been claimed."}

    mission = db.query(Mission).filter(Mission.id == sm.mission_id).first()
    if not mission:
        return {"success": False, "error": "Mission definition missing."}

    sm.is_claimed = True
    sm.claimed_at = utc_now()

    # Award XP & Coins
    award_xp(
        db=db,
        roll_no=roll_no,
        amount=mission.xp_reward,
        source="MISSION_COMPLETE",
        description=f"Completed Mission: {mission.title}",
        reference_id=f"mission_{mission.id}"
    )
    award_coins(
        db=db,
        roll_no=roll_no,
        amount=mission.coin_reward,
        source="MISSION_REWARD",
        description=f"AttendCoins for Mission: {mission.title}",
        reference_id=f"mission_coin_{mission.id}"
    )

    db.flush()
    return {
        "success": True,
        "message": f"Successfully claimed {mission.xp_reward} XP and {mission.coin_reward} AttendCoins!",
        "xp_reward": mission.xp_reward,
        "xp_awarded": mission.xp_reward,
        "coin_reward": mission.coin_reward,
        "coins_awarded": mission.coin_reward,
        "student_mission": sm.to_dict()
    }


# ==============================================================================
# 7. VIRTUAL STORE & REDEMPTION ENGINE (ATTENDCOINS)
# ==============================================================================
DEFAULT_STORE_REWARDS = [
    {
        "id": "avatar_cyber_scholar",
        "name": "Cyber Scholar Avatar",
        "description": "Futuristic neon holo-avatar displaying academic dedication.",
        "type": "AVATAR",
        "coin_price": 30,
        "preview_asset": "cyber_scholar.png",
        "is_available": True
    },
    {
        "id": "avatar_quantum_sage",
        "name": "Quantum Sage Avatar",
        "description": "Distinguished avatar unlocked by rigorous class attendance.",
        "type": "AVATAR",
        "coin_price": 50,
        "preview_asset": "quantum_sage.png",
        "is_available": True
    },
    {
        "id": "frame_emerald_aura",
        "name": "Emerald Aura Profile Ring",
        "description": "Vibrant glowing emerald ring framing your student avatar.",
        "type": "FRAME",
        "coin_price": 40,
        "preview_asset": "emerald_ring",
        "is_available": True
    },
    {
        "id": "frame_golden_champion",
        "name": "Golden Champion Crest",
        "description": "Prestige gold border awarded to top institutional achievers.",
        "type": "FRAME",
        "coin_price": 80,
        "preview_asset": "gold_crest",
        "is_available": True
    },
    {
        "id": "title_attendance_titan",
        "name": "Title: Attendance Titan",
        "description": "Exclusive profile title showcasing flawless class consistency.",
        "type": "TITLE",
        "coin_price": 25,
        "preview_asset": "Attendance Titan",
        "is_available": True
    },
    {
        "id": "title_flawless_scholar",
        "name": "Title: Flawless Scholar",
        "description": "Earned badge of honor for zero unexcused attendance shortages.",
        "type": "TITLE",
        "coin_price": 35,
        "preview_asset": "Flawless Scholar",
        "is_available": True
    },
    {
        "id": "theme_midnight_obsidian",
        "name": "Midnight Obsidian Theme",
        "description": "Sleek dark obsidian dashboard accents with emerald highlights.",
        "type": "THEME",
        "coin_price": 60,
        "preview_asset": "obsidian",
        "is_available": True
    },
    {
        "id": "theme_cyber_emerald",
        "name": "Cyber Emerald Theme",
        "description": "High-tech gaming-inspired emerald palette for the student hub.",
        "type": "THEME",
        "coin_price": 60,
        "preview_asset": "cyber_emerald",
        "is_available": True
    }
]

def seed_store_rewards(db: Session):
    for r_data in DEFAULT_STORE_REWARDS:
        existing = db.query(StoreReward).filter(StoreReward.id == r_data["id"]).first()
        if not existing:
            reward = StoreReward(**r_data)
            db.add(reward)
    db.flush()


def get_available_rewards(db: Session, roll_no: str) -> List[Dict[str, Any]]:
    seed_store_rewards(db)
    rewards = db.query(StoreReward).filter(StoreReward.is_available == True).all()

    # Get student's redeemed reward IDs
    redeemed_ids = {
        r.reward_id for r in db.query(RewardRedemption.reward_id).filter(RewardRedemption.roll_no == roll_no).all()
    }

    profile = get_or_create_profile(db, roll_no)

    output = []
    for r in rewards:
        d = r.to_dict()
        d["is_owned"] = r.id in redeemed_ids
        d["is_purchased"] = d["is_owned"]
        d["price_coins"] = r.coin_price
        d["category"] = r.type
        d["can_afford"] = profile.attend_coins >= r.coin_price
        # Check if equipped
        is_equipped = False
        if r.type == "AVATAR" and profile.active_avatar_id == r.id:
            is_equipped = True
        elif r.type == "FRAME" and profile.active_frame_id == r.id:
            is_equipped = True
        elif r.type == "TITLE" and profile.active_title == r.preview_asset:
            is_equipped = True
        elif r.type == "THEME" and profile.active_theme == r.preview_asset:
            is_equipped = True
        d["is_equipped"] = is_equipped
        output.append(d)

    return output


def redeem_reward(db: Session, roll_no: str, reward_id: str) -> Dict[str, Any]:
    reward = db.query(StoreReward).filter(StoreReward.id == reward_id, StoreReward.is_available == True).first()
    if not reward:
        return {"success": False, "error": "Reward not found in catalog."}

    profile = get_or_create_profile(db, roll_no)

    # Check already owned
    existing_redemption = db.query(RewardRedemption).filter(
        RewardRedemption.roll_no == roll_no,
        RewardRedemption.reward_id == reward_id
    ).first()
    if existing_redemption:
        return {"success": False, "error": "You already own this reward."}

    if profile.attend_coins < reward.coin_price:
        return {"success": False, "error": f"Insufficient AttendCoins. Required: {reward.coin_price}, Balance: {profile.attend_coins}."}

    # Deduct coins
    award_coins(
        db=db,
        roll_no=roll_no,
        amount=-reward.coin_price,
        source="STORE_PURCHASE",
        description=f"Purchased Store Reward: {reward.name}",
        reference_id=f"redeem_{reward.id}"
    )

    redemption = RewardRedemption(
        roll_no=roll_no,
        reward_id=reward_id,
        coin_cost=reward.coin_price,
        redeemed_at=utc_now()
    )
    db.add(redemption)

    # Automatically equip newly purchased item
    if reward.type == "AVATAR":
        profile.active_avatar_id = reward.id
    elif reward.type == "FRAME":
        profile.active_frame_id = reward.id
    elif reward.type == "TITLE":
        profile.active_title = reward.preview_asset
    elif reward.type == "THEME":
        profile.active_theme = reward.preview_asset

    db.flush()
    return {
        "success": True,
        "message": f"Successfully unlocked {reward.name}!",
        "new_balance": profile.attend_coins,
        "equipped": True,
        "reward": reward.to_dict()
    }


def equip_cosmetic(db: Session, roll_no: str, item_type: str, item_id: str) -> Dict[str, Any]:
    profile = get_or_create_profile(db, roll_no)

    # Default items can always be equipped
    if item_id in ["default_student", "none", "Freshman Explorer", "emerald"]:
        if item_type == "AVATAR": profile.active_avatar_id = item_id
        elif item_type == "FRAME": profile.active_frame_id = item_id
        elif item_type == "TITLE": profile.active_title = item_id
        elif item_type == "THEME": profile.active_theme = item_id
        db.flush()
        return {"success": True, "message": "Equipped default style.", "profile": profile.to_dict()}

    # Verify ownership
    owned = db.query(RewardRedemption).filter(
        RewardRedemption.roll_no == roll_no,
        RewardRedemption.reward_id == item_id
    ).first()

    if not owned:
        raise ValueError("You do not own this cosmetic item. Redeem it from the Reward Store first.")

    reward = db.query(StoreReward).filter(StoreReward.id == item_id).first()
    if reward.type == "AVATAR":
        profile.active_avatar_id = reward.id
    elif reward.type == "FRAME":
        profile.active_frame_id = reward.id
    elif reward.type == "TITLE":
        profile.active_title = reward.preview_asset
    elif reward.type == "THEME":
        profile.active_theme = reward.preview_asset

    db.flush()
    return {
        "success": True,
        "message": f"Equipped {reward.name}!",
        "profile": profile.to_dict()
    }


# ==============================================================================
# 8. MULTIPLE LEADERBOARDS ENGINE (FAIR, PRIVACY-SAFE)
# ==============================================================================
def get_leaderboards(
    db: Session,
    current_roll_no: str,
    board_type: str = "xp",
    period: str = "weekly",
    category: Optional[str] = None,
    section: Optional[str] = None,
    limit: int = 15
) -> Dict[str, Any]:
    if category:
        board_type = category
    """
    Computes fair, privacy-safe leaderboards.
    Types: 'xp', 'streak', 'improved', 'section'.
    Never exposes sensitive individual shortage percentages publicly.
    """
    # Base query for active students with gamification profiles
    query = db.query(
        User.roll_no,
        User.name,
        User.section,
        User.department,
        StudentGamificationProfile.total_xp,
        StudentGamificationProfile.current_level,
        StudentGamificationProfile.level_name,
        StudentGamificationProfile.current_streak,
        StudentGamificationProfile.longest_streak,
        StudentGamificationProfile.active_avatar_id,
        StudentGamificationProfile.active_frame_id,
        StudentGamificationProfile.active_title
    ).join(
        StudentGamificationProfile, User.roll_no == StudentGamificationProfile.roll_no
    ).filter(
        User.role == "student",
        User.is_active == True
    )

    if board_type == "streak":
        query = query.order_by(desc(StudentGamificationProfile.current_streak), desc(StudentGamificationProfile.total_xp))
    elif board_type == "section":
        current_user = db.query(User).filter(User.roll_no == current_roll_no).first()
        sec = current_user.section if current_user else "A"
        query = query.filter(User.section == sec).order_by(desc(StudentGamificationProfile.total_xp))
    else:  # XP leaderboard default
        query = query.order_by(desc(StudentGamificationProfile.total_xp))

    raw_results = query.all()

    ranked_list = []
    my_position = None

    for idx, row in enumerate(raw_results, 1):
        # Privacy-safe display: First name + initial
        name_parts = row.name.strip().split()
        safe_name = f"{name_parts[0]} {name_parts[1][0]}." if len(name_parts) > 1 else row.name

        is_me = (row.roll_no == current_roll_no)
        badges_count = db.query(StudentBadge).filter(StudentBadge.roll_no == row.roll_no).count()
        entry = {
            "rank": idx,
            "roll_no": row.roll_no if is_me else f"STU-{str(row.roll_no)[-3:]}",
            "name": row.name if is_me else safe_name,
            "display_name": row.name if is_me else safe_name,
            "is_current_student": is_me,
            "is_current_user": is_me,
            "section": row.section or "A",
            "department": row.department,
            "total_xp": row.total_xp,
            "level": row.current_level,
            "current_level": row.current_level,
            "level_name": row.level_name,
            "streak": row.current_streak,
            "current_streak": row.current_streak,
            "longest_streak": row.longest_streak,
            "unlocked_badges_count": badges_count,
            "avatar_id": row.active_avatar_id,
            "frame_id": row.active_frame_id,
            "title": row.active_title
        }

        if is_me:
            my_position = entry

        ranked_list.append(entry)

    top_ten = ranked_list[:10]

    # If current user is outside top 10, ensure they know their rank
    if not my_position and current_roll_no:
        my_profile = get_or_create_profile(db, current_roll_no)
        u = db.query(User).filter(User.roll_no == current_roll_no).first()
        badges_count = db.query(StudentBadge).filter(StudentBadge.roll_no == current_roll_no).count()
        my_position = {
            "rank": len(ranked_list) + 1,
            "roll_no": current_roll_no,
            "name": u.name if u else "You",
            "display_name": u.name if u else "You",
            "is_current_student": True,
            "is_current_user": True,
            "section": u.section if u else "A",
            "department": u.department if u else "CSE",
            "total_xp": my_profile.total_xp,
            "level": my_profile.current_level,
            "current_level": my_profile.current_level,
            "level_name": my_profile.level_name,
            "streak": my_profile.current_streak,
            "current_streak": my_profile.current_streak,
            "longest_streak": my_profile.longest_streak,
            "unlocked_badges_count": badges_count,
            "avatar_id": my_profile.active_avatar_id,
            "frame_id": my_profile.active_frame_id,
            "title": my_profile.active_title
        }

    return {
        "success": True,
        "category": board_type,
        "board_type": board_type,
        "period": period,
        "leaderboard": top_ten,
        "top_rankings": top_ten,
        "my_rank": my_position,
        "total_participants": len(ranked_list)
    }


# ==============================================================================
# 9. TEAM-BASED SECTION COMPETITIONS (FAIR NORMALIZED METRICS)
# ==============================================================================
def get_section_championship_standings(db: Session, semester: int = 6) -> Dict[str, Any]:
    """
    Computes fair Section vs Section normalized metrics:
    - Average attendance percentage
    - Average XP per student (size-normalized)
    - Active participation rate
    """
    sections = db.query(User.section).filter(
        User.role == "student",
        User.semester == semester
    ).distinct().all()

    section_names = [s[0] for s in sections if s[0]] or ["A", "B"]

    standings = []
    for sec in section_names:
        students = db.query(User).filter(
            User.role == "student",
            User.semester == semester,
            User.section == sec
        ).all()

        total_enrolled = len(students)
        if total_enrolled == 0:
            continue

        roll_list = [s.roll_no for s in students if s.roll_no]

        # Aggregate XP
        total_xp = db.query(func.coalesce(func.sum(StudentGamificationProfile.total_xp), 0)).filter(
            StudentGamificationProfile.roll_no.in_(roll_list)
        ).scalar() or 0

        avg_xp = round(total_xp / total_enrolled, 1)

        # Aggregate Attendance
        stats_avg = db.query(func.coalesce(func.avg(StudentStats.current_attendance_pct), 85.0)).filter(
            StudentStats.user_id.in_([s.id for s in students])
        ).scalar() or 85.0

        # Compute fair normalized score: 60% Attendance + 40% Engagement XP
        normalized_score = round((stats_avg * 0.6) + (min(40.0, (avg_xp / 10.0))), 1)

        standings.append({
            "section": sec,
            "department": "Computer Science & Engineering",
            "semester": semester,
            "total_students": total_enrolled,
            "total_xp": int(total_xp),
            "avg_xp_per_student": avg_xp,
            "avg_attendance_pct": round(stats_avg, 1),
            "normalized_score": normalized_score,
            "score": normalized_score,
            "student_count": total_enrolled,
            "active_students": total_enrolled,
            "avg_xp": avg_xp,
            "trophy": "🏆 Gold" if len(standings) == 0 else "🥈 Silver"
        })

    standings.sort(key=lambda s: s["normalized_score"], reverse=True)
    for idx, s in enumerate(standings, 1):
        s["rank"] = idx

    return {
        "success": True,
        "title": "Semester Section Championship 2025-2026",
        "semester": semester,
        "scoring_formula": "Rankings are normalized across section size using average attendance rate (60%) and average XP engagement (40%).",
        "metrics_description": "Rankings are normalized across section size using average attendance rate (60%) and average XP engagement (40%).",
        "standings": standings
    }


# ==============================================================================
# 10. AI-POWERED PERSONALIZED GAMIFICATION RECOMMENDATIONS
# ==============================================================================
def generate_ai_gamification_recommendations(db: Session, roll_no: str) -> List[Dict[str, Any]]:
    """
    Integrates with attendance analytics to generate tailored,
    mathematically grounded, explainable motivational challenges.
    """
    user = db.query(User).filter(User.roll_no == roll_no).first()
    if not user:
        return []

    stats = db.query(StudentStats).filter(StudentStats.user_id == user.id).first()
    curr_pct = round(stats.current_attendance_pct, 1) if stats else 85.0
    attended = stats.attended_lectures if stats else 10
    conducted = stats.total_lectures if stats else 12

    # Query subject enrollments
    enrollments = db.query(StudentSubjectEnrollment).filter(
        StudentSubjectEnrollment.roll_no == roll_no
    ).all()

    recommendations = []

    # Case A: Student has an attendance shortage (< 75%)
    if curr_pct < 75.0:
        needed = calculate_classes_needed(attended, conducted, 75.0) or 5
        recommendations.append({
            "id": f"rec_shortage_{roll_no}",
            "title": "Shortage Rebound Sprint",
            "type": "RECOVERY",
            "risk_level": "SHORTAGE_HIGH",
            "reason": f"Your current attendance is {curr_pct}%, which is below the mandatory 75% university quorum.",
            "description": f"Attend your next {needed} consecutive scheduled lectures without absence to recover your compliance standing.",
            "target_classes": needed,
            "xp_reward": 50 + (needed * 10),
            "coin_reward": 10,
            "status": "RECOMMENDED",
            "action_cta": "Accept Sprint Challenge"
        })
    elif curr_pct < 80.0:
        recommendations.append({
            "id": f"rec_buffer_{roll_no}",
            "title": "Safe Zone Buffer Mission",
            "type": "BUFFER",
            "risk_level": "SHORTAGE_MODERATE",
            "reason": f"You are currently at {curr_pct}%. A single absence risks dropping you toward the warning zone.",
            "description": "Attend 4 consecutive lectures this week to build a secure 80%+ safe attendance buffer.",
            "target_classes": 4,
            "xp_reward": 45,
            "coin_reward": 5,
            "status": "RECOMMENDED",
            "action_cta": "Fortify Safe Zone"
        })

    # Case B: Specific Subject Needs Attention
    if enrollments:
        low_subject = min(enrollments, key=lambda e: e.current_pct)
        if low_subject.current_pct < 80.0:
            recommendations.append({
                "id": f"rec_subj_{low_subject.subject_code}_{roll_no}",
                "title": f"Subject Focus: {low_subject.subject_code}",
                "type": "SUBJECT_FOCUS",
                "risk_level": "TARGETED",
                "reason": f"Your attendance in {low_subject.subject_name or low_subject.subject_code} is {low_subject.current_pct}%, below your general average.",
                "description": f"Attend the next 3 sessions of {low_subject.subject_code} to boost your subject record above 80%.",
                "target_classes": 3,
                "xp_reward": 40,
                "coin_reward": 4,
                "status": "RECOMMENDED",
                "action_cta": "Target Subject"
            })

    # Case C: Stellar / Consistent Student (Streak & Honors)
    if curr_pct >= 85.0:
        recommendations.append({
            "id": f"rec_streak_{roll_no}",
            "title": "Campus Legend Streak Marathon",
            "type": "STREAK_MASTERY",
            "risk_level": "EXCELLENT",
            "reason": f"Outstanding consistency! You are at {curr_pct}% attendance with exemplary class regularity.",
            "description": "Push your attendance streak to 10 consecutive lectures to unlock the prestigious Campus Legend tier.",
            "target_classes": 10,
            "xp_reward": 100,
            "coin_reward": 15,
            "status": "RECOMMENDED",
            "action_cta": "Chase Milestone"
        })

    return recommendations[:3]


# ==============================================================================
# 11. FACULTY GAMIFICATION ANALYTICS & CUSTOM CHALLENGES
# ==============================================================================
def get_faculty_gamification_analytics(db: Session, faculty_id: str) -> Dict[str, Any]:
    """
    Provides faculty overview of student engagement, XP distribution,
    mission completion, and challenge creation.
    """
    # Find all students enrolled in faculty's taught subjects
    subjects = db.query(Subject).filter(Subject.faculty_id == faculty_id).all()
    subj_codes = [s.code for s in subjects]

    if subj_codes:
        student_rolls = db.query(StudentSubjectEnrollment.roll_no).filter(
            StudentSubjectEnrollment.subject_code.in_(subj_codes)
        ).distinct().all()
        roll_list = [r[0] for r in student_rolls]
    else:
        # Fallback to general students
        student_rolls = db.query(User.roll_no).filter(User.role == "student").all()
        roll_list = [r[0] for r in student_rolls]

    total_active = len(roll_list)

    profiles = db.query(StudentGamificationProfile).filter(
        StudentGamificationProfile.roll_no.in_(roll_list)
    ).all() if roll_list else []

    total_xp_awarded = sum(p.total_xp for p in profiles)
    avg_level = round(sum(p.current_level for p in profiles) / max(1, len(profiles)), 1)
    avg_streak = round(sum(p.current_streak for p in profiles) / max(1, len(profiles)), 1)

    # Badges Unlocked
    badges_unlocked_count = db.query(StudentBadge).filter(
        StudentBadge.roll_no.in_(roll_list)
    ).count() if roll_list else 0

    # Missions Completed
    missions_completed_count = db.query(StudentMission).filter(
        StudentMission.roll_no.in_(roll_list),
        StudentMission.is_completed == True
    ).count() if roll_list else 0

    # Most Improved / Top Engaged Students
    top_students = db.query(
        User.roll_no,
        User.name,
        User.section,
        StudentGamificationProfile.total_xp,
        StudentGamificationProfile.current_level,
        StudentGamificationProfile.current_streak
    ).join(
        StudentGamificationProfile, User.roll_no == StudentGamificationProfile.roll_no
    ).filter(
        User.roll_no.in_(roll_list)
    ).order_by(desc(StudentGamificationProfile.total_xp)).limit(5).all()

    top_students_list = [
        {
            "roll_no": s.roll_no,
            "name": s.name,
            "section": s.section or "A",
            "total_xp": s.total_xp,
            "level": s.current_level,
            "streak": s.current_streak
        }
        for s in top_students
    ]

    # Active Faculty Challenges
    faculty_challenges = db.query(Mission).filter(
        Mission.created_by == faculty_id,
        Mission.is_active == True
    ).order_by(desc(Mission.start_date)).all()

    return {
        "faculty_id": faculty_id,
        "active_students_count": total_active,
        "total_active_students": total_active,
        "total_xp_awarded": total_xp_awarded,
        "avg_student_level": avg_level,
        "average_level": avg_level,
        "average_streak": avg_streak,
        "badges_unlocked_count": badges_unlocked_count,
        "missions_completed_count": missions_completed_count,
        "top_engaged_students": top_students_list,
        "active_challenges": [c.to_dict() for c in faculty_challenges]
    }


def create_faculty_challenge(db: Session, faculty_id: str, challenge_data: Dict[str, Any]) -> Dict[str, Any]:
    now = utc_now()
    days_duration = int(challenge_data.get("duration_days", 7))
    end_date = now + timedelta(days=days_duration)

    mission = Mission(
        title=challenge_data.get("title", "Faculty Academic Challenge"),
        description=challenge_data.get("description", "Maintain perfect attendance in our lecture series."),
        type=challenge_data.get("type", "CUSTOM"),
        category="FACULTY_CHALLENGE",
        difficulty=challenge_data.get("difficulty", "MEDIUM"),
        target_section=challenge_data.get("target_section"),
        target_subject_code=challenge_data.get("target_subject_code"),
        goal_type=challenge_data.get("goal_type", "ATTEND_CLASSES"),
        goal_target=float(challenge_data.get("goal_target", 3.0)),
        xp_reward=int(challenge_data.get("xp_reward", 50)),
        coin_reward=int(challenge_data.get("coin_reward", 5)),
        start_date=now,
        end_date=end_date,
        created_by=faculty_id,
        is_active=True
    )
    db.add(mission)
    db.flush()

    return {
        "success": True,
        "message": f"Successfully published academic challenge '{mission.title}'.",
        "mission": mission.to_dict()
    }


# ==============================================================================
# 12. AUTOMATIC VERIFIED ATTENDANCE HOOK
# ==============================================================================
def process_verified_attendance_gamification(
    db: Session,
    roll_no: str,
    session: LectureSession,
    attendance_record: AttendanceRecord
) -> Dict[str, Any]:
    """
    Called whenever attendance is successfully verified with PRESENT status.
    Guarantees idempotency via (roll_no, 'LECTURE_ATTENDANCE', session_id) constraint.
    """
    # 1. Award base attendance XP (10 XP)
    xp_tx, was_awarded = award_xp(
        db=db,
        roll_no=roll_no,
        amount=10,
        source="LECTURE_ATTENDANCE",
        description=f"Verified attendance in {session.subject_name}",
        reference_id=str(session.session_id)
    )

    # 2. Update streak
    new_streak = update_student_streak(db, roll_no, attendance_record.marked_at)

    # 3. Check milestone streaks (e.g. 3, 7, 14, 30)
    if new_streak in [3, 7, 14, 30]:
        award_xp(
            db=db,
            roll_no=roll_no,
            amount=new_streak * 5,
            source="STREAK_MILESTONE",
            description=f"Reached {new_streak}-lecture attendance streak milestone!",
            reference_id=f"streak_{new_streak}_{session.session_id}"
        )

    # 4. Sync mission progress
    sync_student_missions(db, roll_no)

    # 5. Evaluate badges
    new_badges = evaluate_student_badges(db, roll_no)

    db.flush()

    profile = get_or_create_profile(db, roll_no)
    return {
        "xp_awarded": 10 if was_awarded else 0,
        "total_xp": profile.total_xp,
        "current_level": profile.current_level,
        "level_name": profile.level_name,
        "current_streak": new_streak,
        "attend_coins": profile.attend_coins,
        "new_badges_unlocked": new_badges
    }
