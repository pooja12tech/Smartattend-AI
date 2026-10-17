import os
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score, roc_auc_score
import joblib

def generate_synthetic_data(n_samples: int = 1000, random_seed: int = 42) -> pd.DataFrame:
    """
    Generate realistic synthetic student attendance and behavioral dataset.
    Features:
      - current_attendance_pct: Overall attendance % till date (40% to 98%)
      - last_14_days_pct: Recent 14 days attendance % (shows momentum/trend)
      - mon_fri_skip_rate: Fraction of Monday & Friday classes skipped (proxy for weekend-extension slacking)
      - first_lecture_miss_rate: Fraction of morning/first-slot lectures missed (proxy for morning lethargy)
      - current_streak: Consecutive lectures attended (+) or missed (-) (-10 to 15)
    """
    np.random.seed(random_seed)

    # 1. Base overall attendance % (Gaussian mixture to mimic real university distribution)
    # Most students (70%) cluster between 72%-92%, 20% high achievers (90%-99%), 10% chronic defaulters (45%-70%)
    cluster_choice = np.random.choice([0, 1, 2], size=n_samples, p=[0.20, 0.65, 0.15])
    current_att = np.zeros(n_samples)
    current_att[cluster_choice == 0] = np.random.normal(92, 4, size=np.sum(cluster_choice == 0))
    current_att[cluster_choice == 1] = np.random.normal(78, 6, size=np.sum(cluster_choice == 1))
    current_att[cluster_choice == 2] = np.random.normal(58, 8, size=np.sum(cluster_choice == 2))
    current_attendance_pct = np.clip(np.round(current_att, 1), 35.0, 99.0)

    # 2. Last 14 days attendance % (correlated with current, with positive/negative drift)
    trend_drift = np.random.normal(-1.5, 9.0, size=n_samples)
    last_14_days_pct = np.clip(np.round(current_attendance_pct + trend_drift, 1), 10.0, 100.0)

    # 3. Monday/Friday skip rate (higher for lower attendance students)
    base_skip = (100.0 - current_attendance_pct) / 100.0
    mon_fri_skip_rate = np.clip(np.round(base_skip * 0.8 + np.random.beta(2, 5, size=n_samples) * 0.4, 2), 0.0, 0.95)

    # 4. First lecture miss rate (morning classes proxy)
    first_lecture_miss_rate = np.clip(np.round(base_skip * 0.75 + np.random.beta(2, 4, size=n_samples) * 0.45, 2), 0.0, 0.95)

    # 5. Current streak (negative for consecutive misses, positive for attendances)
    streak = np.zeros(n_samples, dtype=int)
    for i in range(n_samples):
        att = last_14_days_pct[i]
        if att >= 85:
            streak[i] = int(np.random.geometric(0.2) + 2)  # Typically +3 to +12
        elif att >= 70:
            streak[i] = int(np.random.choice([-2, -1, 0, 1, 2, 3, 4]))
        else:
            streak[i] = -int(np.random.geometric(0.3))     # Typically -1 to -6
    current_streak = np.clip(streak, -10, 15)

    # Behavioral risk formula for target `will_be_defaulter`
    # Defaulter threshold in colleges is strictly < 75% attendance by end of semester.
    # Risk factors:
    # - Low current attendance has highest weight
    # - Negative recent momentum (last_14_days_pct < 75%)
    # - Habitual Mon/Fri skipping and morning skipping
    # - Negative streak (currently missing classes)
    risk_score = (
        (76.0 - current_attendance_pct) * 0.45
        + (75.0 - last_14_days_pct) * 0.35
        + (mon_fri_skip_rate * 100.0 - 25.0) * 0.15
        + (first_lecture_miss_rate * 100.0 - 20.0) * 0.12
        - (current_streak * 1.8)
        + np.random.normal(0, 3.2, size=n_samples)  # Real-world stochastic variation
    )

    will_be_defaulter = (risk_score > 0).astype(int)

    df = pd.DataFrame({
        "current_attendance_pct": current_attendance_pct,
        "last_14_days_pct": last_14_days_pct,
        "mon_fri_skip_rate": mon_fri_skip_rate,
        "first_lecture_miss_rate": first_lecture_miss_rate,
        "current_streak": current_streak,
        "will_be_defaulter": will_be_defaulter
    })
    return df

def train_and_export_model():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    dataset_path = os.path.join(base_dir, "student_risk_dataset.csv")
    model_path = os.path.join(base_dir, "attendance_risk_model.pkl")

    print("[ML] Generating synthetic dataset of 1,000 students...")
    df = generate_synthetic_data(n_samples=1000, random_seed=42)
    df.to_csv(dataset_path, index=False)
    print(f"[ML] Dataset saved successfully to: {dataset_path}")

    defaulter_count = df["will_be_defaulter"].sum()
    print(f"[ML] Class distribution: Defaulter Risk = {defaulter_count} ({defaulter_count / len(df) * 100:.1f}%), Safe = {len(df) - defaulter_count}")

    feature_cols = [
        "current_attendance_pct",
        "last_14_days_pct",
        "mon_fri_skip_rate",
        "first_lecture_miss_rate",
        "current_streak"
    ]
    target_col = "will_be_defaulter"

    X = df[feature_cols]
    y = df[target_col]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print("[ML] Training RandomForestClassifier (n_estimators=100, max_depth=6)...")
    clf = RandomForestClassifier(
        n_estimators=100,
        max_depth=6,
        min_samples_split=4,
        min_samples_leaf=2,
        random_state=42
    )
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)
    y_prob = clf.predict_proba(X_test)[:, 1]

    acc = accuracy_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_prob)

    print(f"\n[ML] Model Performance on Test Set:")
    print(f"Accuracy: {acc * 100:.2f}%")
    print(f"ROC-AUC Score: {auc:.4f}")
    print("\nClassification Report:\n", classification_report(y_test, y_pred, target_names=["Safe (0)", "Defaulter Risk (1)"]))

    print("[ML] Feature Importances:")
    importances = sorted(zip(feature_cols, clf.feature_importances_), key=lambda x: x[1], reverse=True)
    for feat, imp in importances:
        print(f"  - {feat:25s}: {imp * 100:.2f}%")

    # Save model artifact with metadata
    model_payload = {
        "model": clf,
        "feature_names": feature_cols,
        "accuracy": acc,
        "roc_auc": auc
    }
    joblib.dump(model_payload, model_path)
    print(f"\n[ML] Model successfully serialized to: {model_path}")

if __name__ == "__main__":
    train_and_export_model()
