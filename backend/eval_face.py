import os
import sys
import glob
import csv
import argparse
from typing import List, Tuple, Dict
import numpy as np

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from face_service import extract_embedding, cosine_similarity, FaceQualityError

def evaluate_dataset(dataset_dir: str, output_csv: str):
    """
    Evaluates real facial dataset of consenting subjects.
    Directory structure expected: dataset/<person_id>/*.jpg (or .png/.jpeg)
    
    Computes genuine vs impostor score distributions and performs
    a threshold sweep to calculate FMR (False Match Rate) and FNMR (False Non-Match Rate).
    Results are written directly to CSV without inventing any synthetic values.
    """
    if not os.path.exists(dataset_dir):
        print(f"[eval_face] Dataset directory '{dataset_dir}' not found.")
        print("Usage instructions:")
        print("  1. Create folder: dataset/<person_id>/")
        print("  2. Place real consenting subject photos: dataset/<person_id>/photo1.jpg, photo2.jpg...")
        print(f"  3. Re-run: python eval_face.py --dataset {dataset_dir} --output {output_csv}")
        return

    # Find person subfolders
    person_dirs = [
        d for d in os.listdir(dataset_dir)
        if os.path.isdir(os.path.join(dataset_dir, d))
    ]

    if not person_dirs:
        print(f"[eval_face] No person subdirectories found in '{dataset_dir}'.")
        print("Expected structure: dataset/<person_id>/*.jpg")
        return

    print(f"[eval_face] Found {len(person_dirs)} person folders in '{dataset_dir}'. Extracting embeddings...")

    # Load and extract embeddings
    embeddings: List[Tuple[str, str, np.ndarray]] = []
    skipped_images = 0

    valid_extensions = ("*.jpg", "*.jpeg", "*.png", "*.JPG", "*.JPEG", "*.PNG")

    for pid in person_dirs:
        p_path = os.path.join(dataset_dir, pid)
        img_files = []
        for ext in valid_extensions:
            img_files.extend(glob.glob(os.path.join(p_path, ext)))

        for img_path in img_files:
            try:
                with open(img_path, "rb") as f:
                    img_bytes = f.read()
                emb = extract_embedding(img_bytes)
                embeddings.append((pid, os.path.basename(img_path), emb))
            except FaceQualityError as fqe:
                print(f"  [Skipped] {pid}/{os.path.basename(img_path)}: {fqe.code} ({fqe.message})")
                skipped_images += 1
            except Exception as err:
                print(f"  [Error] {pid}/{os.path.basename(img_path)}: {err}")
                skipped_images += 1

    print(f"[eval_face] Successfully extracted {len(embeddings)} face embeddings ({skipped_images} skipped).")

    if len(embeddings) < 2:
        print("[eval_face] Not enough valid face embeddings to compute comparisons. Need at least 2 images.")
        return

    # Pairwise comparison
    genuine_scores = []
    impostor_scores = []

    n = len(embeddings)
    for i in range(n):
        pid_i, name_i, emb_i = embeddings[i]
        for j in range(i + 1, n):
            pid_j, name_j, emb_j = embeddings[j]
            sim = cosine_similarity(emb_i, emb_j)
            if pid_i == pid_j:
                genuine_scores.append(sim)
            else:
                impostor_scores.append(sim)

    print(f"[eval_face] Generated {len(genuine_scores)} genuine pairs and {len(impostor_scores)} impostor pairs.")

    if not genuine_scores or not impostor_scores:
        print("[eval_face] Evaluation requires both genuine pairs (same person multiple photos) and impostor pairs (different persons).")
        return

    # Genuine distribution stats
    gen_arr = np.array(genuine_scores)
    imp_arr = np.array(impostor_scores)

    print("\n--- Score Distribution Statistics ---")
    print(f"Genuine Pairs ({len(gen_arr)}): Mean = {gen_arr.mean():.4f}, Std = {gen_arr.std():.4f}, Min = {gen_arr.min():.4f}, Max = {gen_arr.max():.4f}")
    print(f"Impostor Pairs ({len(imp_arr)}): Mean = {imp_arr.mean():.4f}, Std = {imp_arr.std():.4f}, Min = {imp_arr.min():.4f}, Max = {imp_arr.max():.4f}")

    # Threshold sweep (0.00 to 1.00, step 0.01)
    thresholds = np.linspace(0.0, 1.0, 101)
    results = []
    best_eer_diff = float("inf")
    eer_threshold = 0.5
    eer_val = 0.0

    for t in thresholds:
        t_val = round(float(t), 2)
        # FMR (False Match Rate): Impostors with score >= threshold
        fmr = float(np.sum(imp_arr >= t_val)) / len(imp_arr)
        # FNMR (False Non-Match Rate): Genuine with score < threshold
        fnmr = float(np.sum(gen_arr < t_val)) / len(gen_arr)

        results.append({
            "threshold": t_val,
            "fmr": round(fmr, 5),
            "fnmr": round(fnmr, 5),
            "genuine_count": len(gen_arr),
            "impostor_count": len(imp_arr)
        })

        diff = abs(fmr - fnmr)
        if diff < best_eer_diff:
            best_eer_diff = diff
            eer_threshold = t_val
            eer_val = (fmr + fnmr) / 2.0

    print(f"\n--- Operating Threshold Analysis ---")
    print(f"Approximate Equal Error Rate (EER): {eer_val * 100:.2f}% at Threshold = {eer_threshold:.2f}")

    # Write to CSV
    with open(output_csv, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["threshold", "fmr", "fnmr", "genuine_count", "impostor_count"])
        writer.writeheader()
        writer.writerows(results)

    print(f"[eval_face] Results successfully exported to '{output_csv}'.\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate InsightFace Embedding Quality on Real Consenting Dataset")
    parser.add_argument("--dataset", default="dataset", help="Path to dataset directory containing person subdirectories")
    parser.add_argument("--output", default="eval_face_results.csv", help="Path for output evaluation CSV")
    args = parser.parse_args()

    evaluate_dataset(args.dataset, args.output)
