import os
import io
import cv2
import numpy as np
import hashlib
import base64
from typing import Optional, Tuple
from cryptography.fernet import Fernet

# ------------------------------------------------------------------------------
# Custom Face Quality Exception with distinct error codes
# ------------------------------------------------------------------------------
class FaceQualityError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message

# Global lazy singletons
_face_app = None
_fernet_cipher = None

def get_fernet() -> Fernet:
    """
    Returns Fernet cipher for encrypting face embeddings at rest.
    Guarantees reliable operation across local development, testing, and cloud deployments (e.g. Render):
    1. If FACE_EMBED_KEY is set and valid, uses it directly.
    2. If FACE_EMBED_KEY is a custom passphrase (32+ chars), deterministically derives a valid 32-byte Fernet key.
    3. If FACE_EMBED_KEY is missing, derives a stable key from JWT_SECRET if available.
    4. If neither is available, generates a valid Fernet key with a non-fatal warning so the server starts cleanly.
    """
    global _fernet_cipher
    if _fernet_cipher is None:
        key = os.getenv("FACE_EMBED_KEY", "").strip()
        jwt_secret = os.getenv("JWT_SECRET", "").strip()
        env = os.getenv("ENVIRONMENT", "").strip().lower()

        if key and len(key) >= 32:
            try:
                _fernet_cipher = Fernet(key.encode() if isinstance(key, str) else key)
            except Exception:
                # Key was provided but is a raw string/passphrase rather than urlsafe-b64: derive valid 32-byte key
                derived = base64.urlsafe_b64encode(hashlib.sha256(key.encode()).digest())
                _fernet_cipher = Fernet(derived)
        elif jwt_secret and len(jwt_secret) >= 16:
            # Deterministically derive from JWT_SECRET so restart persistence is maintained without requiring a separate env var
            derived = base64.urlsafe_b64encode(hashlib.sha256(f"smartattend_face_embed_salt:{jwt_secret}".encode()).digest())
            _fernet_cipher = Fernet(derived)
            print("[FaceService] FACE_EMBED_KEY not explicitly set; derived stable Fernet encryption key from JWT_SECRET.")
        else:
            # Ephemeral fallback for local testing or unconfigured dev environments
            _fernet_cipher = Fernet(Fernet.generate_key())
            if env != "testing":
                print("[FaceService WARNING] Neither FACE_EMBED_KEY nor JWT_SECRET is configured. Generated an ephemeral Fernet key. Set FACE_EMBED_KEY in production to persist encryption keys across restarts.")

    return _fernet_cipher

def encrypt_embedding(embedding: np.ndarray) -> bytes:
    """Encrypts float32 embedding vector at rest using Fernet."""
    cipher = get_fernet()
    raw_bytes = np.asarray(embedding, dtype=np.float32).tobytes()
    return cipher.encrypt(raw_bytes)

def decrypt_embedding(encrypted_bytes: bytes) -> np.ndarray:
    """Decrypts Fernet ciphertext back to normalized float32 embedding vector."""
    cipher = get_fernet()
    decrypted_bytes = cipher.decrypt(encrypted_bytes)
    return np.frombuffer(decrypted_bytes, dtype=np.float32)

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
      - 'FACE_TOO_SMALL': Face bounding box min dimension < 80px.
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
    min_blur = float(os.getenv("FACE_MIN_BLUR_SCORE", "40.0"))
    if blur_score < min_blur:
        raise FaceQualityError(
            "FACE_IMAGE_BLURRY",
            f"Image is too blurry (sharpness score {blur_score:.1f} < {min_blur:.1f}). Please hold the phone steady."
        )

    # 2. Face Detection & Feature Extraction
    app = get_face_app()
    faces = app.get(img)

    if len(faces) == 0:
        raise FaceQualityError("NO_FACE", "No face detected in the image. Please position your face inside the circle.")

    if len(faces) > 1:
        raise FaceQualityError(
            "MULTIPLE_FACES",
            f"Multiple faces detected ({len(faces)}). Anti-proxy security requires exactly one student in the frame."
        )

    face = faces[0]

    # 3. Detection Confidence Score Check
    min_det_score = float(os.getenv("FACE_MIN_DET_SCORE", "0.60"))
    det_score = float(getattr(face, "det_score", 0.0))
    if det_score < min_det_score:
        raise FaceQualityError(
            "LOW_DETECTION_CONFIDENCE",
            f"Face detection confidence ({det_score:.2f}) is below minimum threshold ({min_det_score:.2f}). Ensure adequate lighting."
        )

    # 4. Face Bounding Box Resolution Check (min 80px)
    bbox = getattr(face, "bbox", None)
    if bbox is not None and len(bbox) >= 4:
        w = float(bbox[2] - bbox[0])
        h = float(bbox[3] - bbox[1])
        min_dim = min(w, h)
        if min_dim < 80.0:
            raise FaceQualityError(
                "FACE_TOO_SMALL",
                f"Face image is too small ({int(min_dim)}px < 80px). Please move the camera closer to your face."
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
    norm = np.linalg.norm(normed)
    if norm > 0:
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
