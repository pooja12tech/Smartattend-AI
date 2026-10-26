import React from 'react';
import {
  ArrowLeft, Zap, RefreshCw, Eye, CheckCircle2, XCircle, AlertTriangle,
  RotateCcw, MapPin, Check, Camera, ShieldCheck
} from 'lucide-react';

export default function StudentAttendanceFlow({
  step, // 'SCAN_QR' | 'FACE_VERIFY' | 'EVALUATING' | 'RESULT'
  blinkStatus, // 'INIT' | 'NO_FACE' | 'MULTIPLE_FACES' | 'ALIGNING' | 'WAITING_BLINK' | 'BLINKING' | 'BLINK_DETECTED' | 'CAPTURING'
  facePromptMessage,
  blinkFlash,
  videoRef,
  qrScanError,
  cameraError,
  gateProgress,
  submissionResult,
  sessionId,
  capturedLocation,
  ultrasonicVerified,
  isTorchOn,
  onToggleTorch,
  onCancel,
  onRetryQR,
  onRetryCamera,
  onManualCapture,
  onBackToHome,
  onOpenFaceEnroll,
  onRequestException
}) {
  // Step indicator dots active index
  const getStepDotIndex = () => {
    switch (blinkStatus) {
      case 'INIT':
        return 0;
      case 'NO_FACE':
      case 'ALIGNING':
      case 'MULTIPLE_FACES':
        return 1;
      case 'WAITING_BLINK':
        return 2;
      case 'BLINKING':
      case 'BLINK_DETECTED':
        return 3;
      case 'CAPTURING':
        return 4;
      default:
        return 1;
    }
  };

  const activeDotIndex = getStepDotIndex();

  return (
    <div className="fixed inset-0 z-50 bg-[#111827] text-white flex flex-col justify-between overflow-hidden">
      {/* SCREEN 5: QR SCAN SCREEN */}
      {step === 'SCAN_QR' && (
        <div className="relative flex-1 flex flex-col justify-between bg-black">
          {/* Top Bar (Screen 5 Reference) */}
          <div className="relative z-20 flex items-center justify-between px-4 py-4 pt-6 bg-gradient-to-b from-black/80 to-transparent">
            <button
              type="button"
              onClick={onCancel}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition focus:outline-none"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <h2 className="text-sm font-bold tracking-wide text-white">
              Scan QR Code
            </h2>

            <button
              type="button"
              onClick={onToggleTorch}
              className={`p-2 rounded-full transition focus:outline-none ${
                isTorchOn ? 'bg-amber-400 text-slate-950' : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              title="Toggle Flashlight"
            >
              <Zap className="w-5 h-5" />
            </button>
          </div>

          {/* Center: Live Camera Viewport & QR Frame with Corner Brackets */}
          <div className="relative flex-1 flex flex-col items-center justify-center px-6">
            {/* Real Html5Qrcode video container */}
            <div className="relative w-full max-w-[280px] aspect-square rounded-3xl overflow-hidden bg-black/60 shadow-2xl flex items-center justify-center">
              <div id="smartattend-qr-reader" className="w-full h-full object-cover" />

              {/* Green Corner Brackets Overlay (Screen 5 Reference) */}
              <div className="absolute inset-4 pointer-events-none">
                {/* Top-left corner */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
                {/* Top-right corner */}
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
                {/* Bottom-left corner */}
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
                {/* Bottom-right corner */}
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />

                {/* Subtle animated scanline */}
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse absolute top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <p className="text-xs text-slate-300 font-medium text-center mt-6">
              Align the QR code within the frame
            </p>

            {qrScanError && (
              <div className="mt-4 p-3 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs max-w-xs text-center space-y-2">
                <p>{qrScanError}</p>
                <button
                  type="button"
                  onClick={onRetryQR}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-semibold text-[11px]"
                >
                  Retry Scanner
                </button>
              </div>
            )}
          </div>

          <div className="p-6 text-center text-[11px] text-slate-500">
            Powered by SmartAttend-AI Anti-Proxy Engine
          </div>
        </div>
      )}

      {/* SCREEN 6 - 10: FACE VERIFICATION & LIVENESS CAPTURE */}
      {step === 'FACE_VERIFY' && (
        <div className="relative flex-1 flex flex-col justify-between bg-black">
          {/* Top Status & Prompts (Screens 6-10 Reference) */}
          <div className="relative z-20 px-4 py-4 pt-6 flex flex-col items-center gap-3 bg-gradient-to-b from-black/80 to-transparent">
            <div className="w-full flex items-center justify-between">
              <button
                type="button"
                onClick={onCancel}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition focus:outline-none"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              {/* Dynamic Header Badge matching Reference */}
              <div className="flex-1 flex justify-center px-2">
                {blinkStatus === 'INIT' ? (
                  <div className="px-3 py-1 rounded-full bg-slate-800/90 border border-slate-700 text-xs font-semibold flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    <span>Initializing Camera...</span>
                  </div>
                ) : blinkStatus === 'WAITING_BLINK' ? (
                  <div className="px-3.5 py-1.5 rounded-full bg-emerald-950/90 border border-emerald-400/60 text-emerald-300 text-xs font-bold flex items-center gap-2 shadow-lg animate-pulse">
                    <Eye className="w-4 h-4 text-emerald-400" />
                    <span>Blink both eyes naturally</span>
                  </div>
                ) : blinkStatus === 'BLINK_DETECTED' || blinkStatus === 'CAPTURING' ? (
                  <div className="px-3.5 py-1.5 rounded-full bg-emerald-600 border border-emerald-300 text-white text-xs font-bold flex items-center gap-2 shadow-lg">
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span>Blink detected! Now open your eyes</span>
                  </div>
                ) : (
                  <div className="text-xs font-semibold text-slate-300 text-center">
                    Position your face inside the circle
                  </div>
                )}
              </div>

              <div className="w-9" />
            </div>
          </div>

          {/* Center: Camera Video Stream & Face Oval Guide */}
          <div className="relative flex-1 flex flex-col items-center justify-center px-4">
            <div className="relative w-full max-w-[270px] aspect-[3/4] rounded-full overflow-hidden bg-slate-900 border-4 border-white/10 shadow-2xl flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />

              {/* Concentric Guide Ring (Screens 7-10 Reference) */}
              <div
                className={`absolute inset-3 rounded-full border-2 transition-all duration-300 pointer-events-none ${
                  blinkStatus === 'BLINK_DETECTED' || blinkStatus === 'CAPTURING'
                    ? 'border-emerald-400 shadow-[0_0_35px_rgba(52,211,153,0.8)] scale-102'
                    : blinkStatus === 'WAITING_BLINK' || blinkStatus === 'BLINKING'
                    ? 'border-emerald-400 border-dashed animate-pulse shadow-[0_0_20px_rgba(52,211,153,0.5)]'
                    : blinkStatus === 'ALIGNING'
                    ? 'border-emerald-400/70 border-dashed'
                    : blinkStatus === 'MULTIPLE_FACES'
                    ? 'border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.6)]'
                    : 'border-white/30 border-dashed'
                }`}
              />

              {/* Shutter Flash Animation (Screen 9 & 10) */}
              {blinkFlash && (
                <div className="absolute inset-0 bg-white/95 animate-ping z-30 pointer-events-none" />
              )}
            </div>

            {/* Instruction text below circle (Screens 6, 7, 8 Reference) */}
            <p className="text-xs text-slate-300 font-medium text-center mt-5 max-w-xs">
              {blinkStatus === 'INIT'
                ? 'Starting face verification. Please look at the camera.'
                : blinkStatus === 'WAITING_BLINK'
                ? 'Detecting blink...'
                : blinkStatus === 'CAPTURING'
                ? 'Capturing image...'
                : blinkStatus === 'MULTIPLE_FACES'
                ? 'Multiple faces detected. Only one student allowed.'
                : 'Keep your face centered'}
            </p>

            {/* Step Indicator Dots (Screens 7, 8, 9, 10 Reference) */}
            <div className="flex items-center gap-1.5 mt-4">
              {[0, 1, 2, 3, 4].map((idx) => (
                <span
                  key={idx}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    idx === activeDotIndex
                      ? 'bg-emerald-400 w-5'
                      : idx < activeDotIndex
                      ? 'bg-emerald-600'
                      : 'bg-white/20'
                  }`}
                />
              ))}
            </div>

            {cameraError && (
              <div className="mt-4 p-3 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs max-w-xs text-center space-y-2">
                <p>{cameraError}</p>
                <button
                  type="button"
                  onClick={onRetryCamera}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-semibold text-[11px]"
                >
                  Retry Camera
                </button>
              </div>
            )}
          </div>

          {/* Bottom Manual Capture Fallback (Accessibility & testing override) */}
          <div className="p-4 flex items-center justify-between gap-3 bg-gradient-to-t from-black/80 to-transparent">
            <button
              type="button"
              onClick={onRetryCamera}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 text-xs flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>

            <button
              type="button"
              onClick={onManualCapture}
              className="flex-1 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 transition"
            >
              <Camera className="w-3.5 h-3.5 text-emerald-400" />
              <span>Manual Capture (Override)</span>
            </button>
          </div>
        </div>
      )}

      {/* SCREEN 11: PROCESSING SCREEN */}
      {step === 'EVALUATING' && (
        <div className="flex-1 flex flex-col justify-center items-center px-6 py-8 bg-[#111827]">
          <div className="w-full max-w-xs space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center mx-auto shadow-xl">
                <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                Verifying your identity...
              </h3>
              <p className="text-xs text-slate-400">
                Executing 5-gate anti-proxy verification
              </p>
            </div>

            {/* Step-by-Step Checklist (Screen 11 Reference) */}
            <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 space-y-3 text-xs">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="text-slate-200 font-medium">Face detected</span>
              </div>

              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="text-slate-200 font-medium">Liveness check (eye blink)</span>
              </div>

              <div className="flex items-center gap-3">
                {gateProgress?.gate4 === 'PASSED' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin shrink-0" />
                )}
                <span className="text-white font-semibold">Matching with records...</span>
              </div>

              <div className="flex items-center gap-3">
                {gateProgress?.gate3 === 'PASSED' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-slate-700 shrink-0" />
                )}
                <span className="text-slate-400">Checking location</span>
              </div>

              <div className="flex items-center gap-3">
                {gateProgress?.gate2 === 'PASSED' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-slate-700 shrink-0" />
                )}
                <span className="text-slate-400">Validating session</span>
              </div>

              <div className="flex items-center gap-3">
                {gateProgress?.gate5 === 'PASSED' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-slate-700 shrink-0" />
                )}
                <span className="text-slate-400">Marking attendance</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SCREEN 12: ATTENDANCE RESULT (SUCCESS & FAILURE) */}
      {step === 'RESULT' && (
        <div className="flex-1 flex flex-col justify-center items-center px-4 py-8 bg-[#F8FAF9] text-[#111827]">
          {submissionResult?.success ? (
            /* ATTENDANCE SUCCESS (Screen 12 Reference) */
            <div className="w-full max-w-sm bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xl text-center space-y-5">
              {/* Green checkmark circle */}
              <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
                <Check className="w-9 h-9 stroke-[3]" />
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-black text-[#111827] tracking-tight">
                  Attendance Marked!
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-1">
                  {submissionResult.details?.subject_name || 'Data Structures'} &bull; {submissionResult.details?.section || 'CSE 5A'}
                </p>
              </div>

              {/* Key-Value Details Card (Screen 12 Reference) */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-xs space-y-2.5 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Time</span>
                  <span className="font-bold text-[#111827]">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Date</span>
                  <span className="font-bold text-[#111827]">
                    {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Face Match</span>
                  <span className="font-bold text-emerald-700">
                    {submissionResult.details?.face_match_score ? `${submissionResult.details.face_match_score}%` : '96.8%'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Method</span>
                  <span className="font-bold text-[#111827]">
                    QR Code + Face Verification
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Location</span>
                  <span className="font-bold text-[#111827]">
                    {submissionResult.details?.distance_meters !== undefined
                      ? `Within Geofence (${submissionResult.details.distance_meters}m)`
                      : 'CSE Block, Room 304'}
                  </span>
                </div>
              </div>

              {/* Primary Green Button (Screen 12 Reference) */}
              <button
                type="button"
                onClick={onBackToHome}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#1A4731] hover:bg-[#143826] active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-emerald-950/20 transition"
              >
                Back to Home
              </button>
            </div>
          ) : (
            /* ATTENDANCE REJECTED / FAILURE */
            <div className="w-full max-w-sm bg-white rounded-3xl p-6 sm:p-7 border border-rose-200 shadow-xl text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto shadow-sm">
                <XCircle className="w-9 h-9" />
              </div>

              <div>
                <h3 className="text-xl font-black text-rose-700 tracking-tight">
                  Verification Blocked
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {submissionResult?.reason || gateProgress?.error || 'Security check failed.'}
                </p>
              </div>

              {/* Key Mismatch Alert */}
              {(submissionResult?.code === 'BIOMETRIC_DECRYPTION_FAILED' || submissionResult?.failed_gate === 'GATE_4_BIOMETRIC_TEMPLATE' || submissionResult?.reason?.includes('encryption key')) && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-left space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Biometric Key Re-Enrollment Needed
                  </div>
                  <p className="text-amber-900/80 text-[11px] leading-relaxed">
                    Your reference template was encrypted under a previous system key. Please update your enrolled photo to proceed.
                  </p>
                  <button
                    type="button"
                    onClick={onOpenFaceEnroll}
                    className="w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition"
                  >
                    Re-Enroll Face Reference
                  </button>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={onRetryQR}
                  className="flex-1 py-3 rounded-2xl bg-[#1A4731] text-white font-bold text-xs shadow transition hover:bg-[#143826]"
                >
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={onRequestException}
                  className="px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition"
                >
                  Faculty Review
                </button>
              </div>

              <button
                type="button"
                onClick={onBackToHome}
                className="text-xs text-slate-500 hover:text-slate-800 font-medium"
              >
                Return to Dashboard
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
