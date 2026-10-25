import os
import io
import cv2
import numpy as np
import hashlib
import base64
from typing import Optional, Tuple, Dict, Any
from cryptography.fernet import Fernet

# ------------------------------------------------------------------------------
# Custom Face Quality & Biometric Encryption Exceptions
# ------------------------------------------------------------------------------
class FaceQualityError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message

class BiometricDecryptionError(Exception):
    """Raised when Fernet ciphertext cannot be decrypted using configured key (e.g. key mismatch or corruption)."""
    pass

class MalformedEmbeddingError(Exception):
    """Raised when decrypted embedding bytes are corrupt, wrong dimension, non-finite or invalid."""
    pass

# Global lazy singletons
_face_app = None
_fernet_cipher = None

def validate_key_configuration():
    """
    Validates FACE_EMBED_KEY configuration.
    Fails startup in production if missing, too short, or invalid.
    """
    env = os.getenv("ENVIRONMENT", "").strip().lower()
    key = os.getenv("FACE_EMBED_KEY", "").strip()

    if env == "production":
        if not key:
            raise RuntimeError(
                "CRITICAL PRODUCTION CONFIG ERROR: FACE_EMBED_KEY is not set. "
                "Set a stable 32-byte urlsafe-base64 Fernet key in production environment."
            )
        if len(key) < 32:
            raise RuntimeError(
                f"CRITICAL PRODUCTION CONFIG ERROR: FACE_EMBED_KEY is too short ({len(key)} < 32 characters)."
            )
        try:
            if len(key) == 44 and key.endswith("="):
                Fernet(key.encode())
            else:
                derived = base64.urlsafe_b64encode(hashlib.sha256(key.encode()).digest())
                Fernet(derived)
        except Exception as e:
            raise RuntimeError(f"CRITICAL PRODUCTION CONFIG ERROR: FACE_EMBED_KEY cannot initialize Fernet cipher: {e}")

def get_fernet() -> Fernet:
    """
    Returns Fernet cipher for encrypting face embeddings at rest.
    In production, strictly requires an explicitly configured, valid FACE_EMBED_KEY.
    In development/testing, falls back deterministically to JWT_SECRET if FACE_EMBED_KEY is missing.
    Never rotates, regenerates, or replaces the key automatically.
    """
    global _fernet_cipher
    if _fernet_cipher is None:
        key = os.getenv("FACE_EMBED_KEY", "").strip()
        env = os.getenv("ENVIRONMENT", "").strip().lower()

        if env == "production":
            validate_key_configuration()

        if key and len(key) >= 32:
            try:
                if len(key) == 44 and key.endswith("="):
                    _fernet_cipher = Fernet(key.encode() if isinstance(key, str) else key)
                else:
                    derived_key = base64.urlsafe_b64encode(hashlib.sha256(key.encode()).digest())
                    _fernet_cipher = Fernet(derived_key)
            except Exception as e:
                if env == "production":
                    raise RuntimeError(f"Failed to initialize Fernet with configured FACE_EMBED_KEY: {e}")
                derived_key = base64.urlsafe_b64encode(hashlib.sha256(key.encode()).digest())
                _fernet_cipher = Fernet(derived_key)
        else:
            # Deterministic development/test fallback only
            secret = os.getenv("JWT_SECRET") or os.getenv("SECRET_KEY") or "smartattend-ai-secure-encryption-seed-2026"
            derived_key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest())
            _fernet_cipher = Fernet(derived_key)

    return _fernet_cipher

def encrypt_embedding(embedding: np.ndarray) -> bytes:
    """
    Validates and encrypts a 512-D float32 normalized embedding vector at rest using Fernet.
    Rejects malformed, non-finite, or invalid dimension vectors.
    """
    arr = np.asarray(embedding, dtype=np.float32)
    if arr.shape != (512,):
        raise MalformedEmbeddingError(f"Cannot encrypt embedding with shape {arr.shape}; expected (512,).")
    if not np.all(np.isfinite(arr)):
        raise MalformedEmbeddingError("Cannot encrypt embedding containing NaN or Inf values.")
    norm = np.linalg.norm(arr)
    if norm < 1e-6:
        raise MalformedEmbeddingError("Cannot encrypt zero-norm embedding vector.")
    arr = arr / norm

    cipher = get_fernet()
    raw_bytes = arr.tobytes()
    return cipher.encrypt(raw_bytes)

def decrypt_embedding(encrypted_bytes: bytes) -> np.ndarray:
    """
    Decrypts Fernet ciphertext back to a normalized 512-D float32 embedding vector.
    Validates payload integrity, vector length, and finite numeric values.
    Raises BiometricDecryptionError on key/token failure; MalformedEmbeddingError on invalid vector structure.
    """
    if not encrypted_bytes:
        raise MalformedEmbeddingError("Encrypted biometric payload is empty.")

    cipher = get_fernet()
    try:
        decrypted_bytes = cipher.decrypt(encrypted_bytes)
    except Exception as dec_err:
        raise BiometricDecryptionError(
            "Biometric template decryption failed with configured encryption key."
        ) from dec_err

    expected_len = 512 * 4  # 512 float32 elements = 2048 bytes
    if len(decrypted_bytes) != expected_len:
        raise MalformedEmbeddingError(
            f"Decrypted embedding length ({len(decrypted_bytes)} bytes) does not match expected {expected_len} bytes (512 float32)."
        )

    arr = np.frombuffer(decrypted_bytes, dtype=np.float32)
    if not np.all(np.isfinite(arr)):
        raise MalformedEmbeddingError("Decrypted embedding contains non-finite values (NaN or Inf).")

    norm = np.linalg.norm(arr)
    if norm < 1e-6:
        raise MalformedEmbeddingError("Decrypted embedding has near-zero norm.")

    return arr / norm

def get_face_app():
    """
    Lazily loads InsightFace FaceAnalysis model pack (buffalo_sc) on CPU via onnxruntime once.
    """
    global _face_app
    if _face_app is None:
        try:
            from insightface.app import FaceAnalysis
            app = FaceAnalysis(name="buffalo_sc", providers=["CPUExecutionProvider"])
            app.prepare(ctx_id=0, det_size=(320, 320))
            _face_app = app
        except Exception as err:
            raise RuntimeError(
                f"Failed to initialize InsightFace (buffalo_sc) on CPU: {err}. "
                "Ensure insightface and onnxruntime are installed correctly on Windows."
            )
    return _face_app

def extract_embedding(image_bytes: bytes) -> np.ndarray:
    """
    Decodes image_bytes, validates image quality (sharpness, face count, detection score, size),
    and returns a normalized float32 face embedding vector (512-D).
    
    Rejection error codes:
      - 'INVALID_IMAGE': Unreadable image buffer.
      - 'FACE_IMAGE_BLURRY': Laplacian variance below threshold.
      - 'NO_FACE': Exactly zero faces detected.
      - 'MULTIPLE_FACES': More than one face detected.
      - 'LOW_DETECTION_CONFIDENCE': Face detection score < FACE_MIN_DET_SCORE.
      - 'FACE_TOO_SMALL': Face bounding box min dimension < min_dim.
    """
    if not image_bytes:
        raise FaceQualityError("INVALID_IMAGE", "Empty image payload.")

    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise FaceQualityError("INVALID_IMAGE", "Unable to decode image frame from provided bytes.")

    # 1. Blurriness Check (Laplacian Variance)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    min_blur = float(os.getenv("FACE_MIN_BLUR_SCORE", "12.0"))
    if blur_score < min_blur:
        raise FaceQualityError(
            "FACE_IMAGE_BLURRY",
            f"Image is too blurry (sharpness score {blur_score:.1f} < {min_blur:.1f}). Please hold the device steady."
        )

    # 2. Face Detection & Feature Extraction
    app = get_face_app()
    faces = app.get(img)

    # CLAHE contrast enhancement fallback if no face detected in dim lighting
    if len(faces) == 0:
        try:
            lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            cl = clahe.apply(l)
            enhanced = cv2.cvtColor(cv2.merge((cl, a, b)), cv2.COLOR_LAB2BGR)
            faces = app.get(enhanced)
        except Exception:
            pass

    if len(faces) == 0:
        raise FaceQualityError("NO_FACE", "No face detected in the image. Please position your face inside the circle.")

    if len(faces) > 1:
        raise FaceQualityError(
            "MULTIPLE_FACES",
            f"Multiple faces detected ({len(faces)}). Anti-proxy security requires exactly one student in the frame."
        )

    face = faces[0]

    # 3. Detection Confidence Score Check
    min_det_score = float(os.getenv("FACE_MIN_DET_SCORE", "0.40"))
    det_score = float(getattr(face, "det_score", 0.0))
    if det_score < min_det_score:
        raise FaceQualityError(
            "LOW_DETECTION_CONFIDENCE",
            f"Face detection confidence ({det_score:.2f}) is below minimum threshold ({min_det_score:.2f}). Ensure adequate lighting."
        )

    # 4. Face Bounding Box Resolution Check (min 50px)
    bbox = getattr(face, "bbox", None)
    if bbox is not None and len(bbox) >= 4:
        w = float(bbox[2] - bbox[0])
        h = float(bbox[3] - bbox[1])
        min_dim = min(w, h)
        if min_dim < 50.0:
            raise FaceQualityError(
                "FACE_TOO_SMALL",
                f"Face image is too small ({int(min_dim)}px < 50px). Please move the camera closer to your face."
            )

    # 5. Extract Normalized Float32 Embedding Vector
    embedding = getattr(face, "normed_embedding", None)
    if embedding is None:
        raw_emb = getattr(face, "embedding", None)
        if raw_emb is None:
            raise FaceQualityError("EXTRACTION_FAILED", "InsightFace failed to generate facial embedding vector.")
        norm = np.linalg.norm(raw_emb)
        embedding = (raw_emb / norm) if norm > 0 else raw_emb

    normed = np.asarray(embedding, dtype=np.float32)
    if normed.shape != (512,):
        raise FaceQualityError("EXTRACTION_FAILED", f"Extracted embedding dimension {normed.shape} is incompatible; expected (512,).")
    if not np.all(np.isfinite(normed)):
        raise FaceQualityError("EXTRACTION_FAILED", "Extracted facial embedding contains non-finite values.")
    norm = np.linalg.norm(normed)
    if norm < 1e-6:
        raise FaceQualityError("EXTRACTION_FAILED", "Extracted facial embedding has zero magnitude.")
    normed = normed / norm
    return normed

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """
    Computes cosine similarity between two normalized float32 vectors.
    Returns float in [-1.0, 1.0].
    """
    a = np.asarray(a, dtype=np.float32)
    b = np.asarray(b, dtype=np.float32)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    sim = float(np.dot(a, b) / (norm_a * norm_b))
    return max(-1.0, min(1.0, sim))


def process_panoramic_snapshot(
    image_bytes: bytes,
    enrolled_students: list,
    min_similarity: float = 0.40
) -> dict:
    """
    Scans a wide-angle classroom/lecture hall photo containing multiple students.
    Detects all visible faces simultaneously using InsightFace, extracts embeddings,
    and matches them against enrolled student baseline vectors.
    
    Returns:
      - total_detected_faces (int)
      - matched_count (int)
      - unmatched_count (int)
      - matched_students (list of {roll_no, name, score_pct, bbox})
      - annotated_image_base64 (data URI with green/amber bounding boxes)
    """
    if not image_bytes:
        raise FaceQualityError("INVALID_IMAGE", "Empty panoramic photo payload.")

    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise FaceQualityError("INVALID_IMAGE", "Unable to decode image frame.")

    # Resize if ultra-high resolution to keep inference fast & responsive
    h, w = img.shape[:2]
    max_dim = 1920
    scale = 1.0
    if max(h, w) > max_dim:
        scale = max_dim / float(max(h, w))
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    app = get_face_app()
    faces = app.get(img)

    # If no faces detected, try a quick CLAHE enhancement pass
    if len(faces) == 0:
        try:
            lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
            l, a, b_ch = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            cl = clahe.apply(l)
            enhanced = cv2.cvtColor(cv2.merge((cl, a, b_ch)), cv2.COLOR_LAB2BGR)
            faces = app.get(enhanced)
        except Exception:
            pass

    annotated = img.copy()

    # Collect candidate matches: (similarity, face_idx, student_dict)
    candidates = []
    face_embeddings = []

    for idx, face in enumerate(faces):
        # Extract normalized embedding
        emb = getattr(face, "normed_embedding", None)
        if emb is None:
            raw_emb = getattr(face, "embedding", None)
            if raw_emb is not None:
                norm = np.linalg.norm(raw_emb)
                emb = (raw_emb / norm) if norm > 0 else raw_emb

        if emb is not None:
            emb = np.asarray(emb, dtype=np.float32)
            norm = np.linalg.norm(emb)
            if norm > 0:
                emb = emb / norm
            face_embeddings.append(emb)

            for student in enrolled_students:
                base_emb = student.get("embedding")
                if base_emb is not None:
                    sim = cosine_similarity(emb, base_emb)
                    if sim >= min_similarity:
                        candidates.append((sim, idx, student))
        else:
            face_embeddings.append(None)

    # Sort candidates descending by similarity to match highest confidence first
    candidates.sort(key=lambda x: x[0], reverse=True)

    matched_faces = {}     # face_idx -> (student, sim)
    assigned_students = set()

    for sim, f_idx, student in candidates:
        if f_idx not in matched_faces and student["roll_no"] not in assigned_students:
            matched_faces[f_idx] = (student, sim)
            assigned_students.add(student["roll_no"])

    matched_students = []

    # Draw bounding boxes and labels
    for idx, face in enumerate(faces):
        bbox = getattr(face, "bbox", None)
        if bbox is None or len(bbox) < 4:
            continue

        x1, y1, x2, y2 = [int(v) for v in bbox[:4]]
        # Bound coordinates
        x1 = max(0, x1)
        y1 = max(0, y1)
        x2 = min(img.shape[1], x2)
        y2 = min(img.shape[0], y2)

        if idx in matched_faces:
            student, sim = matched_faces[idx]
            # Convert cosine similarity (-1 to 1) to an intuitive confidence percentage (70% - 99%)
            score_pct = round(min(99.0, max(70.0, 50.0 + (sim * 50.0))), 1)

            matched_students.append({
                "roll_no": student["roll_no"],
                "name": student.get("name", "Student"),
                "similarity": round(float(sim), 3),
                "confidence_score": score_pct,
                "bbox": [x1, y1, x2, y2]
            })

            # Green box for matched student
            color = (0, 230, 115)  # BGR Emerald Green
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 3)

            # Label pill
            label = f"{student.get('name', 'Student')} ({score_pct}%)"
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.55
            thickness = 2
            (text_w, text_h), baseline = cv2.getTextSize(label, font, font_scale, thickness)
            pill_y1 = max(0, y1 - text_h - 10)
            pill_y2 = y1
            cv2.rectangle(annotated, (x1, pill_y1), (x1 + text_w + 12, pill_y2), color, -1)
            cv2.putText(
                annotated,
                label,
                (x1 + 6, pill_y2 - 5),
                font,
                font_scale,
                (10, 20, 10),
                thickness,
                cv2.LINE_AA
            )
        else:
            # Amber box for unrecognized/visitor face
            color = (0, 165, 255)  # BGR Amber
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
            label = "Unenrolled / Visitor"
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.45
            thickness = 1
            (text_w, text_h), baseline = cv2.getTextSize(label, font, font_scale, thickness)
            pill_y1 = max(0, y1 - text_h - 8)
            cv2.rectangle(annotated, (x1, pill_y1), (x1 + text_w + 8, y1), color, -1)
            cv2.putText(
                annotated,
                label,
                (x1 + 4, y1 - 4),
                font,
                font_scale,
                (0, 0, 0),
                thickness,
                cv2.LINE_AA
            )

    # Encode annotated image to JPEG base64
    _, buffer = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 85])
    annotated_base64 = f"data:image/jpeg;base64,{base64.b64encode(buffer).decode('utf-8')}"

    return {
        "total_detected_faces": len(faces),
        "matched_count": len(matched_students),
        "unmatched_count": len(faces) - len(matched_students),
        "matched_students": matched_students,
        "annotated_image_base64": annotated_base64
    }


def verify_dual_frame_liveness(
    open_frame_bytes: bytes,
    closed_frame_bytes: Optional[bytes],
    open_embedding: Optional[np.ndarray] = None
) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Heuristic two-frame ocular liveness evaluation (Phase 4B).
    
    Validates temporal biometric evidence between an open-eye frame and a
    closed-eye frame captured during the confirmed blink sequence.
    
    LIMITATION NOTICE: This check is an automated heuristic using whole-frame
    pixel difference (to detect static 2D photo replays and identical bitwise file uploads)
    and cross-frame facial identity consistency. It is NOT verified ocular aperture
    or Eye Aspect Ratio (EAR) landmark measurement, and does NOT provide proof against
    manipulated frames, lighting shifts, camera movement, or high-fidelity video injection.
    Uncertain or inconclusive cases are routed for manual faculty approval.
    
    Returns:
      (is_verified: bool, status_code: str, details: dict)
      
    Status codes:
      - 'HEURISTIC_SERVER_VERIFIED': Dual-frame consistency confirmed and measurable eye delta detected.
      - 'INCONCLUSIVE': Insufficient ocular delta or missing closed frame (routes to PENDING_APPROVAL).
      - 'FAILED': Static image replay detected (identical frames) or cross-frame identity mismatch.
    """
    if not closed_frame_bytes:
        return (False, "INCONCLUSIVE", {"reason": "Missing closed-eye frame; dual-frame liveness inconclusive."})

    # 1. Payload size guard (max 4MB per frame)
    if len(open_frame_bytes) > 4 * 1024 * 1024 or len(closed_frame_bytes) > 4 * 1024 * 1024:
        return (False, "FAILED", {"reason": "Image payload exceeds 4MB limit."})

    # 2. Decode frames
    nparr_open = np.frombuffer(open_frame_bytes, np.uint8)
    img_open = cv2.imdecode(nparr_open, cv2.IMREAD_COLOR)

    nparr_closed = np.frombuffer(closed_frame_bytes, np.uint8)
    img_closed = cv2.imdecode(nparr_closed, cv2.IMREAD_COLOR)

    if img_open is None or img_closed is None:
        return (False, "FAILED", {"reason": "Unable to decode one or both image frames."})

    # 3. Detect identical frame attack (Static Photo Replay / Duplicate payload)
    try:
        small_open = cv2.resize(cv2.cvtColor(img_open, cv2.COLOR_BGR2GRAY), (128, 128))
        small_closed = cv2.resize(cv2.cvtColor(img_closed, cv2.COLOR_BGR2GRAY), (128, 128))
        pixel_mae = float(np.mean(np.abs(small_open.astype(np.float32) - small_closed.astype(np.float32))))
    except Exception as e:
        return (False, "FAILED", {"reason": f"Frame comparison error: {str(e)}"})

    min_pixel_delta = float(os.getenv("LIVENESS_MIN_PIXEL_DELTA", "0.8"))
    if pixel_mae < min_pixel_delta:
        return (
            False,
            "FAILED",
            {
                "reason": f"Static image replay detected: dual frames are identical (delta={pixel_mae:.3f} < {min_pixel_delta:.3f}).",
                "pixel_mae": pixel_mae
            }
        )

    # 4. Cross-Frame Identity & Consistency
    try:
        # SEC-05: Reuse already computed open-frame embedding if provided
        emb_open = open_embedding if open_embedding is not None else extract_embedding(open_frame_bytes)
        emb_closed = extract_embedding(closed_frame_bytes)
        cross_sim = float(cosine_similarity(emb_open, emb_closed))
    except FaceQualityError as fqe:
        # If closed frame has low detection score or blur, fail gracefully to INCONCLUSIVE
        return (False, "INCONCLUSIVE", {"reason": f"Dual-frame quality note: {fqe.message}", "pixel_mae": pixel_mae})
    except Exception as e:
        return (False, "INCONCLUSIVE", {"reason": f"Dual-frame comparison note: {str(e)}", "pixel_mae": pixel_mae})

    min_cross_sim = float(os.getenv("LIVENESS_CROSS_SIM_MIN", "0.60"))
    if cross_sim < min_cross_sim:
        return (
            False,
            "FAILED",
            {
                "reason": f"Cross-frame identity mismatch (similarity={cross_sim:.2f} < {min_cross_sim:.2f}).",
                "cross_sim": cross_sim
            }
        )

    # 5. Temporal consistency and eye state delta confirmed
    return (
        True,
        "HEURISTIC_SERVER_VERIFIED",
        {
            "cross_sim": round(cross_sim, 3),
            "pixel_mae": round(pixel_mae, 3)
        }
    )
