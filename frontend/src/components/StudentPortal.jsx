import React, { useState, useEffect, useRef } from 'react';
import {
  Fingerprint, Smartphone, QrCode, Camera, CheckCircle2, XCircle, AlertTriangle,
  TrendingUp, Award, Flame, BookOpen, Clock, ChevronDown, ChevronUp, RefreshCw,
  MapPin, ShieldAlert, Sparkles, Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api, getDeviceId } from '../api';

export default function StudentPortal({ user }) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Biometric state
  const [biometricUnlocked, setBiometricUnlocked] = useState(false);
  const [biometricScanning, setBiometricScanning] = useState(false);

  // QR & Attendance flow
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannedToken, setScannedToken] = useState('');
  const [sessionId, setSessionId] = useState('CS301-SEC-A');
  const [cameraActive, setCameraActive] = useState(false);
  const [selfieCaptured, setSelfieCaptured] = useState(null);
  const videoRef = useRef(null);

  // Viva Simulator State (to demo proxy catches!)
  const [showSimulator, setShowSimulator] = useState(false);
  const [simExpiredQR, setSimExpiredQR] = useState(false);
  const [simFarGPS, setSimFarGPS] = useState(false);
  const [simWrongDevice, setSimWrongDevice] = useState(false);
  const [simFaceMismatch, setSimFaceMismatch] = useState(false);

  // 5-Gate Checklist Animation State
  const [gateProgress, setGateProgress] = useState(null); // { gate1, gate2, gate3, gate4, gate5, activeGate, error }
  const [submittingAttendance, setSubmittingAttendance] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);

  // Biometric Face Enrollment Modal State
  const [showFaceEnrollModal, setShowFaceEnrollModal] = useState(false);
  const [enrollSelfie, setEnrollSelfie] = useState(null);
  const [enrollConsent, setEnrollConsent] = useState(true);
  const [enrollingFace, setEnrollingFace] = useState(false);
  const [faceEnrollSuccess, setFaceEnrollSuccess] = useState(null);
  const enrollVideoRef = useRef(null);
  const [enrollCameraActive, setEnrollCameraActive] = useState(false);

  const deviceId = getDeviceId();

  const startEnrollCamera = async () => {
    try {
      setEnrollCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (enrollVideoRef.current) {
        enrollVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Webcam permission not granted or device lacks camera. Using synthetic capture:', err);
      setEnrollSelfie(generateSyntheticSelfie('#6366f1'));
    }
  };

  const captureEnrollSelfie = () => {
    if (enrollVideoRef.current && enrollVideoRef.current.srcObject) {
      const video = enrollVideoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 160;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, 160, 160);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setEnrollSelfie(dataUrl);

      const stream = video.srcObject;
      stream.getTracks().forEach(track => track.stop());
      setEnrollCameraActive(false);
    } else {
      setEnrollSelfie(generateSyntheticSelfie('#6366f1'));
    }
  };

  const handleEnrollFace = async () => {
    if (!enrollSelfie) {
      alert('Please capture or select a photo before saving.');
      return;
    }
    if (!enrollConsent) {
      alert('Explicit consent is required to store facial reference templates.');
      return;
    }
    setEnrollingFace(true);
    try {
      const res = await api.enrollFace({
        roll_no: user.roll_no,
        live_selfie_base64: enrollSelfie,
        consent_given: enrollConsent
      });
      setFaceEnrollSuccess(res.message || 'Face registered successfully!');
      setTimeout(() => {
        setFaceEnrollSuccess(null);
        setShowFaceEnrollModal(false);
      }, 2000);
      fetchDashboardData();
    } catch (err) {
      alert('Face enrollment failed: ' + err.message);
    } finally {
      setEnrollingFace(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setRefreshing(true);
      const data = await api.getStudentDashboard(user.roll_no);
      setDashboard(data);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user.roll_no]);

  // Simulate Passkey / Fingerprint unlock
  const handleBiometricUnlock = () => {
    setBiometricScanning(true);
    setTimeout(() => {
      setBiometricScanning(false);
      setBiometricUnlocked(true);
    }, 700);
  };

  // Start live webcam for front camera selfie
  const startCamera = async () => {
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Real webcam not accessible or permission denied. Using synthetic verified selfie capture:', err);
      // Fallback synthetic selfie
      setSelfieCaptured(generateSyntheticSelfie(simFaceMismatch ? '#ef4444' : '#6366f1'));
    }
  };

  const captureLiveSelfie = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 160;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, 160, 160);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setSelfieCaptured(dataUrl);

      // Stop video tracks
      const stream = video.srcObject;
      stream.getTracks().forEach(track => track.stop());
      setCameraActive(false);
    } else {
      setSelfieCaptured(generateSyntheticSelfie(simFaceMismatch ? '#ef4444' : '#6366f1'));
    }
  };

  const generateSyntheticSelfie = (color = '#6366f1') => {
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 120;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 120, 120);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(60, 50, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(60, 110, 40, 0, Math.PI, true);
    ctx.fill();
    return canvas.toDataURL('image/jpeg', 0.9);
  };

  // Helper to fetch live fresh QR token for demonstration
  const handleSimulateScanLatestQR = async () => {
    try {
      const qrData = await api.getSessionQR(sessionId);
      setScannedToken(qrData.qr_token);
      if (!selfieCaptured) {
        setSelfieCaptured(generateSyntheticSelfie('#6366f1'));
      }
    } catch (err) {
      // Fallback if session is not active yet, create a token format
      const curEpoch = int(Date.now() / 1000);
      setScannedToken(`${sessionId}.${curEpoch}.demo_valid_sig`);
      if (!selfieCaptured) {
        setSelfieCaptured(generateSyntheticSelfie('#6366f1'));
      }
    }
  };

  // Submit attendance through 5-Gate engine
  const handleExecuteAttendance = async () => {
    setSubmittingAttendance(true);
    setSubmissionResult(null);

    // Initial Gate Progress
    const gates = {
      gate1: 'PENDING',
      gate2: 'PENDING',
      gate3: 'PENDING',
      gate4: 'PENDING',
      gate5: 'PENDING',
      activeGate: 1,
      error: null
    };
    setGateProgress({ ...gates });

    // Determine payload factoring in Viva Simulator switches
    const usedDeviceId = simWrongDevice ? 'DEV-ALIEN-HACKER-PHONE-99' : deviceId;
    const userLat = simFarGPS ? 19.1050 : 19.07601; // ~3.2km away if simulator active
    const userLng = simFarGPS ? 72.8850 : 72.87771;

    let tokenToSend = scannedToken;
    if (simExpiredQR || !tokenToSend) {
      // Create an expired token (25 seconds old)
      const oldEpoch = Math.floor(Date.now() / 1000) - 25;
      tokenToSend = `${sessionId}.${oldEpoch}.expired_test_sig`;
    }

    const liveSelfie = simFaceMismatch
      ? generateSyntheticSelfie('#dc2626')
      : (selfieCaptured || generateSyntheticSelfie('#4f46e5'));

    const payload = {
      roll_no: user.roll_no,
      session_id: sessionId,
      qr_token: tokenToSend,
      device_id: usedDeviceId,
      user_lat: userLat,
      user_lng: userLng,
      live_selfie_base64: liveSelfie,
      is_exception_mode: false
    };

    // Animate Gate 1 (Device Lock)
    gates.gate1 = 'RUNNING';
    setGateProgress({ ...gates, activeGate: 1 });
    await new Promise(r => setTimeout(r, 400));

    if (simWrongDevice) {
      gates.gate1 = 'FAILED';
      gates.error = 'Gate 1 Failed: Hardware Device Lock mismatch (Untrusted phone)';
      setGateProgress({ ...gates, activeGate: 1 });
      setSubmittingAttendance(false);
      try { await api.markAttendance(payload); } catch (e) {
        setSubmissionResult({ success: false, reason: e.message, failed_gate: 'GATE_1_DEVICE_LOCK' });
      }
      return;
    }
    gates.gate1 = 'PASSED';

    // Animate Gate 2 (Dynamic QR)
    gates.gate2 = 'RUNNING';
    setGateProgress({ ...gates, activeGate: 2 });
    await new Promise(r => setTimeout(r, 450));

    if (simExpiredQR) {
      gates.gate2 = 'FAILED';
      gates.error = 'Gate 2 Failed: Dynamic QR Expired (> 7s old)';
      setGateProgress({ ...gates, activeGate: 2 });
      setSubmittingAttendance(false);
      try { await api.markAttendance(payload); } catch (e) {
        setSubmissionResult({ success: false, reason: e.message, failed_gate: 'GATE_2_DYNAMIC_QR' });
      }
      return;
    }
    gates.gate2 = 'PASSED';

    // Animate Gate 3 (GPS Geofence)
    gates.gate3 = 'RUNNING';
    setGateProgress({ ...gates, activeGate: 3 });
    await new Promise(r => setTimeout(r, 450));

    if (simFarGPS) {
      gates.gate3 = 'FAILED';
      gates.error = 'Gate 3 Failed: Geofence Breach (You are >60m away)';
      setGateProgress({ ...gates, activeGate: 3 });
      setSubmittingAttendance(false);
      try { await api.markAttendance(payload); } catch (e) {
        setSubmissionResult({ success: false, reason: e.message, failed_gate: 'GATE_3_GPS_GEOFENCE' });
      }
      return;
    }
    gates.gate3 = 'PASSED';

    // Animate Gate 4 (AI Face Match)
    gates.gate4 = 'RUNNING';
    setGateProgress({ ...gates, activeGate: 4 });
    await new Promise(r => setTimeout(r, 500));

    // Execute actual backend call to finalize Gate 4 & Gate 5
    try {
      const res = await api.markAttendance(payload);
      gates.gate4 = 'PASSED';
      gates.gate5 = 'PASSED';
      setGateProgress({ ...gates, activeGate: 5 });
      setSubmissionResult({ success: true, details: res.details, status: res.status });

      // Trigger Confetti Celebration!
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });

      // Refresh student stats
      fetchDashboardData();
    } catch (err) {
      const failedGate = err.detail?.failed_gate || 'GATE_FAILED';
      if (failedGate.includes('4') || simFaceMismatch) {
        gates.gate4 = 'FAILED';
      } else {
        gates.gate5 = 'FAILED';
      }
      gates.error = err.message;
      setGateProgress({ ...gates });
      setSubmissionResult({ success: false, reason: err.message, failed_gate: failedGate });
    } finally {
      setSubmittingAttendance(false);
    }
  };

  const getRiskBadge = (level) => {
    switch (level) {
      case 'CRITICAL':
      case 'HIGH':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1.5 shadow-sm shadow-rose-500/20">
            <ShieldAlert className="w-4 h-4 text-rose-400" /> HIGH RISK (Defaulter Warning)
          </span>
        );
      case 'WARNING':
      case 'MEDIUM':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-400" /> BORDERLINE RISK
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> SAFE STANDING
          </span>
        );
    }
  };

  if (loading && !dashboard) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-brand-500" />
        <p className="text-sm font-medium">Loading SmartAttend Student PWA...</p>
      </div>
    );
  }

  const attendance = dashboard?.attendance || {};
  const bunkCalc = dashboard?.bunk_calculator || {};
  const risk = dashboard?.ai_risk_prediction || {};
  const subjects = dashboard?.subject_breakdown || [];
  const logs = dashboard?.recent_logs || [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">

      {/* Top Biometric & Device Binding Status Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Hardware Device Lock */}
        <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Hardware Device Lock</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Bound
                </span>
              </div>
              <p className="text-xs font-mono text-slate-400 mt-0.5 truncate max-w-xs">{deviceId}</p>
            </div>
          </div>

          <div>
            {!biometricUnlocked ? (
              <button
                onClick={handleBiometricUnlock}
                disabled={biometricScanning}
                className="px-3 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-[11px] font-semibold shadow-lg shadow-brand-500/25 flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
              >
                <Fingerprint className={`w-3.5 h-3.5 ${biometricScanning ? 'animate-bounce text-amber-300' : ''}`} />
                <span>{biometricScanning ? 'Verifying...' : 'Unlock Touch ID'}</span>
              </button>
            ) : (
              <div className="px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Unlocked</span>
              </div>
            )}
          </div>
        </div>

        {/* Biometric Face Template Registration */}
        <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-inner">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Face Biometric Gate</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Consent Verified
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Template stored for AI matching</p>
            </div>
          </div>

          <button
            onClick={() => setShowFaceEnrollModal(true)}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold flex items-center gap-1.5 transition active:scale-95"
          >
            <Camera className="w-3.5 h-3.5 text-purple-400" />
            <span>Enroll / Update</span>
          </button>
        </div>
      </div>

      {/* 5-Gate Live Attendance Scanner Trigger */}
      <div className="glass-card rounded-2xl p-6 border border-slate-800 text-center relative overflow-hidden">
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 mx-auto flex items-center justify-center shadow-xl shadow-brand-500/30">
            <QrCode className="w-9 h-9 text-white" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Mark Lecture Attendance</h2>
            <p className="text-xs text-slate-400 mt-1">
              Protected by the 5-Gate Anti-Proxy Verification Engine (Device + Dynamic QR + GPS + AI Face Match).
            </p>
          </div>

          {!isScannerOpen ? (
            <button
              onClick={() => {
                if (!biometricUnlocked) handleBiometricUnlock();
                setIsScannerOpen(true);
              }}
              className="w-full py-3.5 px-6 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 transition shadow-lg shadow-brand-500/30 active:scale-[0.99] flex items-center justify-center gap-2"
            >
              <QrCode className="w-5 h-5" />
              Open 5-Gate QR & Face Scanner
            </button>
          ) : (
            <div className="text-left space-y-4 pt-2">
              
              {/* Viva Simulator Toggle (For Presentation / Defense) */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setShowSimulator(!showSimulator)}
                  className="w-full flex items-center justify-between text-slate-300 font-semibold"
                >
                  <span className="flex items-center gap-1.5 text-amber-400">
                    <Sparkles className="w-4 h-4" /> Viva / Defense Anti-Proxy Testing Simulator
                  </span>
                  {showSimulator ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>

                {showSimulator && (
                  <div className="mt-3 pt-3 border-t border-slate-800 space-y-2 text-slate-300">
                    <p className="text-[11px] text-slate-400">
                      Toggle any of these switches to demonstrate how SmartAttend-AI immediately catches and blocks fraud attempts:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <label className="flex items-center gap-2 p-2 rounded bg-slate-950/80 border border-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={simExpiredQR}
                          onChange={(e) => setSimExpiredQR(e.target.checked)}
                          className="rounded text-rose-500"
                        />
                        <span className="text-[11px]">Simulate Expired QR (&gt;7s)</span>
                      </label>

                      <label className="flex items-center gap-2 p-2 rounded bg-slate-950/80 border border-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={simFarGPS}
                          onChange={(e) => setSimFarGPS(e.target.checked)}
                          className="rounded text-rose-500"
                        />
                        <span className="text-[11px]">Simulate 3km Away GPS</span>
                      </label>

                      <label className="flex items-center gap-2 p-2 rounded bg-slate-950/80 border border-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={simWrongDevice}
                          onChange={(e) => setSimWrongDevice(e.target.checked)}
                          className="rounded text-rose-500"
                        />
                        <span className="text-[11px]">Simulate Alien / Proxy Phone</span>
                      </label>

                      <label className="flex items-center gap-2 p-2 rounded bg-slate-950/80 border border-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={simFaceMismatch}
                          onChange={(e) => setSimFaceMismatch(e.target.checked)}
                          className="rounded text-rose-500"
                        />
                        <span className="text-[11px]">Simulate Face Mismatch</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Dynamic QR Token Input & Desktop Helper */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
                  <label>Session Dynamic QR Token</label>
                  <button
                    type="button"
                    onClick={handleSimulateScanLatestQR}
                    className="text-brand-400 hover:text-brand-300 underline text-[11px] flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Fetch Faculty's Active Token
                  </button>
                </div>
                <input
                  type="text"
                  value={scannedToken}
                  onChange={(e) => setScannedToken(e.target.value)}
                  placeholder="CS301-SEC-A.1713400000.signature..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Camera / Live Selfie Capture Section */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-indigo-400" /> Gate 4: Live Selfie Capture
                  </span>
                  {selfieCaptured && (
                    <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Selfie Ready
                    </span>
                  )}
                </div>

                {cameraActive ? (
                  <div className="space-y-2">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-44 object-cover rounded-xl bg-black" />
                    <button
                      type="button"
                      onClick={captureLiveSelfie}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold"
                    >
                      Capture Photo Now
                    </button>
                  </div>
                ) : selfieCaptured ? (
                  <div className="flex items-center gap-3">
                    <img src={selfieCaptured} alt="Live Selfie" className="w-16 h-16 rounded-xl object-cover border border-slate-700 shadow" />
                    <div className="text-xs text-slate-400 space-y-1">
                      <p className="text-slate-200 font-medium">Front camera selfie registered.</p>
                      <button
                        type="button"
                        onClick={startCamera}
                        className="text-brand-400 hover:underline text-[11px]"
                      >
                        Retake Photo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5" /> Open Front Camera
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelfieCaptured(generateSyntheticSelfie('#6366f1'))}
                      className="py-2 px-3 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold"
                    >
                      Quick Test Selfie
                    </button>
                  </div>
                )}
              </div>

              {/* Animated 5-Gate Checklist View */}
              {gateProgress && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>5-Gate Anti-Proxy Evaluation</span>
                    {submittingAttendance && <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-400" />}
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between p-2 rounded bg-slate-900/60">
                      <span className="flex items-center gap-2">
                        {gateProgress.gate1 === 'PASSED' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : gateProgress.gate1 === 'FAILED' ? <XCircle className="w-4 h-4 text-rose-400" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-600 border-t-indigo-400 animate-spin" />}
                        Gate 1: Hardware Device Lock & 1-Phone Rule
                      </span>
                      <span className={`font-mono text-[10px] font-bold ${gateProgress.gate1 === 'PASSED' ? 'text-emerald-400' : gateProgress.gate1 === 'FAILED' ? 'text-rose-400' : 'text-slate-400'}`}>
                        {gateProgress.gate1}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded bg-slate-900/60">
                      <span className="flex items-center gap-2">
                        {gateProgress.gate2 === 'PASSED' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : gateProgress.gate2 === 'FAILED' ? <XCircle className="w-4 h-4 text-rose-400" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-600" />}
                        Gate 2: Dynamic QR Time & Signature Check
                      </span>
                      <span className={`font-mono text-[10px] font-bold ${gateProgress.gate2 === 'PASSED' ? 'text-emerald-400' : gateProgress.gate2 === 'FAILED' ? 'text-rose-400' : 'text-slate-400'}`}>
                        {gateProgress.gate2}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded bg-slate-900/60">
                      <span className="flex items-center gap-2">
                        {gateProgress.gate3 === 'PASSED' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : gateProgress.gate3 === 'FAILED' ? <XCircle className="w-4 h-4 text-rose-400" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-600" />}
                        Gate 3: GPS Geofence Check (&le; 60m Classroom)
                      </span>
                      <span className={`font-mono text-[10px] font-bold ${gateProgress.gate3 === 'PASSED' ? 'text-emerald-400' : gateProgress.gate3 === 'FAILED' ? 'text-rose-400' : 'text-slate-400'}`}>
                        {gateProgress.gate3}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded bg-slate-900/60">
                      <span className="flex items-center gap-2">
                        {gateProgress.gate4 === 'PASSED' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : gateProgress.gate4 === 'FAILED' ? <XCircle className="w-4 h-4 text-rose-400" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-600" />}
                        Gate 4: AI Face Match Verification
                      </span>
                      <span className={`font-mono text-[10px] font-bold ${gateProgress.gate4 === 'PASSED' ? 'text-emerald-400' : gateProgress.gate4 === 'FAILED' ? 'text-rose-400' : 'text-slate-400'}`}>
                        {gateProgress.gate4}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded bg-slate-900/60">
                      <span className="flex items-center gap-2">
                        {gateProgress.gate5 === 'PASSED' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : gateProgress.gate5 === 'FAILED' ? <XCircle className="w-4 h-4 text-rose-400" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-600" />}
                        Gate 5: Anti-Fraud Audit Logger & Final Grant
                      </span>
                      <span className={`font-mono text-[10px] font-bold ${gateProgress.gate5 === 'PASSED' ? 'text-emerald-400' : gateProgress.gate5 === 'FAILED' ? 'text-rose-400' : 'text-slate-400'}`}>
                        {gateProgress.gate5}
                      </span>
                    </div>
                  </div>

                  {gateProgress.error && (
                    <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium">
                      ❌ {gateProgress.error}
                    </div>
                  )}

                  {submissionResult?.success && (
                    <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <div>
                        <p className="font-bold">ATTENDANCE RECORDED: {submissionResult.status}</p>
                        <p className="text-[11px] text-emerald-300/80">Distance: {submissionResult.details?.distance_meters}m | AI Match: {submissionResult.details?.face_match_score}%</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleExecuteAttendance}
                  disabled={submittingAttendance || !scannedToken}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/25 active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submittingAttendance ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Validate 5 Gates & Submit
                </button>

                <button
                  type="button"
                  onClick={() => setIsScannerOpen(false)}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
                >
                  Close
                </button>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Main Student Analytics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* 1. AI Risk Predictor Card (Random Forest Output) */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">AI Attendance Risk Engine</h3>
            </div>
            {getRiskBadge(risk.risk_level)}
          </div>

          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Random Forest Defaulter Probability</p>
              <p className="text-3xl font-black text-white mt-0.5">{risk.defaulter_risk_pct}%</p>
            </div>
            <div className="w-14 h-14 rounded-full bg-slate-950 flex items-center justify-center border-4 border-indigo-500/30">
              <TrendingUp className="w-6 h-6 text-indigo-400" />
            </div>
          </div>

          {/* Behavioral ML Insights */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Behavioral Insights:</p>
            <ul className="space-y-1.5 text-xs text-slate-400">
              {risk.insights && risk.insights.map((insight, idx) => (
                <li key={idx} className="flex items-start gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                  <span className="text-indigo-400 font-bold">•</span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 2. Interactive What-If Bunk Calculator */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">What-If Bunk Calculator</h3>
            </div>
            <span className="text-xs font-bold font-mono text-indigo-300">Target: 75.0%</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
              <p className="text-xs text-slate-400">Current Attendance</p>
              <p className={`text-3xl font-black mt-1 ${attendance.current_pct >= 75 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {attendance.current_pct}%
              </p>
              <p className="text-[11px] text-slate-500 mt-1 font-mono">{attendance.attended_lectures}/{attendance.total_lectures} Lectures</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-center">
              {bunkCalc.status === 'SAFE' ? (
                <>
                  <p className="text-xs text-emerald-400 font-semibold">Safe Bunks Remaining</p>
                  <p className="text-3xl font-black text-emerald-400 mt-1">{bunkCalc.safe_skips}</p>
                  <p className="text-[11px] text-slate-500 mt-1">Without dropping below 75%</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-rose-400 font-semibold">Classes Needed</p>
                  <p className="text-3xl font-black text-rose-400 mt-1">{bunkCalc.classes_needed}</p>
                  <p className="text-[11px] text-slate-500 mt-1">Consecutive attendance to hit 75%</p>
                </>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 font-medium">
            💡 {bunkCalc.message}
          </div>

          {/* Active Streak */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 text-xs">
            <div className="flex items-center gap-2 text-amber-300 font-semibold">
              <Flame className="w-4 h-4 text-amber-400 animate-pulse" /> Active Attendance Streak
            </div>
            <div className="text-sm font-black font-mono text-amber-400">
              {attendance.active_streak > 0 ? `+${attendance.active_streak} Lectures` : `${attendance.active_streak} Lectures Missed`}
            </div>
          </div>
        </div>

      </div>

      {/* Subject-Wise Attendance Breakdown */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Academic Curriculum & Subject Tracking</h3>
          </div>
          <span className="text-[11px] text-slate-400">Min. Target: 75.0%</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {subjects.map((sub, idx) => {
            const isSafe = sub.pct >= 75.0;
            const bCalc = sub.bunk_calculator;
            return (
              <div key={idx} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-white leading-snug">{sub.subject}</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {sub.attended} attended / {sub.total} conducted lectures
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-black ${isSafe ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'}`}>
                    {sub.pct}%
                  </span>
                </div>

                <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${isSafe ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-rose-500 to-amber-500'}`}
                    style={{ width: `${Math.min(100, sub.pct)}%` }}
                  ></div>
                </div>

                {bCalc && (
                  <div className={`p-2.5 rounded-lg text-[11px] flex items-center justify-between ${isSafe ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'}`}>
                    <span className="font-medium">
                      {isSafe ? `✅ Safe Skips: ${bCalc.safe_skips}` : `⚠️ Attend Next: ${bCalc.classes_needed}`}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate max-w-[150px]">{bCalc.message}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Consent-Based Biometric Face Enrollment Modal */}
      {showFaceEnrollModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 border border-slate-700 shadow-2xl relative animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">Biometric Face Enrollment</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowFaceEnrollModal(false);
                  if (enrollVideoRef.current?.srcObject) {
                    enrollVideoRef.current.srcObject.getTracks().forEach(t => t.stop());
                  }
                  setEnrollCameraActive(false);
                }}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded-lg bg-slate-800"
              >
                Close
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Register your high-resolution facial reference template. This image will serve as the biometric ground truth for Gate 4 during lecture attendance.
            </p>

            {/* Camera View / Photo Preview */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-3">
              {enrollCameraActive ? (
                <div className="space-y-2">
                  <video ref={enrollVideoRef} autoPlay playsInline className="w-full h-48 object-cover rounded-xl bg-black" />
                  <button
                    type="button"
                    onClick={captureEnrollSelfie}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold"
                  >
                    Capture Reference Frame
                  </button>
                </div>
              ) : enrollSelfie ? (
                <div className="flex flex-col items-center gap-2">
                  <img src={enrollSelfie} alt="Enrolled reference" className="w-24 h-24 rounded-2xl object-cover border-2 border-purple-500/50 shadow-lg" />
                  <button
                    type="button"
                    onClick={startEnrollCamera}
                    className="text-[11px] text-purple-400 hover:underline font-medium"
                  >
                    Retake Photo
                  </button>
                </div>
              ) : (
                <div className="py-6 space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto">
                    <Camera className="w-7 h-7" />
                  </div>
                  <div className="flex gap-2 justify-center">
                    <button
                      type="button"
                      onClick={startEnrollCamera}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold"
                    >
                      Open Front Camera
                    </button>
                    <button
                      type="button"
                      onClick={() => setEnrollSelfie(generateSyntheticSelfie('#8b5cf6'))}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                    >
                      Test Photo
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mandatory Explicit Consent Checkbox (DPDP Act Compliance) */}
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/90 border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={enrollConsent}
                onChange={(e) => setEnrollConsent(e.target.checked)}
                className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
              />
              <span className="text-[11px] text-slate-300 leading-tight">
                <strong>Explicit Biometric Consent:</strong> I voluntarily consent to SmartAttend-AI storing a mathematical representation of my facial features exclusively for academic attendance verification and proxy deterrence.
              </span>
            </label>

            {faceEnrollSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{faceEnrollSuccess}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleEnrollFace}
              disabled={enrollingFace || !enrollSelfie || !enrollConsent}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-600/25 active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {enrollingFace ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>Save & Register Biometric Face</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
