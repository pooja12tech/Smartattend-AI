import os
from datetime import datetime, timezone
import joblib
from database import (
    check_connection,
    init_db_indexes,
    get_users_collection,
    get_lecture_sessions_collection,
    MONGODB_URI
)

def run_seed():
    print("=" * 60)
    print(" SmartAttend-AI : Seed Data Generation ")
    print("=" * 60)
    print(f"Connecting to MongoDB URI: {MONGODB_URI}")

    if not check_connection():
        print("\n[ERROR] Could not connect to MongoDB!")
        print("Please check that:")
        print("1. Your MongoDB Atlas connection string is pasted in `backend/.env`:")
        print("   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/smartattend_db?retryWrites=true&w=majority")
        print("2. Your current IP address is whitelisted in MongoDB Atlas Network Access.")
        print("3. Or local MongoDB is running if using mongodb://localhost:27017")
        return False

    # Initialize indexes
    init_db_indexes()

    users_col = get_users_collection()
    sessions_col = get_lecture_sessions_collection()

    # Load ML Model if available to predict initial risk scores for students
    base_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(base_dir, "attendance_risk_model.pkl")
    ml_model = None
    if os.path.exists(model_path):
        try:
            model_data = joblib.load(model_path)
            ml_model = model_data["model"]
            print(f"[Seed] Loaded ML Risk Model from {model_path}")
        except Exception as e:
            print(f"[Seed Warning] Could not load ML model: {e}")

    # 1. Admin record
    admin = {
        "admin_id": "ADM01",
        "roll_no": "ADM01",
        "name": "System Administrator",
        "email": "admin@smartattend.edu",
        "role": "admin",
        "password": "admin123",
        "department": "Administration",
        "is_active": True,
        "created_at": datetime.now(timezone.utc)
    }
    users_col.update_one(
        {"email": admin["email"]},
        {"$set": admin},
        upsert=True
    )
    print(f"\n[Seed] Admin upserted: {admin['name']} ({admin['admin_id']}) - Pass: {admin['password']}")

    # 2. Faculty record
    faculty = {
        "faculty_id": "FAC01",
        "roll_no": "FAC01",
        "name": "Prof. Alan Turing",
        "email": "faculty@smartattend.edu",
        "role": "faculty",
        "password": "fac123",
        "department": "Computer Science & Engineering",
        "courses_taught": ["CS301 - Operating Systems", "CS402 - Machine Learning"],
        "is_active": True,
        "created_at": datetime.now(timezone.utc)
    }

    users_col.update_one(
        {"email": faculty["email"]},
        {"$set": faculty},
        upsert=True
    )
    print(f"[Seed] Faculty upserted: {faculty['name']} ({faculty['faculty_id']}) - Pass: {faculty['password']}")

    # 3. Student records with historical attendance features & passwords
    students = [
        {
            "roll_no": "STU01",
            "name": "Aarav Sharma",
            "email": "aarav@smartattend.edu",
            "password": "stu123",
            "role": "student",
            "department": "Computer Science & Engineering",
            "semester": 6,
            "bound_device_id": "DEV-AARAV-PHONE-01",
            "registered_device_id": "DEV-AARAV-PHONE-01",
            "attendance_stats": {
                "current_attendance_pct": 85.5,
                "last_14_days_pct": 88.0,
                "mon_fri_skip_rate": 0.10,
                "first_lecture_miss_rate": 0.08,
                "current_streak": 8,
                "total_lectures": 40,
                "attended_lectures": 34
            },
            "status_category": "Safe"
        },
        {
            "roll_no": "STU02",
            "name": "Priya Patel",
            "email": "priya@smartattend.edu",
            "password": "stu123",
            "role": "student",
            "department": "Computer Science & Engineering",
            "semester": 6,
            "bound_device_id": "DEV-PRIYA-PHONE-02",
            "registered_device_id": "DEV-PRIYA-PHONE-02",
            "attendance_stats": {
                "current_attendance_pct": 76.2,
                "last_14_days_pct": 68.0,
                "mon_fri_skip_rate": 0.42,
                "first_lecture_miss_rate": 0.38,
                "current_streak": -1,
                "total_lectures": 40,
                "attended_lectures": 30
            },
            "status_category": "Borderline High-Risk"
        },
        {
            "roll_no": "STU03",
            "name": "Rohan Verma",
            "email": "rohan@smartattend.edu",
            "password": "stu123",
            "role": "student",
            "department": "Computer Science & Engineering",
            "semester": 6,
            "bound_device_id": "DEV-ROHAN-PHONE-03",
            "registered_device_id": "DEV-ROHAN-PHONE-03",
            "attendance_stats": {
                "current_attendance_pct": 64.8,
                "last_14_days_pct": 50.0,
                "mon_fri_skip_rate": 0.65,
                "first_lecture_miss_rate": 0.60,
                "current_streak": -4,
                "total_lectures": 40,
                "attended_lectures": 26
            },
            "status_category": "Low / Defaulter"
        }
    ]

    print("\n[Seed] Upserting Students & Computing ML Risk Scores...")
    for stu in students:
        stats = stu["attendance_stats"]

        # Run ML inference if model is loaded
        if ml_model is not None:
            import pandas as pd
            features_df = pd.DataFrame([{
                "current_attendance_pct": stats["current_attendance_pct"],
                "last_14_days_pct": stats["last_14_days_pct"],
                "mon_fri_skip_rate": stats["mon_fri_skip_rate"],
                "first_lecture_miss_rate": stats["first_lecture_miss_rate"],
                "current_streak": stats["current_streak"]
            }])
            pred = int(ml_model.predict(features_df)[0])
            prob = float(ml_model.predict_proba(features_df)[0][1])
            stu["ai_risk_prediction"] = {
                "will_be_defaulter": pred,
                "defaulter_probability": round(prob, 4),
                "risk_level": "CRITICAL" if prob >= 0.70 else ("WARNING" if prob >= 0.40 else "NORMAL"),
                "evaluated_at": datetime.now(timezone.utc)
            }
        else:
            stu["ai_risk_prediction"] = {
                "will_be_defaulter": 1 if stats["current_attendance_pct"] < 75.0 else 0,
                "defaulter_probability": 0.85 if stats["current_attendance_pct"] < 75.0 else 0.15,
                "risk_level": "WARNING" if stats["current_attendance_pct"] < 75.0 else "NORMAL",
                "evaluated_at": datetime.now(timezone.utc)
            }

        stu["updated_at"] = datetime.now(timezone.utc)
        users_col.update_one(
            {"roll_no": stu["roll_no"]},
            {"$set": stu},
            upsert=True
        )

        risk_info = stu["ai_risk_prediction"]
        print(f"  [OK] [{stu['roll_no']}] {stu['name']} - Pass: {stu['password']} | Attendance: {stats['current_attendance_pct']}% | "
              f"AI Defaulter Risk: {risk_info['defaulter_probability'] * 100:.1f}% ({risk_info['risk_level']})")

    # 4. Create sample active lecture session
    sample_session = {
        "session_id": "CS301-SEC-A",
        "session_code": "CS301-SEC-A",
        "subject_name": "CS301 - Operating Systems",
        "faculty_id": "FAC01",
        "status": "ACTIVE",
        "room_no": "LAB-302",
        "class_lat": 19.0760,
        "class_lng": 72.8777,
        "geofence_radius_meters": 60,
        "created_at": datetime.now(timezone.utc)
    }
    sessions_col.update_one(
        {"session_id": sample_session["session_id"]},
        {"$set": sample_session},
        upsert=True
    )
    print(f"\n[Seed] Sample lecture session initialized: {sample_session['session_code']}")

    print("\n[SUCCESS] Seed data completed successfully!")
    return True

if __name__ == "__main__":
    run_seed()
