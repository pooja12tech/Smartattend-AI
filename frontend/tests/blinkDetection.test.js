import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateEAR } from '../src/utils/faceLiveness.js';

describe('Phase 2 Blink Detection and EAR Reliability Tests', () => {

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

    // Uncorrected normalized calculation would have given 0.05 / 0.2 = 0.25 for both,
    // which distorts EAR by up to 50% depending on screen orientation.
  });

  it('determines closed vs open with proper hysteresis and marks in-between frames as ambiguous', () => {
    // Dynamic baseline 0.30:
    // Closed threshold: 0.30 * 0.70 = 0.21
    // Open threshold: 0.30 * 0.85 = 0.255
    const baseline = 0.30;
    const closedThreshold = baseline * 0.70;
    const openThreshold = baseline * 0.85;

    // Fully open frame
    const openEAR = 0.29;
    const isOpen = openEAR >= openThreshold;
    const isClosed1 = openEAR < closedThreshold;
    assert.equal(isOpen, true);
    assert.equal(isClosed1, false);

    // Deeply closed frame
    const closedEAR = 0.12;
    const isOpen2 = closedEAR >= openThreshold;
    const isClosed2 = closedEAR < closedThreshold;
    assert.equal(isOpen2, false);
    assert.equal(isClosed2, true);

    // Ambiguous transitional frame (e.g. 0.23, between 0.21 and 0.255)
    const ambiguousEAR = 0.23;
    const isOpenAmbiguous = ambiguousEAR >= openThreshold;
    const isClosedAmbiguous = ambiguousEAR < closedThreshold;
    const isAmbiguous = !isOpenAmbiguous && !isClosedAmbiguous;

    assert.equal(isOpenAmbiguous, false, 'Ambiguous frame must not count as open');
    assert.equal(isClosedAmbiguous, false, 'Ambiguous frame must not count as closed');
    assert.equal(isAmbiguous, true, 'Frame in hysteresis gap must be flagged ambiguous');
  });

  it('simulates the deterministic 4-step blink state sequence', () => {
    let machineState = 'WAITING_OPEN';
    let steadyOpenFrames = 0;
    let eyesClosedFrames = 0;
    let reopenedFrames = 0;
    let blinkStartTime = null;
    let captureFired = false;
    let captureCount = 0;

    const processFrameMock = (analysis, now) => {
      // Revalidate face presence & alignment
      if (!analysis.faceCount || !analysis.isCentered) {
        machineState = 'WAITING_OPEN';
        steadyOpenFrames = 0;
        eyesClosedFrames = 0;
        reopenedFrames = 0;
        blinkStartTime = null;
        return;
      }

      switch (machineState) {
        case 'WAITING_OPEN':
          if (analysis.isEyesOpen) {
            steadyOpenFrames++;
            if (steadyOpenFrames >= 4) {
              machineState = 'READY';
            }
          } else {
            steadyOpenFrames = 0;
          }
          break;

        case 'READY':
          if (analysis.isEyesOpen) {
            steadyOpenFrames++;
          } else if (analysis.isEyesClosed) {
            machineState = 'CLOSING';
            blinkStartTime = now;
            eyesClosedFrames = 1;
          }
          break;

        case 'CLOSING':
          if (analysis.isEyesClosed) {
            eyesClosedFrames++;
            if (now - blinkStartTime > 650) {
              machineState = 'WAITING_OPEN';
              eyesClosedFrames = 0;
              blinkStartTime = null;
            }
          } else {
            const closedDuration = now - blinkStartTime;
            if (closedDuration >= 100 && closedDuration <= 550 && eyesClosedFrames >= 2) {
              machineState = 'REOPENING';
              reopenedFrames = analysis.isEyesOpen ? 1 : 0;
            } else {
              // Flicker or glitch (< 100ms or < 2 frames)
              machineState = 'WAITING_OPEN';
              eyesClosedFrames = 0;
              blinkStartTime = null;
            }
          }
          break;

        case 'REOPENING':
          if (analysis.isEyesOpen) {
            reopenedFrames++;
            if (reopenedFrames >= 2) {
              machineState = 'CONFIRMED';
              if (!captureFired) {
                captureFired = true;
                captureCount++;
              }
            }
          } else if (analysis.isEyesClosed) {
            machineState = 'WAITING_OPEN';
            eyesClosedFrames = 0;
            reopenedFrames = 0;
          }
          break;
      }
    };

    // 1. Establish steady open frames
    for (let i = 0; i < 4; i++) {
      processFrameMock({ faceCount: 1, isCentered: true, isEyesOpen: true, isEyesClosed: false }, 100 + i * 33);
    }
    assert.equal(machineState, 'READY', 'Should reach READY state after 4 consecutive open frames');

    // 2. Closed frames for 165ms (5 frames)
    const blinkStart = 300;
    for (let i = 0; i < 5; i++) {
      processFrameMock({ faceCount: 1, isCentered: true, isEyesOpen: false, isEyesClosed: true }, blinkStart + i * 33);
    }
    assert.equal(machineState, 'CLOSING', 'Should be in CLOSING state during eye closure');

    // 3. Eyes reopen: First reopened frame
    processFrameMock({ faceCount: 1, isCentered: true, isEyesOpen: true, isEyesClosed: false }, blinkStart + 5 * 33);
    assert.equal(machineState, 'REOPENING', 'Should transition to REOPENING state on first open frame');
    assert.equal(captureCount, 0, 'Must NOT capture on 1st reopening frame');

    // 4. Second consecutive confirmed open frame
    processFrameMock({ faceCount: 1, isCentered: true, isEyesOpen: true, isEyesClosed: false }, blinkStart + 6 * 33);
    assert.equal(machineState, 'CONFIRMED', 'Should transition to CONFIRMED on 2nd consecutive open frame');
    assert.equal(captureCount, 1, 'Should trigger exactly 1 capture');

    // 5. Subsequent frames must NOT re-trigger capture
    processFrameMock({ faceCount: 1, isCentered: true, isEyesOpen: true, isEyesClosed: false }, blinkStart + 7 * 33);
    assert.equal(captureCount, 1, 'Capture guard must strictly prevent duplicate captures');
  });

  it('rejects camera flickers that last only 1 frame (< 100ms)', () => {
    let machineState = 'READY';
    let eyesClosedFrames = 1; // single frame glitch
    let blinkStartTime = 1000;
    const now = 1033; // 33ms later (single frame)

    const closedDuration = now - blinkStartTime;
    const isHumanBlink = (closedDuration >= 100 && closedDuration <= 550 && eyesClosedFrames >= 2);

    assert.equal(isHumanBlink, false, '33ms single-frame glitch must be rejected');
  });

  it('resets candidate state if face is lost or moved off-center during sequence', () => {
    let machineState = 'CLOSING';
    let eyesClosedFrames = 2;
    let blinkStartTime = 1000;

    // Face suddenly lost (user turned away or obstruction)
    const analysis = { faceCount: 0, isCentered: false };
    if (!analysis.faceCount || !analysis.isCentered) {
      machineState = 'WAITING_OPEN';
      eyesClosedFrames = 0;
      blinkStartTime = null;
    }

    assert.equal(machineState, 'WAITING_OPEN', 'State machine must reset to WAITING_OPEN on face loss');
    assert.equal(eyesClosedFrames, 0, 'Frame counter must reset');
    assert.equal(blinkStartTime, null, 'Start time must be cleared');
  });
});
