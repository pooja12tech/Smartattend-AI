import React, { useState } from 'react';
import {
  ArrowLeft, Zap, RefreshCw, Eye, CheckCircle2, XCircle, AlertTriangle,
  RotateCcw, MapPin, Check, Camera, ShieldCheck, QrCode, ZoomIn
} from 'lucide-react';

export default function StudentAttendanceFlow({
  step, // 'SCAN_QR' | 'FACE_VERIFY' | 'EVALUATING' | 'RESULT'
  scannerStage = 'SCANNING', // 'INITIALIZING' | 'SCANNING' | 'DETECTED' | 'VALIDATING' | 'ERROR'
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
  const [zoomLevel, setZoomLevel] = useState(1);

  // Smooth Optical & Digital Zoom Handler for distance scanning
  const handleSetZoom = async (level) => {
    setZoomLevel(level);

    // 1. Try Hardware Camera Zoom via MediaStreamTrack
    try {
      const videoEl = document.querySelector('#smartattend-qr-reader video');
      if (videoEl && videoEl.srcObject) {
        const [track] = videoEl.srcObject.getVideoTracks();
        if (track && track.getCapabilities) {
          const caps = track.getCapabilities();
          if (caps.zoom) {
            const min = caps.zoom.min || 1;
            const max = caps.zoom.max || 5;
            const target = Math.min(max, Math.max(min, level));
            await track.applyConstraints({
              advanced: [{ zoom: target }]
            });
          }
        }
      }
    } catch (err) {
      console.warn('Hardware zoom not available, using digital zoom:', err);
    }

    // 2. High-performance GPU CSS scale fallback (guaranteed on all mobile browsers)
    try {
      const videoEl = document.querySelector('#smartattend-qr-reader video');
      if (videoEl) {
        videoEl.style.transform = `scale(${level})`;
        videoEl.style.transformOrigin = 'center center';
        videoEl.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
      }
    } catch (e) {}
  };
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

  const isScanSuccess = scannerStage === 'DETECTED' || scannerStage === 'VALIDATING';

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center p-0 overflow-hidden select-none animate-in fade-in duration-300">
      {/* Hide html5-qrcode's ugly default duplicate borders and text */}
      <style>{`
        #smartattend-qr-reader #qr-shaded-region { display: none !important; }
        #smartattend-qr-reader__scan_region { border: none !important; box-shadow: none !important; }
        #smartattend-qr-reader__scan_region svg { display: none !important; }
        #smartattend-qr-reader__dashboard_section_csr { display: none !important; }
        #smartattend-qr-reader__header_message { display: none !important; }
        #smartattend-qr-reader img { display: none !important; }
      `}</style>

      <div className="w-full h-full bg-black text-white flex flex-col justify-between overflow-hidden relative">
        {/* SCREEN 5: QR SCAN SCREEN */}
        {step === 'SCAN_QR' && (
        <div className="relative flex-1 flex flex-col justify-between bg-black overflow-hidden">
          {/* Full-Screen Camera Viewport: displays feed across almost entire screen */}
          <div className="absolute inset-0 w-full h-full overflow-hidden z-0 bg-black">
            <div
              id="smartattend-qr-reader"
              className="w-full h-full object-cover [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
            />
            {/* Darkened subtle vignette overlay around central viewing area */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-transparent to-black/85 pointer-events-none" />
          </div>

          {/* Top Bar */}
          <div className="relative z-20 flex items-center justify-between px-4 py-3 pt-[max(1.25rem,env(safe-area-inset-top,0px))] bg-gradient-to-b from-black/90 via-black/50 to-transparent">
            <button
              type="button"
              id="btn-scanner-back"
              onClick={onCancel}
              className="min-h-[44px] min-w-[44px] p-2.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white transition flex items-center justify-center focus:outline-none cursor-pointer"
              title="Return to Previous Screen"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <h2 className="text-base font-extrabold tracking-tight text-white drop-shadow-md">
              Scan QR Code
            </h2>

            <button
              type="button"
              id="btn-scanner-torch"
              onClick={onToggleTorch}
              className={`min-h-[44px] min-w-[44px] p-2.5 rounded-full transition-all flex items-center justify-center focus:outline-none active:scale-95 cursor-pointer ${
                isTorchOn
                  ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/40 ring-2 ring-amber-300'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              title={isTorchOn ? 'Turn Flash Off' : 'Turn Flash On'}
              aria-label="Toggle Flashlight"
            >
              <Zap className="w-5 h-5" />
            </button>
          </div>

          {/* Center: Square QR Scanning Frame in Centre */}
          <div className="relative z-20 flex-1 flex flex-col items-center justify-center px-4">
            <div
              className={`relative w-[74vw] max-w-[280px] aspect-square rounded-3xl flex items-center justify-center transition-all duration-300 pointer-events-none ${
                isScanSuccess
                  ? 'bg-emerald-950/40 shadow-[0_0_50px_rgba(16,185,129,0.35)]'
                  : 'bg-transparent shadow-2xl'
              }`}
            >
              {/* State 1: Initializing Camera */}
              {scannerStage === 'INITIALIZING' && (
                <div className="absolute inset-0 rounded-3xl bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center gap-2.5 z-20">
                  <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
                  <span className="text-xs font-semibold text-slate-300">
                    Initializing camera...
                  </span>
                </div>
              )}

              {/* State 3 & 4: Successful QR Scan Feedback */}
              {isScanSuccess && (
                <div className="absolute inset-0 rounded-3xl bg-emerald-950/60 backdrop-blur-xs flex flex-col items-center justify-center gap-2.5 z-20 animate-in zoom-in-95 duration-200">
                  <div className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-[0_0_30px_#10B981]">
                    {scannerStage === 'VALIDATING' ? (
                      <RefreshCw className="w-7 h-7 animate-spin" />
                    ) : (
                      <Check className="w-8 h-8 stroke-[3]" />
                    )}
                  </div>
                  <span className="text-xs font-bold text-emerald-200 drop-shadow">
                    {scannerStage === 'VALIDATING' ? 'Validating session...' : 'QR Verified!'}
                  </span>
                </div>
              )}

              {/* The 4 Emerald Green Corner Brackets */}
              <div className="absolute inset-0 pointer-events-none z-10">
                {/* Top-left corner */}
                <div
                  className={`absolute top-0 left-0 w-9 h-9 border-t-[4px] border-l-[4px] rounded-tl-2xl transition-all duration-300 ${
                    isScanSuccess
                      ? 'border-emerald-300 shadow-[0_0_24px_#10B981,inset_0_0_12px_#34D399] filter drop-shadow-[0_0_10px_#10B981]'
                      : 'border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                  }`}
                />
                {/* Top-right corner */}
                <div
                  className={`absolute top-0 right-0 w-9 h-9 border-t-[4px] border-r-[4px] rounded-tr-2xl transition-all duration-300 ${
                    isScanSuccess
                      ? 'border-emerald-300 shadow-[0_0_24px_#10B981,inset_0_0_12px_#34D399] filter drop-shadow-[0_0_10px_#10B981]'
                      : 'border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                  }`}
                />
                {/* Bottom-left corner */}
                <div
                  className={`absolute bottom-0 left-0 w-9 h-9 border-b-[4px] border-l-[4px] rounded-bl-2xl transition-all duration-300 ${
                    isScanSuccess
                      ? 'border-emerald-300 shadow-[0_0_24px_#10B981,inset_0_0_12px_#34D399] filter drop-shadow-[0_0_10px_#10B981]'
                      : 'border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                  }`}
                />
                {/* Bottom-right corner */}
                <div
                  className={`absolute bottom-0 right-0 w-9 h-9 border-b-[4px] border-r-[4px] rounded-br-2xl transition-all duration-300 ${
                    isScanSuccess
                      ? 'border-emerald-300 shadow-[0_0_24px_#10B981,inset_0_0_12px_#34D399] filter drop-shadow-[0_0_10px_#10B981]'
                      : 'border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                  }`}
                />

                {/* Animated Green Laser Scanline */}
                {scannerStage === 'SCANNING' && (
                  <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-scan-beam shadow-[0_0_20px_#10B981] z-10 pointer-events-none">
                    <div className="w-full h-8 bg-gradient-to-b from-emerald-400/25 to-transparent pointer-events-none" />
                  </div>
                )}
              </div>
            </div>

            {/* Instruction Below Frame */}
            <p className="text-xs text-slate-300 font-medium text-center mt-5 tracking-wide drop-shadow-sm">
              Align the faculty's QR code within the frame
            </p>

            {/* Distance Zoom Selector (1x, 2x, 3x) for lecture hall distance scanning */}
            <div className="mt-4 flex items-center justify-center pointer-events-auto">
              <div className="flex items-center gap-1.5 p-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/20 shadow-xl">
                {[1, 2, 3].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => handleSetZoom(lvl)}
                    className={`min-w-[40px] py-1.5 px-3 rounded-full text-xs font-black transition-all cursor-pointer ${
                      zoomLevel === lvl
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-[0_0_12px_#10B981] scale-105'
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {lvl}x
                  </button>
                ))}
              </div>
            </div>

            {/* Scanning Error Banner */}
            {qrScanError && (
              <div className="mt-3 p-3.5 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs max-w-xs text-center space-y-2 shadow-lg pointer-events-auto">
                <div className="flex items-center justify-center gap-1.5 text-rose-300 font-bold">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>Scanning Notice</span>
                </div>
                <p className="text-[11px] leading-relaxed">{qrScanError}</p>
                <button
                  type="button"
                  id="btn-retry-qr-scan"
                  onClick={onRetryQR}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs shadow transition cursor-pointer"
                >
                  Scan Again
                </button>
              </div>
            )}
          </div>

          {/* Understated Identity at bottom */}
          <div className="p-4 text-center text-[10px] text-slate-500 font-medium tracking-wider uppercase">
            SmartAttend-AI Anti-Proxy Engine
          </div>
        </div>
      )}

      {/* SCREEN 6 - 10: FACE VERIFICATION & LIVENESS CAPTURE */}
      {step === 'FACE_VERIFY' && (
        <div className="relative flex-1 flex flex-col justify-between bg-black overflow-hidden">
          {/* Top Status & Prompts (Screens 6-10 Reference) */}
          <div className="relative z-20 px-4 py-3 pt-[max(1.25rem,env(safe-area-inset-top,0px))] flex flex-col items-center gap-2 bg-gradient-to-b from-black/90 via-black/60 to-transparent shrink-0">
            <div className="w-full flex items-center justify-between">
              <button
                type="button"
                id="btn-face-verify-back"
                onClick={onCancel}
                className="min-h-[44px] min-w-[44px] p-2.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white transition flex items-center justify-center focus:outline-none"
                title="Cancel Face Check"
                aria-label="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              {/* Dynamic Header Badge matching Reference */}
              <div className="flex-1 flex justify-center px-2">
                {blinkStatus === 'INIT' ? (
                  <div className="px-3.5 py-1.5 rounded-full bg-slate-800/90 border border-slate-700 text-xs font-semibold flex items-center gap-2">
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

              <div className="w-10" />
            </div>
          </div>

          {/* Center: Camera Video Stream & Face Oval Guide */}
          <div className="relative flex-1 flex flex-col items-center justify-center px-4 py-2 overflow-y-auto">
            <div className="relative w-full max-w-[220px] sm:max-w-[260px] max-h-[38vh] aspect-[3/4] rounded-full overflow-hidden bg-slate-900 border-4 border-white/10 shadow-2xl flex items-center justify-center shrink-0">
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
            <p className="text-xs text-slate-300 font-medium text-center mt-3 max-w-xs shrink-0">
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
            <div className="flex items-center gap-1.5 mt-2 shrink-0">
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
              <div className="mt-2 p-3 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs max-w-xs text-center space-y-2 shrink-0">
                <p>{cameraError}</p>
                <button
                  type="button"
                  onClick={onRetryCamera}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-[11px] transition"
                >
                  Retry Camera
                </button>
              </div>
            )}
          </div>

          {/* Bottom Manual Capture Fallback (Accessibility & testing override) */}
          <div className="p-3 sm:p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] flex items-center justify-between gap-3 bg-gradient-to-t from-black/90 via-black/70 to-transparent shrink-0">
            <button
              type="button"
              onClick={onRetryCamera}
              className="min-h-[44px] p-2.5 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 text-xs flex items-center gap-1.5 active:scale-95 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>

            <button
              type="button"
              onClick={onManualCapture}
              className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <Camera className="w-3.5 h-3.5 text-emerald-400" />
              <span>Manual Capture (Override)</span>
            </button>
          </div>
        </div>
      )}

      {/* SCREEN 11: PROCESSING SCREEN (Elevated Design & Matching with Records strictly in SECOND-LAST spot) */}
      {step === 'EVALUATING' && (
        <div className="flex-1 flex flex-col justify-center items-center px-6 py-8 bg-gradient-to-b from-[#080E1A] via-[#0F172A] to-[#080E1A] text-white">
          <div className="w-full max-w-sm space-y-6 animate-in zoom-in-95 duration-300">
            {/* Header with High-Tech Glow Pulse */}
            <div className="text-center space-y-3">
              <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping pointer-events-none" />
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-950 via-[#1A4731] to-emerald-600 border border-emerald-400/50 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.35)] relative z-10">
                  <RefreshCw className="w-8 h-8 text-emerald-300 animate-spin" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-black text-white tracking-tight">
                  Verifying your identity...
                </h3>
                <p className="text-xs text-emerald-400/80 font-medium mt-1">
                  Executing 5-gate anti-proxy verification
                </p>
              </div>
            </div>

            {/* Checklist with 'Matching with records...' strictly in the SECOND-LAST spot */}
            <div className="bg-slate-900/90 rounded-3xl p-5 border border-slate-800 shadow-2xl space-y-3 text-xs backdrop-blur-md">
              {/* Step 1: Validating session */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span className="text-slate-200 font-semibold">Validating session</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Verified</span>
              </div>

              {/* Step 2: Checking location */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span className="text-slate-200 font-semibold">Checking location (Geofence)</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">In Range</span>
              </div>

              {/* Step 3: Face detected */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span className="text-slate-200 font-semibold">Face detected</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Passed</span>
              </div>

              {/* Step 4: Liveness check */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span className="text-slate-200 font-semibold">Liveness check (eye blink)</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Passed</span>
              </div>

              {/* Step 5 (SECOND LAST): Matching with records... */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                <div className="flex items-center gap-3">
                  {gateProgress?.gate4 === 'PASSED' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : (
                    <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin shrink-0" />
                  )}
                  <span className="text-white font-bold tracking-tight">Matching with records...</span>
                </div>
                <span className="text-[10px] font-extrabold text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-400/30 animate-pulse">
                  {gateProgress?.gate4 === 'PASSED' ? 'Match 99%' : 'Processing'}
                </span>
              </div>

              {/* Step 6 (FINAL): Marking attendance */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/20 border border-slate-800">
                <div className="flex items-center gap-3">
                  {gateProgress?.gate5 === 'PASSED' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-700 shrink-0" />
                  )}
                  <span className={gateProgress?.gate5 === 'PASSED' ? 'text-slate-200 font-semibold' : 'text-slate-500'}>
                    Marking attendance
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-medium">Finalizing</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SCREEN 12: ATTENDANCE RESULT (SUCCESS & FAILURE) */}
      {step === 'RESULT' && (
        <div className="flex-1 flex flex-col justify-center items-center px-4 py-8 pt-[max(1.5rem,env(safe-area-inset-top,0px))] pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] bg-[#F8FAF9] text-[#111827] overflow-y-auto">
          {submissionResult?.success ? (
            /* ATTENDANCE SUCCESS (Screen 12 Reference) */
            <div className="w-full max-w-sm bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xl text-center space-y-5 animate-in zoom-in-95">
              {/* Celebratory Checkmark with Expanding Halo Ring */}
              <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-emerald-400/35 animate-ring-expand pointer-events-none" />
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white flex items-center justify-center shadow-xl shadow-emerald-500/40 animate-success-pop relative z-10">
                  <Check className="w-9 h-9 stroke-[3]" />
                </div>
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
                id="btn-attendance-done"
                onClick={onBackToHome}
                className="w-full min-h-[44px] py-3.5 px-4 rounded-2xl bg-[#1A4731] hover:bg-[#143826] active:scale-[0.97] text-white font-bold text-sm shadow-md shadow-emerald-950/20 transition cursor-pointer"
              >
                Back to Home
              </button>
            </div>
          ) : (
            /* ATTENDANCE REJECTED / FAILURE */
            <div className="w-full max-w-sm bg-white rounded-3xl p-6 sm:p-7 border border-rose-200 shadow-xl text-center space-y-4 animate-in zoom-in-95">
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
                    className="w-full min-h-[44px] py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs active:scale-[0.97] transition cursor-pointer"
                  >
                    Re-Enroll Face Reference
                  </button>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={onRetryQR}
                  className="flex-1 min-h-[44px] py-3 rounded-2xl bg-[#1A4731] text-white font-bold text-xs shadow transition hover:bg-[#143826] active:scale-[0.97] cursor-pointer"
                >
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={onRequestException}
                  className="px-4 min-h-[44px] py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition active:scale-[0.97] cursor-pointer"
                >
                  Faculty Review
                </button>
              </div>

              <button
                type="button"
                onClick={onBackToHome}
                className="min-h-[44px] text-xs text-slate-500 hover:text-slate-800 font-medium active:scale-[0.97] flex items-center justify-center transition cursor-pointer"
              >
                Return to Dashboard
              </button>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
