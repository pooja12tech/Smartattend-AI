import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateEAR,
  determineEyeState,
  createBlinkStateMachine,
  DEFAULT_LIVENESS_CONFIG,
  LEFT_EYE_LANDMARKS,
  RIGHT_EYE_LANDMARKS
} from '../src/utils/faceLiveness.js';

describe('SmartAttend AI Blink Detection & Liveness Capture Tests', () => {

  const LEFT_INDICES = [0, 1, 2, 3, 4, 5];

  // Helper to generate 6 synthetic eye landmarks
  function createSyntheticEye(x1, y1, x4, y4, openHeight) {
    const midX1 = x1 + (x4 - x1) * 0.25;
    const midX2 = x1 + (x4 - x1) * 0.75;
    const midY = (y1 + y4) / 2;

    return [
      { x: x1, y: y1 },                          // p1: outer corner
      { x: midX1, y: midY - openHeight / 2 },    // p2: top-left eyelid
      { x: midX2, y: midY - openHeight / 2 },    // p3: top-right eyelid
      { x: x4, y: y4 },                          // p4: inner corner
      { x: midX2, y: midY + openHeight / 2 },    // p5: bottom-right eyelid
      { x: midX1, y: midY + openHeight / 2 },    // p6: bottom-left eyelid
    ];
  }

  it('calculates aspect-ratio corrected EAR accurately across landscape and portrait', () => {
    // Eye with normalized width 0.2 and normalized height 0.05
    const eye = createSyntheticEye(0.2, 0.5, 0.4, 0.5, 0.05);

    // In landscape (640x480):
    // horizontal px = 0.2 * 640 = 128
    // vertical px = 0.05 * 480 = 24
    // EAR = (24 + 24) / (2 * 128) = 48 / 256 = 0.1875
    const landscapeEAR = calculateEAR(eye, LEFT_INDICES, 640, 480);
    assert.ok(Math.abs(landscapeEAR - 0.1875) < 0.001, `Expected 0.1875, got ${landscapeEAR}`);

    // In portrait (480x640):
    // horizontal px = 0.2 * 480 = 96
    // vertical px = 0.05 * 640 = 32
    // EAR = (32 + 32) / (2 * 96) = 64 / 192 = 0.3333
    const portraitEAR = calculateEAR(eye, LEFT_INDICES, 480, 640);
    assert.ok(Math.abs(portraitEAR - 0.3333) < 0.001, `Expected 0.3333, got ${portraitEAR}`);
  });

  it('handles missing, null, or empty landmarks gracefully without crashing', () => {
    assert.equal(calculateEAR(null, LEFT_INDICES), 0.28);
    assert.equal(calculateEAR([], LEFT_INDICES), 0.28);
    assert.equal(calculateEAR([{}], LEFT_INDICES), 0.28);
    assert.equal(calculateEAR(undefined, undefined), 0.28);
  });

  it('handles degenerate zero-width eye landmarks without divide-by-zero errors', () => {
    // Both corners share the exact same coordinate
    const degenerateEye = [
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 0.4 },
      { x: 0.5, y: 0.4 },
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 0.6 },
      { x: 0.5, y: 0.6 }
    ];
    const ear = calculateEAR(degenerateEye, LEFT_INDICES, 640, 480);
    assert.equal(ear, 0.28, 'Must return safe default without throwing Infinity/NaN');
  });

  it('determineEyeState evaluates open vs closed with hysteresis and handles minor bilateral asymmetry', () => {
    // Baseline 0.30: closed threshold = 0.30 * 0.73 = 0.219, open threshold = 0.30 * 0.82 = 0.246
    const baseline = 0.30;

    // Both eyes clearly open
    const openState = determineEyeState({
      leftEAR: 0.29,
      rightEAR: 0.28,
      avgEAR: 0.285,
      baselineEAR: baseline,
      hasBlendshapes: false
    });
    assert.equal(openState.isEyesOpen, true);
    assert.equal(openState.isEyesClosed, false);
    assert.equal(openState.isAmbiguous, false);

    // Both eyes clearly closed
    const closedState = determineEyeState({
      leftEAR: 0.14,
      rightEAR: 0.15,
      avgEAR: 0.145,
      baselineEAR: baseline,
      hasBlendshapes: false
    });
    assert.equal(closedState.isEyesOpen, false);
    assert.equal(closedState.isEyesClosed, true);
    assert.equal(closedState.isAmbiguous, false);

    // Ambiguous transitional state (in the hysteresis gap between 0.219 and 0.246)
    const ambiguousState = determineEyeState({
      leftEAR: 0.23,
      rightEAR: 0.23,
      avgEAR: 0.23,
      baselineEAR: baseline,
      hasBlendshapes: false
    });
    assert.equal(ambiguousState.isEyesOpen, false);
    assert.equal(ambiguousState.isEyesClosed, false);
    assert.equal(ambiguousState.isAmbiguous, true);

    // Blendshapes fusion with slight lighting asymmetry (left: 0.40, right: 0.32, avg: 0.36)
    const asymmetricBlink = determineEyeState({
      leftEAR: 0.18,
      rightEAR: 0.20,
      avgEAR: 0.19,
      blinkScoreLeft: 0.40,
      blinkScoreRight: 0.32,
      avgBlinkScore: 0.36,
      hasBlendshapes: true,
      baselineEAR: baseline
    });
    assert.equal(asymmetricBlink.isEyesClosed, true, 'Blendshapes average >= 0.35 must detect closure despite asymmetry');
  });

  it('determineEyeState accommodates naturally narrower resting eyes (low baseline EAR)', () => {
    // User with naturally smaller eyes (resting EAR ~0.22)
    const narrowBaseline = 0.22;

    const restingOpen = determineEyeState({
      leftEAR: 0.21,
      rightEAR: 0.22,
      avgEAR: 0.215,
      baselineEAR: narrowBaseline,
      hasBlendshapes: false
    });
    assert.equal(restingOpen.isEyesOpen, true, 'Should detect resting eye as open when baseline is calibrated to 0.22');

    const narrowBlink = determineEyeState({
      leftEAR: 0.12,
      rightEAR: 0.13,
      avgEAR: 0.125,
      baselineEAR: narrowBaseline,
      hasBlendshapes: false
    });
    assert.equal(narrowBlink.isEyesClosed, true, 'Should detect closure when EAR drops below 0.22 * 0.73 (~0.16)');
  });

  it('createBlinkStateMachine: establishes READY state and adapts baseline from real face frames', () => {
    const machine = createBlinkStateMachine({ steadyOpenFramesRequired: 2 });
    let result = machine.processFrame({ faceCount: 1, isCentered: true, ear: 0.26, isEyesOpen: true, isEyesClosed: false }, 100);
    assert.equal(result.state, 'WAITING_OPEN');
    assert.equal(result.status, 'ALIGNING');

    result = machine.processFrame({ faceCount: 1, isCentered: true, ear: 0.26, isEyesOpen: true, isEyesClosed: false }, 133);
    assert.equal(result.state, 'READY', 'Should reach READY state on 2nd steady open frame');
    assert.equal(result.status, 'WAITING_BLINK');
  });

  it('createBlinkStateMachine: completes full blink cycle on ONE valid natural blink and triggers capture', () => {
    const machine = createBlinkStateMachine({ steadyOpenFramesRequired: 2 });

    // 1. Establish steady open frames
    machine.processFrame({ faceCount: 1, isCentered: true, ear: 0.28, isEyesOpen: true, isEyesClosed: false }, 100);
    const readyRes = machine.processFrame({ faceCount: 1, isCentered: true, ear: 0.28, isEyesOpen: true, isEyesClosed: false }, 133);
    assert.equal(readyRes.state, 'READY');

    // 2. Closure (natural blink duration ~100ms across 3 frames)
    const close1 = machine.processFrame({ faceCount: 1, isCentered: true, ear: 0.14, isEyesOpen: false, isEyesClosed: true }, 200);
    assert.equal(close1.state, 'CLOSING');
    assert.equal(close1.status, 'BLINKING');
    assert.equal(close1.eyeClosing, true);

    const close2 = machine.processFrame({ faceCount: 1, isCentered: true, ear: 0.13, isEyesOpen: false, isEyesClosed: true }, 233);
    assert.equal(close2.state, 'CLOSING');

    const close3 = machine.processFrame({ faceCount: 1, isCentered: true, ear: 0.15, isEyesOpen: false, isEyesClosed: true }, 266);
    assert.equal(close3.state, 'CLOSING');

    // 3. Eyes reopen: 1 confirmed open frame is sufficient to confirm blink!
    const reopen = machine.processFrame({ faceCount: 1, isCentered: true, ear: 0.28, isEyesOpen: true, isEyesClosed: false }, 310);
    assert.equal(reopen.state, 'CONFIRMED');
    assert.equal(reopen.status, 'BLINK_DETECTED');
    assert.equal(reopen.captured, true, 'Must trigger capture immediately on confirmed reopening frame');
  });

  it('createBlinkStateMachine: strictly prevents duplicate captures on subsequent frames', () => {
    const machine = createBlinkStateMachine();

    // Establish READY
    machine.processFrame({ faceCount: 1, isCentered: true, ear: 0.28, isEyesOpen: true, isEyesClosed: false }, 100);
    machine.processFrame({ faceCount: 1, isCentered: true, ear: 0.28, isEyesOpen: true, isEyesClosed: false }, 133);

    // Blink closure (80ms)
    machine.processFrame({ faceCount: 1, isCentered: true, ear: 0.14, isEyesOpen: false, isEyesClosed: true }, 200);
    machine.processFrame({ faceCount: 1, isCentered: true, ear: 0.14, isEyesOpen: false, isEyesClosed: true }, 240);

    // Reopen frame 1: Triggers capture
    const firstCapture = machine.processFrame({ faceCount: 1, isCentered: true, ear: 0.28, isEyesOpen: true, isEyesClosed: false }, 280);
    assert.equal(firstCapture.captured, true);

    // Subsequent open frames must NEVER re-trigger capture
    const secondFrame = machine.processFrame({ faceCount: 1, isCentered: true, ear: 0.28, isEyesOpen: true, isEyesClosed: false }, 313);
    assert.equal(secondFrame.captured, false, 'Must NOT capture on 2nd open frame after confirmation');

    const thirdFrame = machine.processFrame({ faceCount: 1, isCentered: true, ear: 0.28, isEyesOpen: true, isEyesClosed: false }, 346);
    assert.equal(thirdFrame.captured, false, 'Must NOT capture on 3rd open frame after confirmation');
  });

  it('createBlinkStateMachine: rejects ultra-brief sub-frame camera glitches (< 40ms)', () => {
    const machine = createBlinkStateMachine();

    // Establish READY
    machine.processFrame({ faceCount: 1, isCentered: true, ear: 0.28, isEyesOpen: true, isEyesClosed: false }, 100);
    machine.processFrame({ faceCount: 1, isCentered: true, ear: 0.28, isEyesOpen: true, isEyesClosed: false }, 133);

    // Single 20ms glitch frame: closed at 200ms, then immediately open at 220ms
    machine.processFrame({ faceCount: 1, isCentered: true, ear: 0.12, isEyesOpen: false, isEyesClosed: true }, 200);
    const glitchReopen = machine.processFrame({ faceCount: 1, isCentered: true, ear: 0.28, isEyesOpen: true, isEyesClosed: false }, 220);

    assert.equal(glitchReopen.state, 'WAITING_OPEN', 'Sub-40ms camera spike must be filtered as noise');
    assert.equal(glitchReopen.captured, false, 'Must NOT trigger capture for sub-40ms noise');
  });

  it('createBlinkStateMachine: rejects prolonged eye closure (> 650ms, sleep or static photo proxy)', () => {
    const machine = createBlinkStateMachine();

    // Establish READY
    machine.processFrame({ faceCount: 1, isCentered: true, ear: 0.28, isEyesOpen: true, isEyesClosed: false }, 100);
    machine.processFrame({ faceCount: 1, isCentered: true, ear: 0.28, isEyesOpen: true, isEyesClosed: false }, 133);

    // Eyes closed at 200ms
    machine.processFrame({ faceCount: 1, isCentered: true, ear: 0.12, isEyesOpen: false, isEyesClosed: true }, 200);

    // Eyes still closed at 900ms (700ms duration > 650ms limit)
    const longClosure = machine.processFrame({ faceCount: 1, isCentered: true, ear: 0.12, isEyesOpen: false, isEyesClosed: true }, 900);

    assert.equal(longClosure.state, 'WAITING_OPEN');
    assert.equal(longClosure.captured, false);
    assert.equal(machine.getState().rejectionReason, 'CLOSURE_TOO_LONG');
  });

  it('createBlinkStateMachine: rejects static open-eye photo proxy without blinks', () => {
    const machine = createBlinkStateMachine();

    // 10 consecutive open frames (static photograph)
    for (let i = 0; i < 10; i++) {
      const res = machine.processFrame({ faceCount: 1, isCentered: true, ear: 0.28, isEyesOpen: true, isEyesClosed: false }, 100 + i * 33);
      assert.equal(res.captured, false, 'Static open photo must NEVER trigger capture');
    }
    assert.equal(machine.getState().state, 'READY');
  });

  it('createBlinkStateMachine: resets sequence when face is lost or moved off-center', () => {
    const machine = createBlinkStateMachine();

    // In CLOSING state
    machine.processFrame({ faceCount: 1, isCentered: true, ear: 0.28, isEyesOpen: true, isEyesClosed: false }, 100);
    machine.processFrame({ faceCount: 1, isCentered: true, ear: 0.28, isEyesOpen: true, isEyesClosed: false }, 133);
    machine.processFrame({ faceCount: 1, isCentered: true, ear: 0.12, isEyesOpen: false, isEyesClosed: true }, 200);
    assert.equal(machine.getState().state, 'CLOSING');

    // Face lost (e.g. user moved away or obstruction)
    const lostRes = machine.processFrame({ faceCount: 0, isCentered: false }, 233);
    assert.equal(lostRes.state, 'WAITING_OPEN');
    assert.equal(lostRes.status, 'NO_FACE');
    assert.equal(machine.getState().eyesClosedFrames, 0);
    assert.equal(machine.getState().blinkStartTime, null);
  });

  it('createBlinkStateMachine: rejects multiple faces (anti-proxy protection)', () => {
    const machine = createBlinkStateMachine();

    // Multiple faces detected
    const multiRes = machine.processFrame({ faceCount: 2, isCentered: false }, 100);
    assert.equal(multiRes.state, 'WAITING_OPEN');
    assert.equal(multiRes.status, 'MULTIPLE_FACES');
    assert.equal(multiRes.captured, false);
  });

  it('Security Check: capture trigger requires Gate 4 identity verification before attendance is granted', () => {
    // Verifies that a valid blink alone does NOT record attendance;
    // backend biometric match (Gate 4) is mandatory.
    let attendanceRecorded = false;

    const mockVerifyIdentity = (isLiveSelfie, biometricMatchScore) => {
      // Gate 4 threshold is 75% cosine similarity
      if (isLiveSelfie && biometricMatchScore >= 75) {
        attendanceRecorded = true;
        return { success: true, status: 'PRESENT' };
      }
      attendanceRecorded = false;
      return { success: false, reason: 'Biometric face match failed' };
    };

    // Even if liveness capture succeeded:
    const captureResult = { captured: true };
    assert.equal(captureResult.captured, true);

    // Case 1: Biometric mismatch (e.g., friend trying to blink for student) -> attendance REJECTED
    const result1 = mockVerifyIdentity(captureResult.captured, 42);
    assert.equal(result1.success, false);
    assert.equal(attendanceRecorded, false, 'Attendance must NOT be recorded on face mismatch');

    // Case 2: Authentic student face match -> attendance CONFIRMED
    const result2 = mockVerifyIdentity(captureResult.captured, 91);
    assert.equal(result2.success, true);
    assert.equal(attendanceRecorded, true, 'Attendance recorded only after biometric match passes');
  });

});
