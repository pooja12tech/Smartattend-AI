import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

let landmarkerInstance = null;
let landmarkerLoadingPromise = null;

// Eye landmark indices in MediaPipe 468/478 mesh:
// Left eye: 33 (outer corner), 133 (inner corner), 160, 158 (top eyelid), 144, 153 (bottom eyelid)
// Right eye: 362 (outer corner), 263 (inner corner), 385, 387 (top eyelid), 373, 380 (bottom eyelid)
const LEFT_EYE_LANDMARKS = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE_LANDMARKS = [362, 385, 387, 263, 373, 380];

/**
 * Calculates Eye Aspect Ratio (EAR) from 6 landmark points in pixel space.
 * Corrects for video aspect ratio using actual video resolution.
 * Standard formula: (|p2 - p6| + |p3 - p5|) / (2 * |p1 - p4|)
 */
export function calculateEAR(landmarks, indices, width = 1, height = 1) {
  if (!landmarks) return 0.28;
  const p1 = landmarks[indices[0]];
  const p2 = landmarks[indices[1]];
  const p3 = landmarks[indices[2]];
  const p4 = landmarks[indices[3]];
  const p5 = landmarks[indices[4]];
  const p6 = landmarks[indices[5]];

  if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) return 0.28;

  // Unskewed Euclidean distance in camera sensor pixel space
  const dist = (a, b) => Math.hypot((a.x - b.x) * width, (a.y - b.y) * height);

  const vertical1 = dist(p2, p6);
  const vertical2 = dist(p3, p5);
  const horizontal = dist(p1, p4);

  if (horizontal < 0.0001) return 0.28;
  return (vertical1 + vertical2) / (2.0 * horizontal);
}

/**
 * Initializes and caches the MediaPipe FaceLandmarker singleton.
 * Uses local static wasm & models with resilient GPU -> CPU delegate fallback.
 * Emits progress stages: LOADING_WASM, LOADING_MODEL, FALLBACK_CPU, READY.
 */
export async function getFaceLandmarker(onProgress) {
  if (landmarkerInstance) {
    if (typeof onProgress === 'function') onProgress('READY');
    return landmarkerInstance;
  }
  if (landmarkerLoadingPromise) {
    return landmarkerLoadingPromise;
  }

  const withTimeout = (promise, ms, timeoutMessage) =>
    Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(timeoutMessage)), ms))
    ]);

  landmarkerLoadingPromise = (async () => {
    try {
      if (typeof onProgress === 'function') onProgress('LOADING_WASM');
      let filesetResolver;
      try {
        filesetResolver = await FilesetResolver.forVisionTasks('/wasm');
      } catch (localWasmErr) {
        console.warn('Local WASM load failed, trying pinned CDN fallback:', localWasmErr);
        filesetResolver = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        );
      }

      if (typeof onProgress === 'function') onProgress('LOADING_MODEL');
      let landmarker = null;

      // 1. Try local model with GPU delegate (with 2500ms timeout for mobile GPU stalls)
      try {
        landmarker = await withTimeout(
          FaceLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
              modelAssetPath: '/models/face_landmarker.task',
              delegate: 'GPU'
            },
            outputFaceBlendshapes: true,
            runningMode: 'VIDEO',
            numFaces: 2
          }),
          2500,
          'GPU delegate initialization timed out (>2500ms)'
        );
      } catch (gpuErr) {
        console.warn('MediaPipe GPU delegate failed or timed out; falling back to CPU:', gpuErr);
        if (typeof onProgress === 'function') onProgress('FALLBACK_CPU');
        try {
          landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
              modelAssetPath: '/models/face_landmarker.task',
              delegate: 'CPU'
            },
            outputFaceBlendshapes: true,
            runningMode: 'VIDEO',
            numFaces: 2
          });
        } catch (cpuErr) {
          console.warn('Local model CPU load failed; trying pinned CDN model fallback:', cpuErr);
          landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
              modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
              delegate: 'CPU'
            },
            outputFaceBlendshapes: true,
            runningMode: 'VIDEO',
            numFaces: 2
          });
        }
      }

      landmarkerInstance = landmarker;
      if (typeof onProgress === 'function') onProgress('READY');
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
 * Silently warms up and caches the FaceLandmarker in the background
 * during browser idle time or right when the student begins QR scanning,
 * making attendance verification instantaneous (0ms wait) when camera opens.
 */
export function prewarmFaceLandmarker() {
  if (landmarkerInstance || landmarkerLoadingPromise) return;
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      getFaceLandmarker().catch((err) => console.debug('[Prewarm] Background FaceLandmarker load deferred:', err));
    }, { timeout: 3500 });
  } else {
    setTimeout(() => {
      getFaceLandmarker().catch((err) => console.debug('[Prewarm] Background FaceLandmarker load deferred:', err));
    }, 1000);
  }
}

/**
 * Analyzes a single video frame for face presence, positioning, and eye blink status.
 * Maps coordinates between camera sensor space, visible container (object-fit: cover),
 * and horizontal mirroring so the on-screen oval guide matches face evaluation.
 *
 * @param {FaceLandmarker} landmarker
 * @param {HTMLVideoElement} videoElement
 * @param {number} timestampMs
 * @param {number} baselineEAR
 * @param {Object} options { containerAspect: number, isMirrored: boolean }
 */
export function analyzeFaceFrame(landmarker, videoElement, timestampMs, baselineEAR = 0.28, options = {}) {
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
      isEyesClosed: false,
      isEyesOpen: false,
      isAmbiguous: false
    };
  }

  if (faceCount > 1) {
    return {
      success: true,
      faceCount,
      status: 'MULTIPLE_FACES',
      message: `Multiple faces detected (${faceCount}). Anti-proxy allows only 1 student.`,
      isCentered: false,
      isEyesClosed: false,
      isEyesOpen: false,
      isAmbiguous: false
    };
  }

  // Exactly one face detected
  const landmarks = results.faceLandmarks[0];

  // Sensor dimensions
  const videoWidth = videoElement.videoWidth || 640;
  const videoHeight = videoElement.videoHeight || 480;
  const videoAspect = videoWidth / videoHeight;

  // Container preview aspect ratio (width / height). Default 0.75 for portrait (3:4)
  const containerAspect = options.containerAspect || 0.75;
  const isMirrored = options.isMirrored !== false;

  // Calculate visible region in normalized sensor space [0, 1] due to CSS object-fit: cover
  let cropX = 0;
  let cropY = 0;
  let visibleVideoWidth = 1.0;
  let visibleVideoHeight = 1.0;

  if (videoAspect > containerAspect) {
    // Video wider than container: height fits, left/right cropped
    visibleVideoWidth = containerAspect / videoAspect;
    cropX = (1.0 - visibleVideoWidth) / 2.0;
  } else {
    // Video taller than container: width fits, top/bottom cropped
    visibleVideoHeight = videoAspect / containerAspect;
    cropY = (1.0 - visibleVideoHeight) / 2.0;
  }

  // Map landmarks to visible preview coordinates [0, 1] accounting for crop & mirror
  let minPrevX = 1, maxPrevX = 0, minPrevY = 1, maxPrevY = 0;
  let rawMinX = 1, rawMaxX = 0, rawMinY = 1, rawMaxY = 0;

  for (let i = 0; i < landmarks.length; i++) {
    const pt = landmarks[i];
    if (pt.x < rawMinX) rawMinX = pt.x;
    if (pt.x > rawMaxX) rawMaxX = pt.x;
    if (pt.y < rawMinY) rawMinY = pt.y;
    if (pt.y > rawMaxY) rawMaxY = pt.y;

    // Normalizing relative to visible container viewport
    const visX = (pt.x - cropX) / visibleVideoWidth;
    const visY = (pt.y - cropY) / visibleVideoHeight;
    const prevX = isMirrored ? (1.0 - visX) : visX;
    const prevY = visY;

    if (prevX < minPrevX) minPrevX = prevX;
    if (prevX > maxPrevX) maxPrevX = prevX;
    if (prevY < minPrevY) minPrevY = prevY;
    if (prevY > maxPrevY) maxPrevY = prevY;
  }

  const faceWidth = maxPrevX - minPrevX;
  const faceHeight = maxPrevY - minPrevY;
  const faceCenterX = (minPrevX + maxPrevX) / 2.0;
  const faceCenterY = (minPrevY + maxPrevY) / 2.0;

  // Face alignment evaluation relative to on-screen oval guide (centered at 0.5, 0.5)
  // Generous, natural tolerances so normal hand-held selfie posture aligns smoothly
  const isAlignedX = Math.abs(faceCenterX - 0.5) < 0.28;
  const isAlignedY = Math.abs(faceCenterY - 0.5) < 0.30;
  const isCentered = isAlignedX && isAlignedY;
  const isTooSmall = faceWidth < 0.12 || faceHeight < 0.14;
  const isTooClose = faceWidth > 0.94 || faceHeight > 0.94;

  // Unskewed Euclidean distance EAR in true camera sensor pixel space
  const leftEAR = calculateEAR(landmarks, LEFT_EYE_LANDMARKS, videoWidth, videoHeight);
  const rightEAR = calculateEAR(landmarks, RIGHT_EYE_LANDMARKS, videoWidth, videoHeight);
  const avgEAR = (leftEAR + rightEAR) / 2;

  // Extract Blendshapes
  let blinkScoreLeft = 0;
  let blinkScoreRight = 0;
  let hasBlendshapes = false;
  if (results.faceBlendshapes && results.faceBlendshapes[0] && results.faceBlendshapes[0].categories) {
    const categories = results.faceBlendshapes[0].categories;
    for (let c of categories) {
      if (c.categoryName === 'eyeBlinkLeft') blinkScoreLeft = c.score;
      if (c.categoryName === 'eyeBlinkRight') blinkScoreRight = c.score;
    }
    hasBlendshapes = (blinkScoreLeft > 0 || blinkScoreRight > 0 || categories.length > 5);
  }

  const avgBlinkScore = (blinkScoreLeft + blinkScoreRight) / 2;

  // Dynamic baseline thresholds with hysteresis
  const safeBaseline = Math.max(0.18, Math.min(0.42, baselineEAR || 0.28));
  const earClosedThreshold = safeBaseline * 0.70;
  const earOpenThreshold = safeBaseline * 0.85;

  const bothEARClosed = (leftEAR < earClosedThreshold && rightEAR < earClosedThreshold);
  const bothEAROpen = (leftEAR >= earOpenThreshold && rightEAR >= earOpenThreshold);
  const bothBlendshapesClosed = (blinkScoreLeft >= 0.42 && blinkScoreRight >= 0.42);
  const bothBlendshapesOpen = (blinkScoreLeft <= 0.20 && blinkScoreRight <= 0.20);

  let isEyesClosed = false;
  let isEyesOpen = false;

  if (hasBlendshapes) {
    isEyesClosed = bothBlendshapesClosed || (bothEARClosed && avgBlinkScore >= 0.26);
    // Resilient open detection: blendshapes or EAR open with low blink closure score
    isEyesOpen = bothBlendshapesOpen || (bothEAROpen && avgBlinkScore <= 0.22);
  } else {
    isEyesClosed = bothEARClosed;
    isEyesOpen = bothEAROpen;
  }

  const isAmbiguous = !isEyesClosed && !isEyesOpen;

  // Position guidance
  let positionStatus = 'LOCKED';
  let message = 'Face detected! Blink your eyes once to auto-capture 😉';

  if (!isCentered) {
    positionStatus = 'OFF_CENTER';
    message = 'Please center your face inside the guide.';
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
    isEyesOpen,
    isAmbiguous,
    blinkScoreLeft,
    blinkScoreRight,
    avgBlinkScore,
    leftEAR,
    rightEAR,
    ear: avgEAR,
    earClosedThreshold,
    earOpenThreshold,
    hasBlendshapes,
    landmarks,
    faceBox: {
      minX: rawMinX,
      maxX: rawMaxX,
      minY: rawMinY,
      maxY: rawMaxY,
      width: rawMaxX - rawMinX,
      height: rawMaxY - rawMinY
    },
    previewBox: {
      minX: minPrevX,
      maxX: maxPrevX,
      minY: minPrevY,
      maxY: maxPrevY,
      centerX: faceCenterX,
      centerY: faceCenterY,
      width: faceWidth,
      height: faceHeight
    }
  };
}
