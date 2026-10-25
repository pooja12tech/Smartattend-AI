import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

let landmarkerInstance = null;
let landmarkerLoadingPromise = null;

// Eye landmark indices in MediaPipe 468/478 mesh:
// Left eye: 33 (outer corner), 133 (inner corner), 160, 158 (top eyelid), 144, 153 (bottom eyelid)
// Right eye: 362 (outer corner), 263 (inner corner), 385, 387 (top eyelid), 373, 380 (bottom eyelid)
export const LEFT_EYE_LANDMARKS = [33, 160, 158, 133, 153, 144];
export const RIGHT_EYE_LANDMARKS = [362, 385, 387, 263, 373, 380];

/**
 * Standard configuration for liveness detection and state machine transitions.
 */
export const DEFAULT_LIVENESS_CONFIG = {
  baselineEAR: 0.28,
  minBaselineEAR: 0.16,
  maxBaselineEAR: 0.44,
  earClosedFactor: 0.73,     // EAR drops below 73% of baseline indicates closure
  earOpenFactor: 0.82,       // EAR above 82% of baseline indicates open
  blendshapeClosedThreshold: 0.35,  // Average blink score >= 0.35 indicates closure
  blendshapeOpenThreshold: 0.22,    // Average blink score <= 0.22 indicates open
  minClosureDurationMs: 40,  // Filters sub-frame glitch (< 40ms) while accepting 50ms human blinks
  maxClosureDurationMs: 650, // Flag > 650ms closure as static / sleeping / photo proxy
  steadyOpenFramesRequired: 2, // 2 consecutive open frames (~60ms) to calibrate & be READY
  reopenedFramesRequired: 1,   // 1 confirmed open frame is sufficient to confirm reopening
  autoCaptureDelayMs: 400     // Smooth visual confirmation & high-quality open-eye capture (300-700ms window)
};

/**
 * Calculates Eye Aspect Ratio (EAR) from 6 landmark points in pixel space.
 * Corrects for video aspect ratio using actual video resolution.
 * Standard formula: (|p2 - p6| + |p3 - p5|) / (2 * |p1 - p4|)
 */
export function calculateEAR(landmarks, indices, width = 1, height = 1) {
  if (!landmarks || !indices || indices.length < 6) return 0.28;
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
 * Robustly determines eye state (open vs closed vs ambiguous) using
 * fused blendshapes and EAR with hysteresis.
 */
export function determineEyeState({
  leftEAR = 0.28,
  rightEAR = 0.28,
  avgEAR = 0.28,
  blinkScoreLeft = 0,
  blinkScoreRight = 0,
  avgBlinkScore = 0,
  hasBlendshapes = false,
  baselineEAR = 0.28,
  config = DEFAULT_LIVENESS_CONFIG
}) {
  const safeBaseline = Math.max(
    config.minBaselineEAR ?? 0.16,
    Math.min(config.maxBaselineEAR ?? 0.44, baselineEAR || 0.28)
  );
  const earClosedThreshold = safeBaseline * (config.earClosedFactor ?? 0.73);
  const earOpenThreshold = safeBaseline * (config.earOpenFactor ?? 0.82);

  const bothEARClosed = leftEAR < earClosedThreshold && rightEAR < earClosedThreshold;
  const bothEAROpen = leftEAR >= earOpenThreshold && rightEAR >= earOpenThreshold;
  const avgEARClosed = avgEAR < earClosedThreshold;
  const avgEAROpen = avgEAR >= earOpenThreshold;

  const bsClosedThresh = config.blendshapeClosedThreshold ?? 0.35;
  const bsOpenThresh = config.blendshapeOpenThreshold ?? 0.22;

  let isEyesClosed = false;
  let isEyesOpen = false;

  if (hasBlendshapes) {
    // Both blendshapes clearly closing (accounting for minor asymmetry: average >= 0.35 and both >= 0.25)
    const blendshapesBilateralClosed = (avgBlinkScore >= bsClosedThresh && blinkScoreLeft >= 0.25 && blinkScoreRight >= 0.25)
      || (blinkScoreLeft >= 0.42 && blinkScoreRight >= 0.42);

    // Blended EAR + Blendshape confirmation:
    isEyesClosed = blendshapesBilateralClosed
      || bothEARClosed
      || (avgEARClosed && avgBlinkScore >= 0.25);

    // Eyes open: blendshapes low and EAR healthy
    const blendshapesBilateralOpen = avgBlinkScore <= bsOpenThresh && blinkScoreLeft < 0.35 && blinkScoreRight < 0.35;
    isEyesOpen = (blendshapesBilateralOpen && (avgEAROpen || avgEAR >= earClosedThreshold * 1.15))
      || (bothEAROpen && avgBlinkScore <= 0.28);
  } else {
    // Pure EAR mode with hysteresis
    isEyesClosed = bothEARClosed || (avgEARClosed && leftEAR < safeBaseline * 0.75 && rightEAR < safeBaseline * 0.75);
    isEyesOpen = bothEAROpen || (avgEAROpen && leftEAR >= earClosedThreshold * 1.1 && rightEAR >= earClosedThreshold * 1.1);
  }

  // Ensure isEyesClosed and isEyesOpen are mutually exclusive
  if (isEyesClosed && isEyesOpen) {
    if (avgBlinkScore >= bsClosedThresh) {
      isEyesOpen = false;
    } else {
      isEyesClosed = false;
      isEyesOpen = false;
    }
  }

  const isAmbiguous = !isEyesClosed && !isEyesOpen;

  return {
    isEyesClosed,
    isEyesOpen,
    isAmbiguous,
    safeBaseline,
    earClosedThreshold,
    earOpenThreshold
  };
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
 * @param {Object} options { containerAspect: number, isMirrored: boolean, config: Object }
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

  const eyeState = determineEyeState({
    leftEAR,
    rightEAR,
    avgEAR,
    blinkScoreLeft,
    blinkScoreRight,
    avgBlinkScore,
    hasBlendshapes,
    baselineEAR,
    config: options.config || DEFAULT_LIVENESS_CONFIG
  });

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
    isEyesClosed: eyeState.isEyesClosed,
    isEyesOpen: eyeState.isEyesOpen,
    isAmbiguous: eyeState.isAmbiguous,
    blinkScoreLeft,
    blinkScoreRight,
    avgBlinkScore,
    leftEAR,
    rightEAR,
    ear: avgEAR,
    safeBaseline: eyeState.safeBaseline,
    earClosedThreshold: eyeState.earClosedThreshold,
    earOpenThreshold: eyeState.earOpenThreshold,
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

/**
 * Creates a deterministic blink state machine that tracks the full
 * OPEN -> CLOSED -> OPEN cycle and prevents duplicate captures.
 */
export function createBlinkStateMachine(customConfig = {}) {
  const config = { ...DEFAULT_LIVENESS_CONFIG, ...customConfig };
  let state = 'WAITING_OPEN'; // 'WAITING_OPEN' | 'READY' | 'CLOSING' | 'REOPENING' | 'CONFIRMED'
  let steadyOpenFrames = 0;
  let eyesClosedFrames = 0;
  let reopenedFrames = 0;
  let blinkStartTime = null;
  let baselineEAR = config.baselineEAR;
  let baselineCalibrated = false;
  let calibrationFrames = 0;
  let lastClosureDurationMs = 0;
  let transitionReason = 'INIT';
  let rejectionReason = null;
  let captureFired = false;
  let offCenterFrames = 0;

  return {
    reset() {
      state = 'WAITING_OPEN';
      steadyOpenFrames = 0;
      eyesClosedFrames = 0;
      reopenedFrames = 0;
      blinkStartTime = null;
      rejectionReason = null;
      transitionReason = 'RESET';
      captureFired = false;
      offCenterFrames = 0;
    },
    getState() {
      return {
        state,
        steadyOpenFrames,
        eyesClosedFrames,
        reopenedFrames,
        blinkStartTime,
        baselineEAR,
        lastClosureDurationMs,
        transitionReason,
        rejectionReason,
        captureFired
      };
    },
    getBaselineEAR() {
      return baselineEAR;
    },
    processFrame(analysis, now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
      // 1. Face presence validation
      if (!analysis || !analysis.faceCount || analysis.faceCount === 0) {
        state = 'WAITING_OPEN';
        steadyOpenFrames = 0;
        eyesClosedFrames = 0;
        reopenedFrames = 0;
        blinkStartTime = null;
        rejectionReason = 'NO_FACE';
        transitionReason = 'FACE_LOST';
        offCenterFrames = 0;
        return {
          state,
          status: 'NO_FACE',
          prompt: 'Looking for your face... Please face the camera.',
          eyeClosing: false,
          captured: false
        };
      }

      // 2. Anti-proxy multiple faces check
      if (analysis.faceCount > 1) {
        state = 'WAITING_OPEN';
        steadyOpenFrames = 0;
        eyesClosedFrames = 0;
        reopenedFrames = 0;
        blinkStartTime = null;
        rejectionReason = 'MULTIPLE_FACES';
        transitionReason = 'MULTIPLE_FACES_DETECTED';
        offCenterFrames = 0;
        return {
          state,
          status: 'MULTIPLE_FACES',
          prompt: `Multiple faces detected (${analysis.faceCount}). Only 1 student permitted.`,
          eyeClosing: false,
          captured: false
        };
      }

      // 3. Face position alignment with micro-jitter debounce
      if (!analysis.isCentered) {
        offCenterFrames++;
        if (offCenterFrames >= 3) {
          state = 'WAITING_OPEN';
          steadyOpenFrames = 0;
          eyesClosedFrames = 0;
          reopenedFrames = 0;
          blinkStartTime = null;
          rejectionReason = 'OFF_CENTER';
        }
        return {
          state,
          status: 'ALIGNING',
          prompt: analysis.message || 'Please center your face inside the guide.',
          eyeClosing: false,
          captured: false
        };
      }

      offCenterFrames = 0;

      // Exactly 1 centered face: calibrate / adapt baseline EAR
      if (!baselineCalibrated) {
        if (analysis.ear > 0.12 && (!analysis.hasBlendshapes || analysis.avgBlinkScore <= 0.25)) {
          calibrationFrames++;
          if (calibrationFrames === 1) {
            baselineEAR = analysis.ear;
          } else {
            baselineEAR = baselineEAR * 0.70 + analysis.ear * 0.30;
          }
          if (calibrationFrames >= 3) {
            baselineCalibrated = true;
          }
        }
      } else if (analysis.isEyesOpen && analysis.ear > 0.14) {
        baselineEAR = baselineEAR * 0.94 + analysis.ear * 0.06;
        baselineEAR = Math.max(config.minBaselineEAR, Math.min(config.maxBaselineEAR, baselineEAR));
      }

      // 4. Deterministic 4-Step Blink Sequence
      switch (state) {
        case 'WAITING_OPEN':
          if (analysis.isEyesOpen) {
            steadyOpenFrames++;
            if (steadyOpenFrames >= config.steadyOpenFramesRequired) {
              state = 'READY';
              transitionReason = 'STEADY_OPEN_ACHIEVED';
              return {
                state,
                status: 'WAITING_BLINK',
                prompt: 'Face centered! Blink once naturally 😉',
                eyeClosing: false,
                captured: false
              };
            }
          } else if (analysis.isEyesClosed) {
            steadyOpenFrames = 0;
          }
          return {
            state,
            status: 'ALIGNING',
            prompt: 'Face centered! Keep eyes open...',
            eyeClosing: false,
            captured: false
          };

        case 'READY':
          if (analysis.isEyesClosed) {
            state = 'CLOSING';
            blinkStartTime = now;
            eyesClosedFrames = 1;
            transitionReason = 'BILATERAL_CLOSURE_START';
            return {
              state,
              status: 'BLINKING',
              prompt: 'Blink detected! Open eyes to capture 📸',
              eyeClosing: true,
              captured: false
            };
          } else if (analysis.isEyesOpen) {
            steadyOpenFrames++;
          }
          return {
            state,
            status: 'WAITING_BLINK',
            prompt: 'Face ready! Blink once naturally 😉',
            eyeClosing: false,
            captured: false
          };

        case 'CLOSING':
          if (analysis.isEyesClosed) {
            eyesClosedFrames++;
            const duration = now - blinkStartTime;
            if (duration > config.maxClosureDurationMs) {
              state = 'WAITING_OPEN';
              eyesClosedFrames = 0;
              blinkStartTime = null;
              steadyOpenFrames = 0;
              rejectionReason = 'CLOSURE_TOO_LONG';
              transitionReason = 'EXCEEDED_MAX_CLOSURE';
              return {
                state,
                status: 'WAITING_BLINK',
                prompt: 'Blink was too long. Please blink naturally 😉',
                eyeClosing: false,
                captured: false
              };
            }
            return {
              state,
              status: 'BLINKING',
              prompt: 'Blink detected! Open eyes to capture 📸',
              eyeClosing: true,
              captured: false
            };
          } else {
            // Eyes started reopening (isEyesOpen or ambiguous)
            const closedDurationMs = now - blinkStartTime;
            lastClosureDurationMs = closedDurationMs;

            if (closedDurationMs >= config.minClosureDurationMs && closedDurationMs <= config.maxClosureDurationMs && eyesClosedFrames >= 1) {
              state = 'REOPENING';
              reopenedFrames = analysis.isEyesOpen ? 1 : 0;
              transitionReason = 'VALID_CLOSURE_AWAITING_REOPEN';

              if (analysis.isEyesOpen && reopenedFrames >= config.reopenedFramesRequired) {
                state = 'CONFIRMED';
                transitionReason = 'REOPEN_CONFIRMED_CAPTURING';
                const shouldCapture = !captureFired;
                captureFired = true;
                return {
                  state,
                  status: 'BLINK_DETECTED',
                  prompt: '✨ Blink detected! Capturing selfie...',
                  eyeClosing: false,
                  captured: shouldCapture
                };
              }

              return {
                state,
                status: 'BLINKING',
                prompt: 'Blink detected! Reopening...',
                eyeClosing: true,
                captured: false
              };
            } else {
              // Sub-frame glitch (< 40ms) or invalid closure
              state = 'WAITING_OPEN';
              eyesClosedFrames = 0;
              blinkStartTime = null;
              steadyOpenFrames = 0;
              rejectionReason = closedDurationMs < config.minClosureDurationMs ? 'GLITCH_TOO_BRIEF' : 'INVALID_CLOSURE';
              transitionReason = 'FILTERED_GLITCH';
              return {
                state,
                status: 'WAITING_BLINK',
                prompt: 'Camera jitter filtered. Please blink naturally 😉',
                eyeClosing: false,
                captured: false
              };
            }
          }

        case 'REOPENING':
          if (analysis.isEyesOpen) {
            reopenedFrames++;
            if (reopenedFrames >= config.reopenedFramesRequired) {
              state = 'CONFIRMED';
              transitionReason = 'REOPEN_CONFIRMED_CAPTURING';
              const shouldCapture = !captureFired;
              captureFired = true;
              return {
                state,
                status: 'BLINK_DETECTED',
                prompt: '✨ Blink detected! Capturing selfie...',
                eyeClosing: false,
                captured: shouldCapture
              };
            }
          } else if (analysis.isEyesClosed) {
            state = 'WAITING_OPEN';
            eyesClosedFrames = 0;
            reopenedFrames = 0;
            blinkStartTime = null;
            steadyOpenFrames = 0;
            rejectionReason = 'EYES_RECLOSED';
            transitionReason = 'RECLOSED_DURING_REOPEN';
            return {
              state,
              status: 'WAITING_BLINK',
              prompt: 'Please blink once naturally 😉',
              eyeClosing: false,
              captured: false
            };
          } else {
            // Ambiguous in-between state
            if (now - blinkStartTime > 900) {
              state = 'WAITING_OPEN';
              eyesClosedFrames = 0;
              reopenedFrames = 0;
              blinkStartTime = null;
              steadyOpenFrames = 0;
              rejectionReason = 'AMBIGUOUS_REOPEN_TIMEOUT';
              transitionReason = 'REOPEN_TIMEOUT';
              return {
                state,
                status: 'WAITING_BLINK',
                prompt: 'Please blink naturally 😉',
                eyeClosing: false,
                captured: false
              };
            }
          }
          return {
            state,
            status: 'BLINKING',
            prompt: 'Blink detected! Reopening...',
            eyeClosing: true,
            captured: false
          };

        case 'CONFIRMED':
          return {
            state: 'CONFIRMED',
            status: 'BLINK_DETECTED',
            prompt: '✨ Blink detected! Capturing selfie...',
            eyeClosing: false,
            captured: false
          };

        default:
          state = 'WAITING_OPEN';
          return {
            state,
            status: 'NO_FACE',
            prompt: 'Position your face inside the camera frame',
            eyeClosing: false,
            captured: false
          };
      }
    }
  };
}
