# SmartAttend-AI 🛡️🤖
### Production-Ready Anti-Proxy & AI-Driven Attendance System (PWA)

A full-stack, production-grade attendance and retention management system featuring a **5-Gate Anti-Proxy Engine**, **Random Forest Machine Learning Defaulter Radar**, **What-If Bunk Calculator**, and **Role-Based Access Control (Student, Faculty, Admin)**.

---

## 🚀 Key Highlights & Architectural Features

### 1. 🛡️ 5-Gate Anti-Proxy Verification Engine
Every attendance submission passes through 5 sequential hardware, temporal, spatial, and biometric security gates:
- **Gate 1: Hardware Device Lock & 1-Phone Rule**: Enforces physical device fingerprint binding (`DEV-XXXXXX`). Prevents proxy submissions by ensuring 1 phone cannot sign attendance for multiple students in the same lecture.
- **Gate 2: Dynamic QR Timestamp & Cryptographic Signature**: Projects a dynamic QR token refreshed every 5 seconds (`session_id.epoch.hmac_signature`). Validates that the token age is $\le 7\text{ seconds}$, completely eliminating photo-sharing or projector re-broadcast attacks.
- **Gate 3: GPS Geofence (Haversine Formula)**: Calculates spherical distance between lecture classroom coordinates and the student's live location. Submissions beyond **60 meters** are rejected.
- **Gate 4: AI Face Match Verification**: Analyzes live selfie against student's reference image using OpenCV color/grayscale histogram correlation and normalized structural similarity (threshold $\ge 55\%$).
- **Gate 5: Fraud Logger & Decision Grant**: Any breach logs detailed forensics to `security_alerts` (failed gate, GPS coordinates, device ID, timestamp). Successful checks record attendance and update streaks.

### 2. 🧠 Random Forest ML Defaulter Predictor & What-If Bunk Calculator
- **Trained Scikit-Learn Model** (`attendance_risk_model.pkl`): Evaluates behavioral attendance features:
  - `current_attendance_pct`
  - `last_14_days_pct` (momentum drift)
  - `mon_fri_skip_rate` (weekend extension patterns)
  - `first_lecture_miss_rate` (morning lecture absenteeism)
  - `current_streak` (consecutive attendance momentum)
- **Defaulter Radar**: Predicts student risk of dropping below 75% attendance by semester end with probabilistic severity (`CRITICAL`, `WARNING`, `NORMAL`).
- **Interactive What-If Bunk Calculator**: Dynamically computes exact lectures safe to skip while staying above 75%, or consecutive lectures required to recover.

### 3. 👥 Role-Based Portals (RBAC)
- **Student Portal (Mobile-First PWA)**: Device fingerprint bar, Touch ID/Passkey simulation, live 5-gate animated checklist, Viva/Defense Testing Simulator, and subject attendance analytics.
- **Faculty Portal (Desktop Console)**: 5-second auto-rotating QR code generator with visual countdown, **1-Click Teacher Manual Attendance Override** (for dead phone/battery exceptions), live security red feed, and Exception Approval Queue.
- **Admin Portal (System Governance)**: Institutional overview KPI cards, **Hardware Device Reset Manager** (for students who switch/buy new phones), ML Defaulter Watchlist, and 1-click CSV report export.

---

## 🛠️ Tech Stack

- **Backend**: Python 3.12, FastAPI, Uvicorn, PyMongo, Pydantic v2
- **Database**: MongoDB Atlas (with resilient in-memory fallback for offline testing)
- **Machine Learning & Vision**: Scikit-Learn (RandomForestClassifier), OpenCV, Pillow, Pandas, NumPy, Joblib
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, QRCode.react, Canvas Confetti

---

## ⚡ Quick Start Guide

### 1. Backend Setup
```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
python seed_data.py
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
*Backend runs on:* `http://localhost:8000`  
*Swagger API Docs:* `http://localhost:8000/docs`

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs on:* `http://localhost:5173`

---

## 🔑 Demo Credentials

| Role | Roll No / ID | Password | Profile Details |
| :--- | :--- | :--- | :--- |
| **Student** | `STU01` | `stu123` | Aarav Sharma (Safe Standing ~85.5% Att.) |
| **Student** | `STU02` | `stu123` | Priya Patel (Borderline 76.2% Att. \| ML Risk 99.8%) |
| **Student** | `STU03` | `stu123` | Rohan Verma (Chronic Defaulter 64.8% Att. \| ML Risk 100%) |
| **Faculty** | `FAC01` | `fac123` | Prof. Alan Turing (CSE Department) |
| **Admin** | `ADM01` | `admin123` | System Administrator (Full System Oversight) |

---

## 📄 License
MIT License &bull; Designed for robust, tamper-proof academic attendance management.
