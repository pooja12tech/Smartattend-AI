# SmartAttend-AI 🛡️🤖
### Anti-Proxy & AI-Driven Smart Attendance System (PWA) [Prototype]

An academic attendance and retention management system featuring a **5-Gate Anti-Proxy Verification Workflow**, **Random Forest Machine Learning Defaulter Radar**, **What-If Bunk Calculator**, **Role-Based Access Control (Student, Faculty, Admin)**, and a **Cloud PostgreSQL (Neon)** relational data layer with Alembic migrations.

---

## 🚀 Key Highlights & Architectural Features

### 1. 🛡️ 5-Gate Anti-Proxy Verification Workflow
Every attendance submission passes through 5 sequential identity, temporal, spatial, and validation checks:
- **Gate 1: Browser-Stored Device Identifier & 1-Device Rule**: Binds an initial client-generated device ID stored in browser `localStorage`. Enforces relational database unique constraints (`uq_session_device`) ensuring a single browser session cannot submit attendance for multiple students during the same lecture session.
- **Gate 2: Dynamic QR Window & Cryptographic Signature**: Projects a rotating QR token (`session_id.window_index.hmac_signature`) based on configurable time windows (default `QR_WINDOW_SECONDS=20s`). The backend validates HMAC-SHA256 signatures for the current and immediately preceding time window, rejecting stale or re-broadcast tokens.
- **Gate 3: GPS Geofence (Haversine Formula)**: Calculates spherical distance between lecture classroom coordinates and the student's reported location. Submissions beyond **60 meters** are rejected.
- **Gate 4: Prototype Face Similarity Heuristic**: Compares live camera capture against reference image using HSV color histogram and pixel structural similarity metrics as an educational prototype heuristic (not a certified biometric recognition engine).
- **Gate 5: Fraud Logger & ACID Decision Grant**: Breaches log forensics to `security_alerts`. Successful checks record attendance and update streaks inside an atomic database transaction with double-submission protection.

### 2. 🧠 Random Forest ML Defaulter Predictor & What-If Bunk Calculator
- **Trained Scikit-Learn Model** (`attendance_risk_model.pkl`): Evaluates behavioral attendance features:
  - `current_attendance_pct`
  - `last_14_days_pct` (momentum drift)
  - `mon_fri_skip_rate` (weekend extension patterns)
  - `first_lecture_miss_rate` (morning lecture absenteeism)
  - `current_streak` (consecutive attendance momentum)
- **Defaulter Radar**: Predicts student risk of dropping below 75% attendance by semester end with probabilistic severity (`CRITICAL`, `WARNING`, `NORMAL`).
- **Interactive What-If Bunk Calculator**: Dynamically computes exact lectures safe to skip while staying above 75%, or consecutive lectures required to recover.

### 3. 👥 Role-Based Portals (RBAC) with JWT & Bcrypt
- **Student Portal (Mobile-First PWA)**: Device identifier banner, Touch ID/Passkey simulation, live 5-gate animated checklist, Viva/Defense Testing Simulator (dev mode), and subject attendance analytics.
- **Faculty Portal (Desktop Console)**: Auto-rotating QR code generator with countdown, **1-Click Teacher Manual Attendance Override** (for dead phone/battery exceptions), live security feed, and Exception Approval Queue.
- **Admin Portal (System Governance)**: Institutional overview KPI cards, **Device Reset Manager** (for students who switch/reset browsers or devices), ML Defaulter Watchlist, and 1-click CSV report export.

### 4. 📱 Progressive Web App (PWA) & Offline Shell
- **Web App Manifest**: Installable on Android, iOS, and Desktop with custom theme colors (`#4f46e5`) and application icons.
- **Service Worker (`sw.js`)**: Shell caching, stale-while-revalidate for static assets, and safe network-first handling for API endpoints.

---

## 🛠️ Tech Stack

- **Backend**: Python 3.12, FastAPI, Uvicorn, SQLAlchemy 2.0, Alembic, Psycopg (v3), Bcrypt, PyJWT, Pydantic v2
- **Database**: Cloud PostgreSQL ([Neon.tech](https://neon.tech)) with connection pooling & SSL (with resilient local SQLite fallback)
- **Machine Learning & Vision**: Scikit-Learn (RandomForestClassifier), OpenCV, Pillow, Pandas, NumPy, Joblib
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, QRCode.react, Canvas Confetti

---

## ⚡ Quick Start Guide

### 1. Cloud Database Setup (Neon PostgreSQL)
1. Log in to [Neon Console](https://console.neon.tech/) and create a project (e.g. `smartattend-dev`).
2. Copy your **Pooled connection** URI (SQLAlchemy or PostgreSQL format):
   ```text
   postgresql://<username>:<password>@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require
   ```
3. Create `backend/.env` (copy from `backend/.env.example`) and configure:
   ```ini
   DATABASE_URL=postgresql://<username>:<password>@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require
   JWT_SECRET=your_super_secret_key_here
   ```
   *(If `DATABASE_URL` is omitted, the system operates seamlessly with a local SQLite fallback `smartattend_local.db`).*

### 2. Backend Setup
```bash
cd backend
python -m venv venv

# On Windows:
.\venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt

# Run migrations and seed data:
alembic upgrade head
python seed_postgres.py

# Launch development server:
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
*Backend runs on:* `http://localhost:8000`  
*Interactive Swagger API Docs:* `http://localhost:8000/docs`

### 3. Frontend Setup (PWA)
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs on:* `http://localhost:5173`

---

## 🧪 Testing & Verification

Run the test suites from the project root:

```bash
# 1. Test PostgreSQL connection & relational schema:
python backend/test_postgres_foundation.py

# 2. Test full API, RBAC, 5-gate anti-proxy, and admin endpoints:
python backend/test_endpoints.py
```

---

## 👥 Collaborative Workflow for Two Developers

1. **Shared Database**: Both developers connect to the **same Neon cloud database** using their local `backend/.env` files.
2. **Schema Migrations**:
   - Always create schema modifications via versioned Alembic revisions:
     ```bash
     alembic revision --autogenerate -m "describe_changes"
     ```
   - Commit the generated migration file in `backend/alembic/versions/`.
   - The other developer simply pulls the branch and executes:
     ```bash
     alembic upgrade head
     ```
3. **Environment & Secrets**:
   - Never commit `backend/.env` or credentials. `.gitignore` strictly protects `.env`, `*.db`, and `*.sqlite3` files.
   - Use `backend/.env.example` as the single reference template for team configuration.

---

## 🔑 Development Demo Credentials

> **Note**: Demo credentials are automatically seeded only when `ENVIRONMENT=development`. In production deployments, configure strong unique passwords and set a secure 32+ character `JWT_SECRET`.

| Role | Roll No / ID | Password | Profile Details |
| :--- | :--- | :--- | :--- |
| **Student** | `STU01` | `stu123` | Aarav Sharma (Safe Standing ~85.5% Att.) |
| **Student** | `STU02` | `stu123` | Priya Patel (Borderline 76.2% Att. \| ML Risk 99.8%) |
| **Student** | `STU03` | `stu123` | Rohan Verma (Chronic Defaulter 64.8% Att. \| ML Risk 100%) |
| **Faculty** | `FAC01` | `fac123` | Prof. Alan Turing (CSE Department) |
| **Admin** | `ADM01` | `admin123` | System Administrator (Full System Oversight) |

---

## 📄 License
MIT License &bull; Developed as an educational prototype for academic attendance exploration and verification workflow research.
