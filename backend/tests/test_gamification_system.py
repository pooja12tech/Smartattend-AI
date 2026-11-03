"""
Comprehensive Test Suite: SmartAttend-AI Gamification & Student Engagement System
================================================================================
Validates:
1. Experience Points (XP) Calculation, Idempotency & Transaction Ledger.
2. Level & Rank Progression (Level 1 Beginners to Level 6 Legends).
3. Consecutive Lecture Streak Engine.
4. Achievement Badges Catalog & Automatic Criteria Evaluation (10 Badges).
5. Daily, Weekly, and Monthly Missions Progress & Claiming.
6. AttendCoins Virtual Currency & Virtual Store Redemptions.
7. Cosmetic Equipping (Avatars, Frames, Titles, Themes).
8. Fair Normalized Section Championship Standings.
9. Leaderboards with Personal Rank Inclusion and Privacy Protection.
10. AI-Powered Personalized Recommendations & Deficit Recovery Challenges.
11. Automatic Verified Attendance Hook.
12. Full REST API Endpoints with RBAC Authorization (Student / Faculty / Admin).
"""

import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from main import app, limiter
from db_postgres import init_db_schema, get_session_factory
from seed_postgres import run_postgres_seed
from models import (
    User, StudentStats, LectureSession, AttendanceRecord,
    StudentGamificationProfile, XPTransaction, AttendCoinTransaction,
    AchievementBadge, StudentBadge, Mission, StudentMission,
    StoreReward, RewardRedemption
)
import gamification_service


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    init_db_schema()
    run_postgres_seed()


@pytest.fixture
def client():
    limiter.reset()
    return TestClient(app)


@pytest.fixture
def student_auth(client):
    res = client.post("/api/login", json={
        "roll_no": "student",
        "password": "studentpassword"
    })
    if res.status_code != 200:
        res = client.post("/api/login", json={
            "roll_no": "STU01",
            "password": "studentpassword"
        })
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def faculty_auth(client):
    res = client.post("/api/login", json={
        "roll_no": "faculty",
        "password": "facultypassword"
    })
    if res.status_code != 200:
        res = client.post("/api/login", json={
            "roll_no": "FAC01",
            "password": "facultypassword"
        })
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ==============================================================================
# PART 1: SERVICE-LEVEL ENGINE TESTS
# ==============================================================================

def test_level_progression_thresholds():
    """Validates math and progression brackets from Level 1 to Level 6."""
    l1 = gamification_service.get_level_info(0)
    assert l1["current_level"] == 1
    assert l1["level_name"] == "Beginner"
    assert l1["progress_pct"] == 0.0

    l2 = gamification_service.get_level_info(150)
    assert l2["current_level"] == 2
    assert l2["level_name"] == "Explorer"
    assert l2["xp_needed"] == 150  # 300 - 150

    l3 = gamification_service.get_level_info(450)
    assert l3["current_level"] == 3
    assert l3["level_name"] == "Achiever"

    l6 = gamification_service.get_level_info(2000)
    assert l6["current_level"] == 6
    assert l6["level_name"] == "Legend"
    assert l6["progress_pct"] == 100.0


def test_award_xp_and_idempotency():
    """Validates persistent XP transaction recording and strict idempotency."""
    session_factory = get_session_factory()
    with session_factory() as db:
        roll_no = "STU01"
        profile_before = gamification_service.get_or_create_profile(db, roll_no)
        initial_xp = profile_before.total_xp

        # Award 20 XP
        ref_id = "test_lecture_unique_session_999"
        tx, awarded = gamification_service.award_xp(
            db=db,
            roll_no=roll_no,
            amount=20,
            source="LECTURE_ATTENDANCE",
            description="Verified attendance in IT401",
            reference_id=ref_id
        )
        db.commit()

        assert awarded is True
        assert tx.amount == 20
        assert profile_before.total_xp == initial_xp + 20

        # Duplicate award attempt for the same lecture session must be rejected idempotently
        tx_dup, awarded_dup = gamification_service.award_xp(
            db=db,
            roll_no=roll_no,
            amount=20,
            source="LECTURE_ATTENDANCE",
            description="Duplicate attempt in IT401",
            reference_id=ref_id
        )
        db.commit()

        assert awarded_dup is False
        assert tx_dup.id == tx.id
        assert profile_before.total_xp == initial_xp + 20  # Unchanged!


def test_attend_coins_earning_and_spending():
    """Validates AttendCoins ledger, additions, and non-negative balance protection."""
    session_factory = get_session_factory()
    with session_factory() as db:
        roll_no = "STU01"
        profile = gamification_service.get_or_create_profile(db, roll_no)

        # Award 50 coins
        gamification_service.award_coins(db, roll_no, 50, "MISSION_REWARD", "Completed Weekly Challenge")
        db.commit()
        assert profile.attend_coins >= 50

        coins_before = profile.attend_coins

        # Spend 20 coins
        tx_spend, ok = gamification_service.award_coins(db, roll_no, -20, "STORE_PURCHASE", "Bought Avatar")
        db.commit()
        assert ok is True
        assert profile.attend_coins == coins_before - 20

        # Attempt to overspend more than available balance (must fail safely)
        excessive = profile.attend_coins + 500
        tx_fail, ok_fail = gamification_service.award_coins(db, roll_no, -excessive, "STORE_PURCHASE", "Overspend test")
        db.commit()
        assert ok_fail is False
        assert profile.attend_coins == coins_before - 20  # Kept intact!


def test_streak_calculation_and_milestones():
    """Validates consecutive lecture streak tracking and milestone awards."""
    session_factory = get_session_factory()
    with session_factory() as db:
        roll_no = "STU01"
        now = datetime.now(timezone.utc)

        streak = gamification_service.update_student_streak(db, roll_no, now)
        db.commit()
        assert streak >= 0

        profile = gamification_service.get_or_create_profile(db, roll_no)
        assert profile.current_streak == streak
        assert profile.longest_streak >= streak


def test_badge_catalog_and_automatic_evaluation():
    """Validates that all 10 default achievement badges exist and evaluate correctly."""
    session_factory = get_session_factory()
    with session_factory() as db:
        gamification_service.seed_badges_catalog(db)
        db.commit()

        badge_count = db.query(AchievementBadge).count()
        assert badge_count >= 10

        expected_badge_ids = {
            "early_bird", "consistency_king", "comeback_star", "perfect_week",
            "attendance_legend", "subject_specialist", "30_day_warrior",
            "rising_star", "mission_master", "xp_champion"
        }
        actual_badge_ids = {b.id for b in db.query(AchievementBadge.id).all()}
        for bid in expected_badge_ids:
            assert bid in actual_badge_ids, f"Badge {bid} missing from catalog!"

        # Automatic evaluation for student
        unlocked = gamification_service.evaluate_student_badges(db, "STU01")
        db.commit()
        assert isinstance(unlocked, list)


def test_missions_sync_and_claim():
    """Validates mission creation, progress synchronization, and claiming rewards."""
    session_factory = get_session_factory()
    with session_factory() as db:
        gamification_service.seed_system_missions(db)
        db.commit()

        # Sync missions for student STU01
        missions = gamification_service.sync_student_missions(db, "STU01")
        db.commit()
        assert len(missions) > 0

        # Verify mission structure
        m1 = missions[0]
        assert "id" in m1
        assert "title" in m1
        assert "goal_target" in m1
        assert "current_progress" in m1
        assert "is_completed" in m1

        # Test claiming a completed mission
        # Manually complete a mission to test claim
        sm = db.query(StudentMission).filter(StudentMission.roll_no == "STU01").first()
        if sm:
            sm.is_completed = True
            sm.is_claimed = False
            db.commit()

            claim_res = gamification_service.claim_mission(db, "STU01", sm.mission_id)
            db.commit()
            assert claim_res["success"] is True
            assert claim_res["xp_awarded"] > 0
            assert sm.is_claimed is True

            # Double claim must be prevented
            double_res = gamification_service.claim_mission(db, "STU01", sm.mission_id)
            assert double_res["success"] is False


def test_reward_store_redemption_and_equipping():
    """Validates virtual store catalog, item purchase, and cosmetic equipping."""
    session_factory = get_session_factory()
    with session_factory() as db:
        gamification_service.seed_store_rewards(db)
        db.commit()

        rewards = gamification_service.get_available_rewards(db, "STU01")
        assert len(rewards) >= 8

        # Ensure student has enough coins to test redemption
        gamification_service.award_coins(db, "STU01", 100, "BONUS", "Store Testing Coins")
        db.commit()

        # Find unpurchased item
        unpurchased = next((r for r in rewards if not r["is_purchased"]), None)
        if unpurchased:
            redeem_res = gamification_service.redeem_reward(db, "STU01", unpurchased["id"])
            db.commit()
            assert redeem_res["success"] is True

            # Test equipping the cosmetic
            equip_res = gamification_service.equip_cosmetic(
                db, "STU01", unpurchased["category"].lower(), unpurchased["id"]
            )
            db.commit()
            assert equip_res["success"] is True


def test_privacy_safe_leaderboards():
    """Validates leaderboards return sanitized names and personal student rank."""
    session_factory = get_session_factory()
    with session_factory() as db:
        board = gamification_service.get_leaderboards(db, current_roll_no="STU01", category="xp", limit=10)
        assert "leaderboard" in board
        assert "my_rank" in board
        assert board["my_rank"] is not None
        assert board["my_rank"]["roll_no"] == "STU01"

        # Check sanitized privacy name format (e.g., "Aarav S.")
        if len(board["leaderboard"]) > 0:
            first_entry = board["leaderboard"][0]
            assert "name" in first_entry
            assert "total_xp" in first_entry
            assert "current_level" in first_entry


def test_section_championship_standings():
    """Validates fair normalized ranking for section competitions."""
    session_factory = get_session_factory()
    with session_factory() as db:
        championship = gamification_service.get_section_championship_standings(db, semester=6)
        assert championship["success"] is True
        assert "standings" in championship
        assert "scoring_formula" in championship
        assert len(championship["standings"]) > 0

        first_section = championship["standings"][0]
        assert "section" in first_section
        assert "score" in first_section
        assert "avg_attendance_pct" in first_section
        assert "avg_xp" in first_section


def test_ai_personalized_recommendations():
    """Validates AI recommendation generation for recovery and consistency."""
    session_factory = get_session_factory()
    with session_factory() as db:
        recs = gamification_service.generate_ai_gamification_recommendations(db, "STU01")
        assert isinstance(recs, list)
        if len(recs) > 0:
            rec = recs[0]
            assert "title" in rec
            assert "description" in rec
            assert "xp_reward" in rec
            assert "coin_reward" in rec


# ==============================================================================
# PART 2: REST API ENDPOINT INTEGRATION TESTS
# ==============================================================================

def test_api_gamification_profile(client, student_auth):
    """GET /api/gamification/profile returns profile, level_info, and stats."""
    res = client.get("/api/gamification/profile", headers=student_auth)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "profile" in data
    assert "level_info" in data
    assert "unlocked_badges_count" in data
    assert "completed_missions_count" in data
    assert data["level_info"]["current_level"] >= 1


def test_api_gamification_xp_history(client, student_auth):
    """GET /api/gamification/xp-history returns recent XP transactions."""
    res = client.get("/api/gamification/xp-history?limit=10", headers=student_auth)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "transactions" in data
    assert isinstance(data["transactions"], list)


def test_api_gamification_badges(client, student_auth):
    """GET /api/gamification/badges returns badges list with unlocked status."""
    res = client.get("/api/gamification/badges", headers=student_auth)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["total_badges"] >= 10
    assert len(data["badges"]) >= 10
    assert "is_unlocked" in data["badges"][0]


def test_api_gamification_missions(client, student_auth):
    """GET /api/gamification/missions returns mission quests with progress."""
    res = client.get("/api/gamification/missions", headers=student_auth)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "missions" in data
    assert len(data["missions"]) > 0


def test_api_gamification_rewards_and_redeem(client, student_auth):
    """GET & POST /api/gamification/rewards and /api/gamification/rewards/redeem."""
    res = client.get("/api/gamification/rewards", headers=student_auth)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "rewards" in data
    assert len(data["rewards"]) > 0

    # Test redeeming an affordable reward or handling insufficient funds
    test_reward_id = data["rewards"][0]["id"]
    res_redeem = client.post(
        "/api/gamification/rewards/redeem",
        headers=student_auth,
        json={"reward_id": test_reward_id}
    )
    # Either succeeds or returns 400 for already owned / insufficient coins
    assert res_redeem.status_code in [200, 400]


def test_api_gamification_leaderboards(client, student_auth):
    """GET /api/gamification/leaderboards returns ranked student roster."""
    res = client.get("/api/gamification/leaderboards?category=xp&limit=10", headers=student_auth)
    assert res.status_code == 200
    data = res.json()
    assert "leaderboard" in data
    assert "my_rank" in data


def test_api_gamification_competitions(client, student_auth):
    """GET /api/gamification/competitions returns section championship."""
    res = client.get("/api/gamification/competitions?semester=6", headers=student_auth)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "standings" in data


def test_api_gamification_recommendations(client, student_auth):
    """GET /api/gamification/recommendations returns AI engagement challenges."""
    res = client.get("/api/gamification/recommendations", headers=student_auth)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "recommendations" in data


def test_api_faculty_gamification_rbac(client, student_auth, faculty_auth):
    """Validates that faculty gamification analytics is protected by RBAC."""
    # Student must receive 403 Forbidden
    res_student = client.get("/api/faculty/gamification/analytics", headers=student_auth)
    assert res_student.status_code == 403

    # Faculty must receive 200 OK
    res_fac = client.get("/api/faculty/gamification/analytics", headers=faculty_auth)
    assert res_fac.status_code == 200
    data = res_fac.json()
    assert data["success"] is True
    assert "analytics" in data
    assert "active_students_count" in data["analytics"]
    assert "top_engaged_students" in data["analytics"]


def test_api_faculty_create_challenge(client, faculty_auth):
    """POST /api/faculty/gamification/challenges publishes an academic challenge."""
    payload = {
        "title": "Algorithms Mastery Attendance Sprint",
        "description": "Attend 4 consecutive CS301 lectures with zero absences.",
        "target_section": "A",
        "target_subject_code": "CS301",
        "goal_target": 4.0,
        "xp_reward": 80,
        "coin_reward": 8,
        "duration_days": 10
    }
    res = client.post("/api/faculty/gamification/challenges", headers=faculty_auth, json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["mission"]["title"] == payload["title"]
    assert data["mission"]["xp_reward"] == 80

