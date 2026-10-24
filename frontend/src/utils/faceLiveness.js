import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

let landmarkerInstance = null;
let landmarkerLoadingPromise = null;

// Eye landmark indices in MediaPipe 468/478 mesh:
// Left eye: 33 (outer corner), 133 (inner corner), 160, 158 (top eyelid), 144, 153 (bottom eyelid)
// Right eye: 362 (outer corner), 263 (inner corner), 385, 387 (top eyelid), 373, 380 (bottom eyelid)
const LEFT_EYE_LANDMARKS = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE_LANDMARKS = [362, 385, 387, 263, 373, 380];

/**
 * Calculates Eye Aspect Ratio (EAR) from 6 landmark points.
 * Standard formula: (|p2 - p6| + |p3 - p5|) / (2 * |p1 - p4|)
 */
function calculateEAR(landmarks, indices) {
  if (!landmarks) return 0.28;
  const p1 = landmarks[indices[0]];
  const p2 = landmarks[indices[1]];
  const p3 = landmarks[indices[2]];
  const p4 = landmarks[indices[3]];
  const p5 = landmarks[indices[4]];
  const p6 = landmarks[indices[5]];

  if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) return 0.28;

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const vertical1 = dist(p2, p6);
  const vertical2 = dist(p3, p5);
  const horizontal = dist(p1, p4);

  if (horizontal < 0.0001) return 0.28;
  return (vertical1 + vertical2) / (2.0 * horizontal);
}

/**
 * Initializes and caches the MediaPipe FaceLandmarker singleton.
 * Uses local static wasm & models, falling back to Google CDN if necessary.
 */
export async function getFaceLandmarker() {
  if (landmarkerInstance) return landmarkerInstance;
  if (landmarkerLoadingPromise) return landmarkerLoadingPromise;

  landmarkerLoadingPromise = (async () => {
    try {
      let filesetResolver;
      try {
        filesetResolver = await FilesetResolver.forVisionTasks('/wasm');
      } catch (localWasmErr) {
        console.warn('Local WASM load failed, trying CDN fallback:', localWasmErr);
        filesetResolver = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
      }

      let landmarker;
      try {
        landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: '/models/face_landmarker.task',
            delegate: 'GPU'
          },
          outputFaceBlendshapes: true,
          runningMode: 'VIDEO',
          numFaces: 2
        });
      } catch (localModelErr) {
        console.warn('Local model load failed, trying CDN fallback:', localModelErr);
        landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU'
          },
          outputFaceBlendshapes: true,
          runningMode: 'VIDEO',
          numFaces: 2
        });
      }

      landmarkerInstance = landmarker;
      return landmarker;
    } catch (err) {
      console.error('Failed to initialize FaceLandmarker:', err);
      throw err;
    } finally {
      landmarkerLoadingPromise = null;
    }
  })();

  return landmarkerLoadingPromise;
}

/**
 * Analyzes a single video frame for face presence, positioning, and eye blink status.
 *
 * @param {FaceLandmarker} landmarker
 * @param {HTMLVideoElement} videoElement
 * @param {number} timestampMs
 * @param {number} baselineEAR
 */
export function analyzeFaceFrame(landmarker, videoElement, timestampMs, baselineEAR = 0.28) {
  if (!landmarker || !videoElement || videoElement.readyState < 2) {
    return {
      success: false,
      status: 'VIDEO_NOT_READY',
      faceCount: 0,
      message: 'Camera stream initializing...'
    };
  }

  const results = landmarker.detectForVideo(videoElement, timestampMs);
  const faceCount = results.faceLandmarks ? results.faceLandmarks.length : 0;

  if (faceCount === 0) {
    return {
      success: true,
      faceCount: 0,
      status: 'NO_FACE',
      message: 'Looking for your face... Please position yourself in front of camera.',
      isCentered: false,
      isEyesClosed: false
    };
  }

  if (faceCount > 1) {
    return {
      success: true,
      faceCount,
      status: 'MULTIPLE_FACES',
      message: `Multiple faces detected (${faceCount}). Anti-proxy allows only 1 student.`,
      isCentered: false,
      isEyesClosed: false
    };
  }

  // Exactly one face detected
  const landmarks = results.faceLandmarks[0];

  // Calculate face bounding box & center from landmarks
  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  for (let i = 0; i < landmarks.length; i++) {
    const pt = landmarks[i];
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  const faceWidth = maxX - minX;
  const faceHeight = maxY - minY;
  const faceCenterX = (minX + maxX) / 2;
  const faceCenterY = (minY + maxY) / 2;

  // Flexible mobile-friendly center alignment check
  const isCentered = Math.abs(faceCenterX - 0.5) < 0.30 && Math.abs(faceCenterY - 0.5) < 0.32;
  const isTooSmall = faceWidth < 0.12 || faceHeight < 0.14;
  const isTooClose = faceWidth > 0.95 || faceHeight > 0.95;

  // Extract Eye Aspect Ratio
  const leftEAR = calculateEAR(landmarks, LEFT_EYE_LANDMARKS);
  const rightEAR = calculateEAR(landmarks, RIGHT_EYE_LANDMARKS);
  const avgEAR = (leftEAR + rightEAR) / 2;

  // Extract Blendshapes if available
  let blinkScoreLeft = 0;
  let blinkScoreRight = 0;
  if (results.faceBlendshapes && results.faceBlendshapes[0]) {
    const categories = results.faceBlendshapes[0].categories;
    for (let c of categories) {
      if (c.categoryName === 'eyeBlinkLeft') blinkScoreLeft = c.score;
      if (c.categoryName === 'eyeBlinkRight') blinkScoreRight = c.score;
    }
  }

  const avgBlinkScore = (blinkScoreLeft + blinkScoreRight) / 2;

  // Dynamic eye closure threshold (dual signal: blendshape OR relative EAR drop)
  const earThreshold = Math.min(0.22, baselineEAR * 0.75);
  const isEyesClosed = (avgBlinkScore > 0.35) || (avgEAR < earThreshold);

  // Position guidance
  let positionStatus = 'LOCKED';
  let message = 'Face detected! Blink your eyes once to auto-capture 😉';

  if (!isCentered) {
    positionStatus = 'OFF_CENTER';
    message = 'Please center your face inside the circular guide.';
  } else if (isTooSmall) {
    positionStatus = 'TOO_FAR';
    message = 'Move slightly closer to the camera.';
  } else if (isTooClose) {
    positionStatus = 'TOO_CLOSE';
    message = 'Move slightly back from the camera.';
  }

  return {
    success: true,
    faceCount: 1,
    status: positionStatus,
    message,
    isCentered: isCentered && !isTooSmall && !isTooClose,
    isEyesClosed,
    blinkScore: avgBlinkScore,
    ear: avgEAR,
    landmarks,
    faceBox: { minX, maxX, minY, maxY, width: faceWidth, height: faceHeight }
  };
}
