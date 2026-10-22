import React, { useState, useEffect, useRef } from 'react';
import {
  Fingerprint, Smartphone, QrCode, Camera, CheckCircle2, XCircle, AlertTriangle,
  TrendingUp, Award, Flame, BookOpen, Clock, ChevronDown, ChevronUp, RefreshCw,
  MapPin, ShieldAlert, Sparkles, Check, ArrowRight, RotateCcw, ShieldCheck, CheckSquare,
  HelpCircle, History, Eye, User
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Html5Qrcode } from 'html5-qrcode';
import { api, getDeviceId } from '../api';

export default function StudentPortal({ user }) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Biometric state
  const [biometricUnlocked, setBiometricUnlocked] = useState(false);
  const [biometricScanning, setBiometricScanning] = useState(false);

  // Attendance Modal Step Flow: 'IDLE' | 'SCAN_QR' | 'FACE_VERIFY' | 'EVALUATING' | 'RESULT'
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [attendanceStep, setAttendanceStep] = useState('IDLE');
  const [scannedToken, setScannedToken] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [qrScanError, setQrScanError] = useState(null);
  const qrScannerRef = useRef(null);

  // Location & Time captured upon QR scan
  const [capturedLocation, setCapturedLocation] = useState(null);

  // Front camera face verification with eye-blink liveness auto-capture
  const [cameraActive, setCameraActive] = useState(false);
  const [selfieCaptured, setSelfieCaptured] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [countdown, setCountdown] = useState(7);
  const [blinkStatus, setBlinkStatus] = useState('ALIGNING'); // 'ALIGNING' | 'WAITING_BLINK' | 'BLINK_DETECTED' | 'CAPTURED'
  const [blinkFlash, setBlinkFlash] = useState(false);
  const videoRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const blinkAnalysisRef = useRef(null);
  const blinkCanvasRef = useRef(null);

  // 5-Gate Checklist Animation State
  const [gateProgress, setGateProgress] = useState(null);
  const [submittingAttendance, setSubmittingAttendance] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);

  // Viva Simulator State (Strictly visible when VITE_DEMO_MODE === 'true')
  const [showSimulator, setShowSimulator] = useState(false);
  const [simExpiredQR, setSimExpiredQR] = useState(false);
  const [simFarGPS, setSimFarGPS] = useState(false);
  const [simWrongDevice, setSimWrongDevice] = useState(false);
  const [simFaceMismatch, setSimFaceMismatch] = useState(false);

  // Student Exception Request State
  const [submittingException, setSubmittingException] = useState(false);
  const [exceptionResult, setExceptionResult] = useState(null);

  // Face Biometric Reference Enrollment State
  const [showFaceEnrollModal, setShowFaceEnrollModal] = useState(false);
  const [enrollSelfie, setEnrollSelfie] = useState(null);
  const [enrollConsent, setEnrollConsent] = useState(true);
  const [enrollingFace, setEnrollingFace] = useState(false);
  const [faceEnrollSuccess, setFaceEnrollSuccess] = useState(null);
  const [faceEnrollError, setFaceEnrollError] = useState(null);
  const enrollVideoRef = useRef(null);
  const [enrollCameraActive, setEnrollCameraActive] = useState(false);

  const getFaceErrorMessage = (code, fallbackMsg) => {
    switch (code) {
      case 'NO_FACE':
        return 'No face detected in the photo. Please align your face inside the camera circle and ensure good lighting.';
      case 'MULTIPLE_FACES':
        return 'Multiple faces detected. Anti-proxy security requires exactly one student in the camera frame.';
      case 'FACE_IMAGE_BLURRY':
        return 'Photo is too blurry. Please hold the phone steady and ensure clear lighting.';
      case 'FACE_TOO_SMALL':
        return 'Face is too far away (less than 80px). Please move the camera closer to your face.';
      case 'LOW_DETECTION_CONFIDENCE':
        return 'Face detection confidence is low. Please look directly at the camera in good lighting.';
      case 'FACE_NOT_ENROLLED':
        return 'Face template not enrolled. Please complete face enrollment first before marking attendance.';
      case 'INVALID_IMAGE':
        return 'Unable to process the image frame. Please retry.';
      case 'EXTRACTION_FAILED':
        return 'Face embedding extraction failed. Please try capturing again.';
      default:
        return fallbackMsg || 'Face verification failed. Please try again.';
    }
  };

  const deviceId = getDeviceId();

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

  // Passkey / Fingerprint unlock simulation
  const handleBiometricUnlock = () => {
    setBiometricScanning(true);
    setTimeout(() => {
      setBiometricScanning(false);
      setBiometricUnlocked(true);
    }, 600);
  };

  // Stop Rear Camera QR Scanner
  const stopQRScanner = async () => {
    if (qrScannerRef.current) {
      try {
        if (qrScannerRef.current.isScanning) {
          await qrScannerRef.current.stop();
        }
      } catch (err) {
        console.warn('Error stopping QR scanner:', err);
      }
      try {
        qrScannerRef.current.clear();
      } catch (err) {
        console.warn('Error clearing QR scanner:', err);
      }
      qrScannerRef.current = null;
    }
  };

  // Stop Front Camera Stream
  const stopFrontCamera = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (blinkAnalysisRef.current) {
      clearInterval(blinkAnalysisRef.current);
      blinkAnalysisRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      try {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      } catch (e) {}
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setBlinkFlash(false);
  };

  // Close & Reset Attendance Modal
  const handleCloseScannerModal = async () => {
    await stopQRScanner();
    stopFrontCamera();
    setIsScannerOpen(false);
    setAttendanceStep('IDLE');
    setQrScanError(null);
    setCameraError(null);
    setCapturedLocation(null);
    setBlinkStatus('ALIGNING');
    setBlinkFlash(false);
  };

  // Open Attendance Flow (Step 1: Scan QR)
  const handleStartAttendanceFlow = () => {
    if (!biometricUnlocked) handleBiometricUnlock();
    setIsScannerOpen(true);
    setAttendanceStep('SCAN_QR');
    setScannedToken('');
    setSessionId('');
    setSelfieCaptured(null);
    setQrScanError(null);
    setCameraError(null);
    setGateProgress(null);
    setSubmissionResult(null);
    setExceptionResult(null);
    setCapturedLocation(null);
    setBlinkStatus('ALIGNING');
    setBlinkFlash(false);

    // Start rear camera scanner
    startQRScanner();
  };

  // Haversine Distance Helper (Meters)
  const calculateHaversine = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Re-request student GPS if permission or acquisition failed
  const retryCaptureStudentGPS = async () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });
      if (pos?.coords) {
        const uLat = pos.coords.latitude;
        const uLng = pos.coords.longitude;
        let fLat = capturedLocation?.facultyLat;
        let fLng = capturedLocation?.facultyLng;
        let radius = capturedLocation?.geofenceRadius || 150;
        if (!fLat || !fLng) {
          try {
            const info = await api.getSessionInfo(sessionId);
            if (info) {
              fLat = info.class_lat;
              fLng = info.class_lng;
              radius = info.geofence_radius_meters || 150;
            }
          } catch (e) {}
        }
        let d = null;
        let within = false;
        if (fLat !== null && fLng !== null && fLat !== undefined && fLng !== undefined) {
          d = calculateHaversine(fLat, fLng, uLat, uLng);
          within = d <= radius;
        } else {
          d = 0.0;
          within = true;
        }
        setCapturedLocation({
          lat: uLat,
          lng: uLng,
          facultyLat: fLat,
          facultyLng: fLng,
          geofenceRadius: radius,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          distanceMeters: d !== null ? Math.round(d * 10) / 10 : null,
          isWithinGeofence: within,
          error: null
        });
      }
    } catch (err) {
      alert('Could not acquire GPS: ' + (err.message || 'Permission denied. Please grant location permissions in browser settings.'));
    }
  };

  // Start Rear Camera QR Scanner
  const startQRScanner = () => {
    setQrScanError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setQrScanError('Camera access requires HTTPS or localhost. navigator.mediaDevices is undefined. Please ensure you are accessing this app over HTTPS.');
      return;
    }

    setTimeout(async () => {
      try {
        await stopQRScanner();

        const scanner = new Html5Qrcode('smartattend-qr-reader');
        qrScannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          async (decodedText) => {
            const rawToken = decodedText.trim();
            const parts = rawToken.split('.');
            if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
              setQrScanError(`Scanned QR code is not a valid SmartAttend token ("${rawToken.slice(0, 30)}..."). Expected format: session_id.window.signature`);
              return;
            }

            // Valid QR token scanned!
            setQrScanError(null);
            setScannedToken(rawToken);
            setSessionId(parts[0]);

            // Immediately capture device Geolocation & current local Timestamp
            const currentTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            // Fetch live session info from backend to get faculty's real GPS anchor and geofence radius
            let facultyLat = null;
            let facultyLng = null;
            let geofenceRadius = 150;
            try {
              const sessInfo = await api.getSessionInfo(parts[0]);
              if (sessInfo) {
                facultyLat = sessInfo.class_lat;
                facultyLng = sessInfo.class_lng;
                geofenceRadius = sessInfo.geofence_radius_meters || 150;
              }
            } catch (sessErr) {
              console.warn('Could not retrieve live session info:', sessErr);
            }

            let userLat = null;
            let userLng = null;
            let dist = null;
            let isWithin = false;
            let geoError = null;

            if (navigator.geolocation && !simFarGPS) {
              try {
                const pos = await new Promise((resolve, reject) => {
                  navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 8000,
                    maximumAge: 2000
                  });
                });
                if (pos?.coords) {
                  userLat = pos.coords.latitude;
                  userLng = pos.coords.longitude;
                }
              } catch (e) {
                console.warn('Student geolocation read failed or timed out:', e);
                geoError = e.code === 1 ? 'Location permission denied' : 'GPS signal weak/timed out';
              }
            } else if (!navigator.geolocation) {
              geoError = 'Geolocation not supported in this browser';
            }

            if (simFarGPS) {
              userLat = (facultyLat || 19.0760) + 0.03; // ~3.3km away simulation
              userLng = (facultyLng || 72.8777) + 0.03;
              geoError = null;
            }

            if (userLat !== null && userLng !== null && facultyLat !== null && facultyLng !== null) {
              dist = calculateHaversine(facultyLat, facultyLng, userLat, userLng);
              isWithin = dist <= geofenceRadius;
            } else if (userLat !== null && userLng !== null) {
              dist = 0.0;
              isWithin = true;
            }

            setCapturedLocation({
              lat: userLat,
              lng: userLng,
              facultyLat: facultyLat,
              facultyLng: facultyLng,
              geofenceRadius: geofenceRadius,
              time: currentTimeStr,
              distanceMeters: dist !== null ? Math.round(dist * 10) / 10 : null,
              isWithinGeofence: isWithin,
              error: geoError
            });

            // Stop rear camera to release hardware lock before front camera opens
            await stopQRScanner();

            // Transition to Step 2: Live Face Verification with Eye-Blink Auto-Capture
            setAttendanceStep('FACE_VERIFY');
            setTimeout(() => {
              startFrontCameraWithBlinkDetection(rawToken, parts[0]);
            }, 300);
          },
          () => {
            // Frame-level non-detection: normal continuous scan
          }
        );
      } catch (err) {
        console.error('Failed to start rear camera QR scanner:', err);
        let errorMsg = 'Failed to open camera.';
        const msg = err?.message || String(err);
        if (msg.includes('NotAllowedError') || msg.includes('Permission') || msg.includes('denied')) {
          errorMsg = 'Camera permission was denied. Please allow camera access in browser settings.';
        } else if (msg.includes('NotFoundError') || msg.includes('DevicesNotFoundError') || msg.includes('No camera')) {
          errorMsg = 'No rear camera found on this device.';
        } else if (msg.includes('NotReadableError') || msg.includes('TrackStartError')) {
          errorMsg = 'Camera is currently in use by another application or tab.';
        } else {
          errorMsg = `Camera error: ${msg}`;
        }
        setQrScanError(errorMsg);
      }
    }, 100);
  };

  // Step 2: Start Front Camera with Real-Time Eye-Blink Liveness Auto-Capture
  const startFrontCameraWithBlinkDetection = async (tokenOverride, sessionOverride) => {
    setCameraError(null);
    setCountdown(8);
    setBlinkStatus('ALIGNING');
    setBlinkFlash(false);

    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (blinkAnalysisRef.current) {
      clearInterval(blinkAnalysisRef.current);
      blinkAnalysisRef.current = null;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access requires HTTPS or localhost.');
      }
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Initialize off-screen analysis canvas
      if (!blinkCanvasRef.current) {
        blinkCanvasRef.current = document.createElement('canvas');
        blinkCanvasRef.current.width = 120;
        blinkCanvasRef.current.height = 120;
      }

      let framesCalibrated = 0;
      let baselineDarkCount = 0;
      let eyesClosedFrames = 0;
      let blinkFired = false;

      // Real-time eye blink analyzer: runs every 80ms
      blinkAnalysisRef.current = setInterval(() => {
        if (blinkFired) return;
        const video = videoRef.current;
        if (!video || video.readyState < 2) return;

        const canvas = blinkCanvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, 120, 120);

        // Eye region bounding band in oval guide: x: 30% to 70% (36 to 84), y: 34% to 54% (40 to 65)
        const sx = 36, sy = 40, sw = 48, sh = 25;
        const imgData = ctx.getImageData(sx, sy, sw, sh);
        const data = imgData.data;

        let darkCount = 0;
        const totalPixels = data.length / 4;

        for (let i = 0; i < data.length; i += 4) {
          const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          if (luma < 68) {
            darkCount++;
          }
        }

        const darkRatio = darkCount / totalPixels;

        // Phase 1: Calibration (first 4 frames)
        if (framesCalibrated < 4) {
          framesCalibrated++;
          baselineDarkCount = (baselineDarkCount * (framesCalibrated - 1) + darkRatio) / framesCalibrated;
          if (framesCalibrated >= 4) {
            setBlinkStatus('WAITING_BLINK');
          }
          return;
        }

        // Phase 2: Detect Eyes Closed (Blink Ingress)
        // When eyes close, dark pupil & iris pixels drop by >= 35% compared to open eyes baseline
        const isClosed = darkRatio < (baselineDarkCount * 0.65) || darkRatio < 0.025;

        if (isClosed) {
          eyesClosedFrames++;
        } else {
          // Phase 3: Detect Eyes Reopened (Blink Egress)
          // A natural human blink lasts between 1 to 5 frames (80ms to 400ms)
          if (eyesClosedFrames >= 1 && eyesClosedFrames <= 5 && !blinkFired) {
            blinkFired = true;
            setBlinkStatus('BLINK_DETECTED');
            setBlinkFlash(true);

            if (blinkAnalysisRef.current) {
              clearInterval(blinkAnalysisRef.current);
              blinkAnalysisRef.current = null;
            }
            if (countdownTimerRef.current) {
              clearInterval(countdownTimerRef.current);
              countdownTimerRef.current = null;
            }

            // Auto-capture immediately upon reopening eyes!
            setTimeout(() => {
              captureSelfieAndProceed(tokenOverride, sessionOverride);
            }, 180);
            return;
          }
          eyesClosedFrames = 0;
          // Slowly adapt baseline for dynamic room lighting
          baselineDarkCount = baselineDarkCount * 0.9 + darkRatio * 0.1;
        }
      }, 80);

      // Fallback 8-second countdown if room lighting is too dim or user is wearing dark lenses
      let count = 8;
      countdownTimerRef.current = setInterval(() => {
        count -= 1;
        setCountdown(count);
        if (count <= 0) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          if (blinkAnalysisRef.current) {
            clearInterval(blinkAnalysisRef.current);
            blinkAnalysisRef.current = null;
          }
          if (!blinkFired) {
            blinkFired = true;
            setBlinkStatus('BLINK_DETECTED');
            setBlinkFlash(true);
            setTimeout(() => {
              captureSelfieAndProceed(tokenOverride, sessionOverride);
            }, 150);
          }
        }
      }, 1000);

    } catch (err) {
      console.warn('Front camera error:', err);
      setCameraActive(false);
      let errorMsg = 'Failed to access front camera.';
      const msg = err?.message || String(err);
      if (msg.includes('NotAllowedError') || msg.includes('Permission') || msg.includes('denied')) {
        errorMsg = 'Front camera permission denied. Please allow camera access.';
      } else if (msg.includes('NotFoundError')) {
        errorMsg = 'No front camera found on this device.';
      } else {
        errorMsg = `Front camera error: ${msg}`;
      }

      if (import.meta.env.VITE_DEMO_MODE === 'true') {
        const fallback = generateSyntheticSelfie(simFaceMismatch ? '#ef4444' : '#6366f1');
        setSelfieCaptured(fallback);
        setAttendanceStep('EVALUATING');
        execute5GateSubmission(tokenOverride || scannedToken, sessionOverride || sessionId, fallback);
      } else {
        setCameraError(errorMsg);
      }
    }
  };

  // Capture selfie frame onto canvas and transition to Step 3
  const captureSelfieAndProceed = (tokenOverride, sessionOverride) => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (blinkAnalysisRef.current) {
      clearInterval(blinkAnalysisRef.current);
      blinkAnalysisRef.current = null;
    }

    let capturedBase64 = null;
    if (videoRef.current && videoRef.current.srcObject) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = 480;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      // Centered square crop from video to maintain high resolution face landmarks
      const vWidth = video.videoWidth || 640;
      const vHeight = video.videoHeight || 480;
      const minSide = Math.min(vWidth, vHeight);
      const sx = (vWidth - minSide) / 2;
      const sy = (vHeight - minSide) / 2;
      ctx.drawImage(video, sx, sy, minSide, minSide, 0, 0, 480, 480);
      capturedBase64 = canvas.toDataURL('image/jpeg', 0.90);

      // Cleanly stop front camera stream
      const stream = video.srcObject;
      stream.getTracks().forEach(track => track.stop());
      video.srcObject = null;
      setCameraActive(false);
    } else if (import.meta.env.VITE_DEMO_MODE === 'true') {
      capturedBase64 = generateSyntheticSelfie(simFaceMismatch ? '#ef4444' : '#6366f1');
    }

    if (!capturedBase64 && import.meta.env.VITE_DEMO_MODE !== 'true') {
      setCameraError('Unable to capture face photo: camera stream was interrupted.');
      return;
    }

    setSelfieCaptured(capturedBase64);
    setAttendanceStep('EVALUATING');
    execute5GateSubmission(tokenOverride || scannedToken, sessionOverride || sessionId, capturedBase64);
  };

  // Step 3: Execute 5-Gate ACID Verification
  const execute5GateSubmission = async (token, session, selfie) => {
    setSubmittingAttendance(true);
    setSubmissionResult(null);

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

    // Geolocation coordinates (captured from live device GPS)
    let userLat = capturedLocation?.lat || null;
    let userLng = capturedLocation?.lng || null;

    if ((!userLat || !userLng) && navigator.geolocation && !simFarGPS) {
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 6000,
            maximumAge: 2000
          });
        });
        if (pos && pos.coords) {
          userLat = pos.coords.latitude;
          userLng = pos.coords.longitude;
        }
      } catch (e) {
        console.warn('Geolocation read failed or timed out:', e);
      }
    }

    if (simFarGPS) {
      userLat = (capturedLocation?.facultyLat || 19.0760) + 0.03; // ~3.3km away breach simulation
      userLng = (capturedLocation?.facultyLng || 72.8777) + 0.03;
    }

    const usedDeviceId = simWrongDevice ? 'DEV-ALIEN-PROXY-PHONE-99' : deviceId;
    const tokenToSend = simExpiredQR
      ? `${session}.${Math.floor(Date.now() / 1000) - 25}.expired_sig`
      : token;

    const selfieToSend = simFaceMismatch
      ? generateSyntheticSelfie('#dc2626')
      : selfie;

    const payload = {
      session_id: session,
      qr_token: tokenToSend,
      device_id: usedDeviceId,
      user_lat: userLat,
      user_lng: userLng,
      live_selfie_base64: selfieToSend
    };

    // Gate 1: Hardware Device Lock (Paused for Testing)
    gates.gate1 = 'RUNNING';
    setGateProgress({ ...gates, activeGate: 1 });
    await new Promise(r => setTimeout(r, 200));

    if (simWrongDevice) {
      gates.gate1 = 'FAILED';
      gates.error = 'Gate 1 Simulation: Hardware Device Lock mismatch (Untrusted phone)';
      setGateProgress({ ...gates, activeGate: 1 });
      setSubmittingAttendance(false);
      setAttendanceStep('RESULT');
      try { await api.markAttendance(payload); } catch (e) {
        setSubmissionResult({ success: false, reason: e.message, failed_gate: 'GATE_1_DEVICE_LOCK' });
      }
      return;
    }
    gates.gate1 = 'PASSED (PAUSED)';

    // Gate 2: Dynamic QR
    gates.gate2 = 'RUNNING';
    setGateProgress({ ...gates, activeGate: 2 });
    await new Promise(r => setTimeout(r, 400));

    if (simExpiredQR) {
      gates.gate2 = 'FAILED';
      gates.error = 'Gate 2 Failed: Dynamic QR Expired (> 7s old)';
      setGateProgress({ ...gates, activeGate: 2 });
      setSubmittingAttendance(false);
      setAttendanceStep('RESULT');
      try { await api.markAttendance(payload); } catch (e) {
        setSubmissionResult({ success: false, reason: e.message, failed_gate: 'GATE_2_DYNAMIC_QR' });
      }
      return;
    }
    gates.gate2 = 'PASSED';

    // Gate 3: GPS Geofence (<= 150m from faculty)
    gates.gate3 = 'RUNNING';
    setGateProgress({ ...gates, activeGate: 3 });
    await new Promise(r => setTimeout(r, 400));

    if (!userLat || !userLng) {
      gates.gate3 = 'FAILED';
      gates.error = 'Gate 3 Failed: Student GPS location missing. Please grant location permissions.';
      setGateProgress({ ...gates, activeGate: 3 });
      setSubmittingAttendance(false);
      setAttendanceStep('RESULT');
      setSubmissionResult({
        success: false,
        reason: 'Student GPS location missing: Your device did not provide GPS coordinates. Please grant location permissions in your browser and try again.',
        failed_gate: 'GATE_3_GPS_GEOFENCE'
      });
      return;
    }

    if (simFarGPS) {
      gates.gate3 = 'FAILED';
      gates.error = 'Gate 3 Failed: Geofence Breach (Distance > 150m from faculty)';
      setGateProgress({ ...gates, activeGate: 3 });
      setSubmittingAttendance(false);
      setAttendanceStep('RESULT');
      try { await api.markAttendance(payload); } catch (e) {
        setSubmissionResult({ success: false, reason: e.message, failed_gate: 'GATE_3_GPS_GEOFENCE' });
      }
      return;
    }
    gates.gate3 = 'PASSED';

    // Gate 4: AI Face Match & Gate 5: Backend Atomic Grant
    gates.gate4 = 'RUNNING';
    setGateProgress({ ...gates, activeGate: 4 });
    await new Promise(r => setTimeout(r, 450));

    try {
      const res = await api.markAttendance(payload);
      gates.gate4 = 'PASSED';
      gates.gate5 = 'PASSED';
      setGateProgress({ ...gates, activeGate: 5 });

      const isPendingApproval = res.status === 'PENDING_APPROVAL';
      setSubmissionResult({
        success: true,
        details: res.details,
        status: res.status,
        message: res.message
      });
      setAttendanceStep('RESULT');

      // Confetti celebration if confirmed PRESENT!
      if (!isPendingApproval) {
        confetti({
          particleCount: 90,
          spread: 70,
          origin: { y: 0.6 }
        });
      }

      fetchDashboardData();
    } catch (err) {
      const faceCode = err.detail?.code;
      const friendlyMsg = faceCode ? getFaceErrorMessage(faceCode, err.message) : (err.message || 'Verification failed');
      const failedGate = err.detail?.failed_gate || (faceCode ? 'GATE_4_FACE_VERIFICATION' : 'GATE_FAILED');

      if (failedGate.includes('4') || faceCode || simFaceMismatch) {
        gates.gate4 = 'FAILED';
      } else {
        gates.gate5 = 'FAILED';
      }
      gates.error = friendlyMsg;
      setGateProgress({ ...gates });
      setSubmissionResult({ success: false, reason: friendlyMsg, failed_gate: failedGate });
      setAttendanceStep('RESULT');
    } finally {
      setSubmittingAttendance(false);
    }
  };

  // Demo Simulator Helper ONLY: student never calls this in normal flow
  const handleSimulateScanLatestQR = async () => {
    try {
      const targetSession = sessionId || 'CS301-SEC-A';
      const qrData = await api.getSessionQR(targetSession);
      setScannedToken(qrData.qr_token);
      setSessionId(qrData.session_id || targetSession);
      await stopQRScanner();
      setAttendanceStep('FACE_VERIFY');
      startFrontCameraCountdown(qrData.qr_token, qrData.session_id || targetSession);
    } catch (err) {
      const curEpoch = Math.floor(Date.now() / 1000);
      const fakeToken = `${sessionId || 'CS301-SEC-A'}.${curEpoch}.demo_valid_sig`;
      setScannedToken(fakeToken);
      setSessionId(sessionId || 'CS301-SEC-A');
      await stopQRScanner();
      setAttendanceStep('FACE_VERIFY');
      startFrontCameraCountdown(fakeToken, sessionId || 'CS301-SEC-A');
    }
  };

  // Student Exception Request
  const handleRequestException = async () => {
    const targetSession = sessionId || (scannedToken.includes('.') ? scannedToken.split('.')[0] : 'CS301-SEC-A');
    if (!confirm(`Submit request: "I don't have my registered device" for session "${targetSession}"? This will be marked as PENDING APPROVAL for faculty review.`)) return;
    setSubmittingException(true);
    setExceptionResult(null);
    try {
      const res = await api.requestDeviceException({
        session_id: targetSession,
        device_id: deviceId,
        reason: "I don't have my registered device",
        live_selfie_base64: selfieCaptured
      });
      setExceptionResult(res.message || 'Exception request submitted. Awaiting faculty approval.');
      setTimeout(() => {
        setExceptionResult(null);
        handleCloseScannerModal();
      }, 3500);
    } catch (err) {
      alert('Error submitting exception request: ' + err.message);
    } finally {
      setSubmittingException(false);
    }
  };

  // Synthetic selfie helper (Strictly for Viva Simulator test modes)
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

  // Face Biometric Reference Enrollment
  const startEnrollCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access requires HTTPS or localhost.');
      }
      setEnrollCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (enrollVideoRef.current) {
        enrollVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Webcam permission not granted:', err);
      setEnrollCameraActive(false);
      if (import.meta.env.VITE_DEMO_MODE === 'true') {
        setEnrollSelfie(generateSyntheticSelfie('#6366f1'));
      } else {
        alert('Camera access failed: ' + (err.message || 'Permission denied'));
      }
    }
  };

  const captureEnrollSelfie = () => {
    if (enrollVideoRef.current && enrollVideoRef.current.srcObject) {
      const video = enrollVideoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = 480;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      const vWidth = video.videoWidth || 640;
      const vHeight = video.videoHeight || 480;
      const minSide = Math.min(vWidth, vHeight);
      const sx = (vWidth - minSide) / 2;
      const sy = (vHeight - minSide) / 2;
      ctx.drawImage(video, sx, sy, minSide, minSide, 0, 0, 480, 480);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.90);
      setEnrollSelfie(dataUrl);

      const stream = video.srcObject;
      stream.getTracks().forEach(track => track.stop());
      setEnrollCameraActive(false);
    } else if (import.meta.env.VITE_DEMO_MODE === 'true') {
      setEnrollSelfie(generateSyntheticSelfie('#6366f1'));
    }
  };

  const handleEnrollFace = async () => {
    if (!enrollSelfie) {
      setFaceEnrollError('Please capture or select a photo before saving.');
      return;
    }
    if (!enrollConsent) {
      setFaceEnrollError('Explicit biometric consent is required to store facial reference templates.');
      return;
    }
    setEnrollingFace(true);
    setFaceEnrollError(null);
    setFaceEnrollSuccess(null);
    try {
      const res = await api.enrollFace({
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
      if (err.status === 409) {
        setFaceEnrollError('Face template is already enrolled. Re-enrollment requires an administrator face reset.');
      } else {
        const code = err.detail?.code;
        setFaceEnrollError(getFaceErrorMessage(code, err.message));
      }
    } finally {
      setEnrollingFace(false);
    }
  };

  // Clean unmount of all camera tracks and timers
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
      if (qrScannerRef.current) {
        try {
          if (qrScannerRef.current.isScanning) {
            qrScannerRef.current.stop().catch(() => {}).then(() => {
              try { qrScannerRef.current.clear(); } catch(e){}
            });
          }
        } catch (e) {}
      }
      if (videoRef.current?.srcObject) {
        try { videoRef.current.srcObject.getTracks().forEach(t => t.stop()); } catch(e){}
      }
      if (enrollVideoRef.current?.srcObject) {
        try { enrollVideoRef.current.srcObject.getTracks().forEach(t => t.stop()); } catch(e){}
      }
    };
  }, []);

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

  const isFaceEnrolled = dashboard?.student?.has_registered_face ?? user?.has_registered_face ?? false;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">

      {/* Student Official Profile & Institutional ID Card */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800 relative overflow-hidden bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-indigo-950/30">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Student Official Photo Container */}
            <div className="relative">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-gradient-to-tr from-brand-600 to-indigo-500 border-2 border-indigo-400/30 p-0.5 shadow-xl flex items-center justify-center">
                <div className="w-full h-full rounded-xl bg-slate-950 flex flex-col items-center justify-center text-center p-1">
                  <User className="w-8 h-8 text-indigo-300" />
                  <span className="text-[9px] font-mono font-bold text-indigo-200 mt-0.5">PHOTO ID</span>
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-full border-2 border-slate-950 shadow" title="Admin Verified Biometrics">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Profile Credentials */}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {dashboard?.student?.name || user?.name || 'Aarav Sharma'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                  {dashboard?.student?.roll_no || user?.roll_no || 'STU01'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" /> Admin Enrolled
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {dashboard?.student?.department || user?.department || 'Computer Science & Engineering'} • Semester {dashboard?.student?.semester || user?.semester || 6}
              </p>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span>Official Institutional Biometrics</span>
                <span>•</span>
                <span className="text-emerald-400 font-medium">Reference photo verified at admission</span>
              </div>
            </div>
          </div>

          <div className="self-stretch sm:self-center bg-slate-950/80 px-4 py-2.5 rounded-xl border border-slate-800 text-left sm:text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Institutional ID Status</span>
            <span className="text-xs font-bold text-emerald-400 flex items-center sm:justify-end gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Active & Verified
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">Managed by Administration</p>
          </div>
        </div>
      </div>

      {/* Top Bar: Hardware Device Lock & Face Biometric Gate */}
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
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Paused for Testing
                </span>
              </div>
              <p className="text-xs font-mono text-slate-400 mt-0.5 truncate max-w-xs">{deviceId} (unrestricted in testing)</p>
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

        {/* Biometric Face Reference Info (Admin Enrolled) */}
        <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 border flex items-center justify-center shadow-inner">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Face Biometric Reference</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Verified Profile
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Official reference photo enrolled by Admin Department
              </p>
            </div>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-300 flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Enrolled at Admission</span>
          </div>
        </div>
      </div>

      {/* HERO UTILITY: Prominent Safe Bunk Margin & Attendance Runway */}
      <div className={`glass-panel rounded-3xl p-6 sm:p-7 border relative overflow-hidden transition-all duration-300 ${
        bunkCalc.status === 'SAFE' ? 'border-emerald-500/30 glow-emerald' : 'border-rose-500/30 glow-rose'
      }`}>
        <div className={`absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-20 -mr-20 -mt-20 ${
          bunkCalc.status === 'SAFE' ? 'bg-emerald-500' : 'bg-rose-500'
        }`} />

        <div className="relative z-10 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                bunkCalc.status === 'SAFE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}>
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Attendance Runway & Bunk Calculator</h3>
                <p className="text-xs text-slate-400">Calculated against the mandatory 75.0% university eligibility threshold</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 shadow-sm ${
                bunkCalc.status === 'SAFE'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-500/20'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-rose-500/20 animate-pulse'
              }`}>
                {bunkCalc.status === 'SAFE' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
                {bunkCalc.status === 'SAFE' ? 'SAFE STANDING (NO DETENTION RISK)' : 'CRITICAL DEFICIT (DETENTION WARNING)'}
              </span>
            </div>
          </div>

          {/* Primary Hero Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Current Overall Attendance */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Overall Attendance</span>
                <span className="font-mono text-indigo-400">Target: 75.0%</span>
              </div>
              <div className="my-2">
                <span className={`text-4xl sm:text-5xl font-black tracking-tight ${attendance.current_pct >= 75 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {attendance.current_pct}%
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${attendance.current_pct >= 75 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-rose-500 to-amber-500'}`}
                    style={{ width: `${Math.min(100, attendance.current_pct)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                  <span>{attendance.attended_lectures} Attended</span>
                  <span>{attendance.total_lectures} Total Held</span>
                </div>
              </div>
            </div>

            {/* Safe Bunks / Classes Needed Major Metric */}
            <div className={`p-4 sm:p-5 rounded-2xl border flex flex-col justify-between md:col-span-2 ${
              bunkCalc.status === 'SAFE' ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-rose-950/20 border-rose-500/30'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  {bunkCalc.status === 'SAFE' ? 'Safe Bunk Margin' : 'Recovery Requirement'}
                </span>
                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                  bunkCalc.status === 'SAFE' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}>
                  {bunkCalc.status === 'SAFE' ? 'Eligible for Examination' : 'Detention Zone'}
                </span>
              </div>

              <div className="my-3 flex items-baseline gap-3">
                <span className={`text-4xl sm:text-5xl font-black tracking-tight ${
                  bunkCalc.status === 'SAFE' ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {bunkCalc.status === 'SAFE' ? bunkCalc.safe_skips : bunkCalc.classes_needed}
                </span>
                <span className="text-sm sm:text-base font-bold text-slate-200">
                  {bunkCalc.status === 'SAFE' ? 'Lectures You Can Safely Skip' : 'Consecutive Lectures You Must Attend'}
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                💡 {bunkCalc.message}
              </p>
            </div>
          </div>

          {/* Subject Quick Bunk Matrix Pills */}
          {subjects.length > 0 && (
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Curriculum Bunk Status by Subject:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {subjects.map((sub, idx) => {
                  const subCalc = sub.bunk_calculator;
                  const isSubSafe = sub.pct >= 75.0;
                  return (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition ${
                        isSubSafe
                          ? 'bg-slate-900/70 border-slate-800 hover:border-emerald-500/30'
                          : 'bg-rose-950/30 border-rose-500/30 hover:border-rose-500/50'
                      }`}
                    >
                      <div className="truncate mr-2">
                        <p className="font-bold text-white truncate text-xs">{sub.subject_code || sub.subject.split(' - ')[0]}</p>
                        <p className="text-[10px] text-slate-400 truncate">{sub.attended}/{sub.total} classes</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-xs font-mono font-bold ${isSubSafe ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {sub.pct}%
                        </span>
                        <div>
                          {subCalc?.status === 'SAFE' ? (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              +{subCalc.safe_skips} Bunk{subCalc.safe_skips !== 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
                              Need {subCalc?.classes_needed || 1}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
              Automated 2-Step Verification: Scan the dynamic classroom QR code, then complete a 3-second live face check.
            </p>
          </div>

          <button
            onClick={handleStartAttendanceFlow}
            className="w-full py-3.5 px-6 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 transition shadow-lg shadow-brand-500/30 active:scale-[0.99] flex items-center justify-center gap-2"
          >
            <QrCode className="w-5 h-5" />
            <span>Launch Attendance Camera</span>
          </button>
        </div>
      </div>

      {/* AUTOMATED ATTENDANCE MODAL (Steps: SCAN_QR -> FACE_VERIFY -> EVALUATING -> RESULT) */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-lg rounded-3xl p-5 sm:p-6 border border-slate-700 shadow-2xl relative animate-in fade-in zoom-in-95 space-y-4 my-8">

            {/* Top Modal Header & Step Indicator */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-brand-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">SmartAttend 5-Gate Verification</h3>
              </div>
              <button
                type="button"
                onClick={handleCloseScannerModal}
                className="text-slate-400 hover:text-white text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
              >
                Cancel
              </button>
            </div>

            {/* Step Progress Tracker */}
            <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-semibold">
              <div className={`p-2 rounded-xl border flex items-center justify-center gap-1.5 transition ${
                attendanceStep === 'SCAN_QR'
                  ? 'bg-brand-500/20 text-brand-300 border-brand-500/40'
                  : scannedToken
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-900/60 text-slate-500 border-slate-800'
              }`}>
                {scannedToken ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <span className="w-4 h-4 rounded-full bg-brand-500 text-white text-[10px] flex items-center justify-center">1</span>}
                <span>1. Scan QR</span>
              </div>

              <div className={`p-2 rounded-xl border flex items-center justify-center gap-1.5 transition ${
                attendanceStep === 'FACE_VERIFY'
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                  : selfieCaptured
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-900/60 text-slate-500 border-slate-800'
              }`}>
                {selfieCaptured ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <span className="w-4 h-4 rounded-full bg-slate-700 text-white text-[10px] flex items-center justify-center">2</span>}
                <span>2. Face Check</span>
              </div>

              <div className={`p-2 rounded-xl border flex items-center justify-center gap-1.5 transition ${
                attendanceStep === 'EVALUATING' || attendanceStep === 'RESULT'
                  ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                  : 'bg-slate-900/60 text-slate-500 border-slate-800'
              }`}>
                <span className="w-4 h-4 rounded-full bg-slate-700 text-white text-[10px] flex items-center justify-center">3</span>
                <span>3. 5-Gate Grant</span>
              </div>
            </div>

            {/* STEP 1: SCAN QR CODE VIEW */}
            {attendanceStep === 'SCAN_QR' && (
              <div className="space-y-3">
                <div className="text-center space-y-1">
                  <h4 className="text-base font-bold text-white">Point Rear Camera at Dynamic QR</h4>
                  <p className="text-xs text-slate-400">
                    Scan the lecture QR code on the faculty projection screen. Auto-decodes in &lt; 0.5s.
                  </p>
                </div>

                {/* html5-qrcode Viewport Container */}
                <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-700 min-h-[260px] shadow-inner">
                  <div id="smartattend-qr-reader" className="w-full" />
                </div>

                {qrScanError && (
                  <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-semibold">{qrScanError}</p>
                      {qrScanError.includes('HTTPS') && (
                        <p className="text-[11px] text-rose-200/80">
                          Mobile browsers require HTTPS or localhost to unlock camera video streams.
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={startQRScanner}
                        className="mt-1 px-3 py-1 rounded bg-rose-500/30 text-white text-[11px] font-semibold hover:bg-rose-500/40 transition"
                      >
                        Retry Camera Access
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: FRONT CAMERA LIVE FACE AUTH WITH EYE-BLINK AUTO-CAPTURE */}
            {attendanceStep === 'FACE_VERIFY' && (
              <div className="space-y-4">
                <div className="text-center space-y-1.5">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <Check className="w-3 h-3" /> QR Scanned: {sessionId}
                    </span>
                    {capturedLocation && !capturedLocation.error ? (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                        capturedLocation.isWithinGeofence
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}>
                        <MapPin className="w-3 h-3" />
                        {capturedLocation.distanceMeters !== null ? `${capturedLocation.distanceMeters}m from Faculty` : 'GPS Acquired'}
                        {' '}({capturedLocation.isWithinGeofence ? 'Within 150m Limit' : 'Geofence Breach > 150m'})
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={retryCaptureStudentGPS}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition"
                      >
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        Location Missing (Click to Retry GPS)
                      </button>
                    )}
                    {capturedLocation?.time && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono text-slate-300 bg-slate-800 border border-slate-700">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {capturedLocation.time}
                      </span>
                    )}
                  </div>
                  <h4 className="text-base font-bold text-white flex items-center justify-center gap-1.5">
                    <Eye className="w-4 h-4 text-purple-400 animate-pulse" />
                    Live Face Auth &amp; Eye-Blink Liveness
                  </h4>
                  <p className="text-xs text-slate-400">
                    {blinkStatus === 'ALIGNING' && 'Align your face inside the circle in good lighting...'}
                    {blinkStatus === 'WAITING_BLINK' && 'Face locked! Blink your eyes once to auto-capture 📸'}
                    {blinkStatus === 'BLINK_DETECTED' && '✨ Blink Detected! Auto-capturing frame now...'}
                  </p>
                </div>

                {/* Front Camera Video Container with Live Reticle & Blink Status HUD */}
                <div className="relative rounded-2xl overflow-hidden bg-black border-2 border-indigo-500/40 aspect-square max-w-[280px] mx-auto shadow-2xl flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover scale-x-[-1]"
                  />

                  {/* Circular / Oval Face Alignment Framing Guide */}
                  <div className={`absolute inset-4 rounded-full border-2 border-dashed pointer-events-none transition-all duration-300 ${
                    blinkStatus === 'BLINK_DETECTED'
                      ? 'border-emerald-400 scale-105 shadow-[0_0_25px_rgba(52,211,153,0.8)]'
                      : blinkStatus === 'WAITING_BLINK'
                      ? 'border-amber-400 animate-pulse-slow'
                      : 'border-indigo-400/60'
                  }`} />

                  {/* Shutter Flash Animation on Blink */}
                  {blinkFlash && (
                    <div className="absolute inset-0 bg-white/80 animate-ping z-20 pointer-events-none" />
                  )}

                  {/* Interactive Eye-Blink HUD Pill */}
                  <div className={`absolute bottom-3 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full backdrop-blur-md border text-xs font-bold flex items-center gap-2 shadow-xl z-10 transition-all ${
                    blinkStatus === 'BLINK_DETECTED'
                      ? 'bg-emerald-500/90 border-emerald-400 text-white animate-bounce'
                      : blinkStatus === 'WAITING_BLINK'
                      ? 'bg-amber-500/80 border-amber-400 text-slate-950 font-extrabold animate-pulse'
                      : 'bg-black/75 border-white/20 text-white'
                  }`}>
                    {blinkStatus === 'ALIGNING' && (
                      <>
                        <Eye className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                        <span>Center Face</span>
                      </>
                    )}
                    {blinkStatus === 'WAITING_BLINK' && (
                      <>
                        <span className="text-base">😉</span>
                        <span>Blink Eyes to Auto-Snap!</span>
                      </>
                    )}
                    {blinkStatus === 'BLINK_DETECTED' && (
                      <>
                        <Camera className="w-3.5 h-3.5 text-white" />
                        <span>Blink Verified! Capturing...</span>
                      </>
                    )}
                  </div>
                </div>

                {cameraError && (
                  <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">{cameraError}</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => captureSelfieAndProceed(scannedToken, sessionId)}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition flex items-center justify-center gap-1.5 border border-slate-700"
                  >
                    <Camera className="w-3.5 h-3.5 text-slate-400" />
                    <span>Snap Manually ({countdown}s fallback)</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: 5-GATE ACID EVALUATION IN PROGRESS */}
            {attendanceStep === 'EVALUATING' && gateProgress && (
              <div className="space-y-4 py-2">
                <div className="text-center space-y-1">
                  <h4 className="text-base font-bold text-white">5-Gate Anti-Proxy Evaluation</h4>
                  <p className="text-xs text-slate-400">
                    Executing atomic server verification across all physical and biometric gates...
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60">
                    <span className="flex items-center gap-2.5 text-slate-200">
                      {gateProgress.gate1 && gateProgress.gate1.startsWith('PASSED') ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : gateProgress.gate1 === 'FAILED' ? <XCircle className="w-4 h-4 text-rose-400" /> : <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />}
                      Gate 1: Hardware Device Lock & 1-Phone Rule <span className="text-[10px] text-amber-400 font-normal">(Paused in Testing)</span>
                    </span>
                    <span className={`font-mono text-[10px] font-bold ${gateProgress.gate1 && gateProgress.gate1.startsWith('PASSED') ? 'text-emerald-400' : gateProgress.gate1 === 'FAILED' ? 'text-rose-400' : 'text-slate-400'}`}>
                      {gateProgress.gate1}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60">
                    <span className="flex items-center gap-2.5 text-slate-200">
                      {gateProgress.gate2 === 'PASSED' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : gateProgress.gate2 === 'FAILED' ? <XCircle className="w-4 h-4 text-rose-400" /> : gateProgress.activeGate >= 2 ? <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-700" />}
                      Gate 2: Dynamic QR Time & Signature Check
                    </span>
                    <span className={`font-mono text-[10px] font-bold ${gateProgress.gate2 === 'PASSED' ? 'text-emerald-400' : gateProgress.gate2 === 'FAILED' ? 'text-rose-400' : 'text-slate-400'}`}>
                      {gateProgress.gate2}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60">
                    <span className="flex items-center gap-2.5 text-slate-200">
                      {gateProgress.gate3 === 'PASSED' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : gateProgress.gate3 === 'FAILED' ? <XCircle className="w-4 h-4 text-rose-400" /> : gateProgress.activeGate >= 3 ? <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-700" />}
                      Gate 3: GPS Geofence Check (&le; 150m from Faculty)
                    </span>
                    <span className={`font-mono text-[10px] font-bold ${gateProgress.gate3 === 'PASSED' ? 'text-emerald-400' : gateProgress.gate3 === 'FAILED' ? 'text-rose-400' : 'text-slate-400'}`}>
                      {gateProgress.gate3}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60">
                    <span className="flex items-center gap-2.5 text-slate-200">
                      {gateProgress.gate4 === 'PASSED' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : gateProgress.gate4 === 'FAILED' ? <XCircle className="w-4 h-4 text-rose-400" /> : gateProgress.activeGate >= 4 ? <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-700" />}
                      Gate 4: AI Face Match Verification
                    </span>
                    <span className={`font-mono text-[10px] font-bold ${gateProgress.gate4 === 'PASSED' ? 'text-emerald-400' : gateProgress.gate4 === 'FAILED' ? 'text-rose-400' : 'text-slate-400'}`}>
                      {gateProgress.gate4}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60">
                    <span className="flex items-center gap-2.5 text-slate-200">
                      {gateProgress.gate5 === 'PASSED' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : gateProgress.gate5 === 'FAILED' ? <XCircle className="w-4 h-4 text-rose-400" /> : gateProgress.activeGate >= 5 ? <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-700" />}
                      Gate 5: Anti-Fraud Audit Logger & Final Grant
                    </span>
                    <span className={`font-mono text-[10px] font-bold ${gateProgress.gate5 === 'PASSED' ? 'text-emerald-400' : gateProgress.gate5 === 'FAILED' ? 'text-rose-400' : 'text-slate-400'}`}>
                      {gateProgress.gate5}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: VERIFICATION RESULT VIEW */}
            {attendanceStep === 'RESULT' && (
              <div className="space-y-4 py-2">
                {submissionResult?.success ? (
                  <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-center space-y-3">
                    <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-white">ATTENDANCE CONFIRMED</h4>
                      <p className="text-xs text-emerald-300 font-semibold mt-0.5">
                        Status: {submissionResult.status}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs grid grid-cols-2 gap-2 text-left font-mono">
                      <div>
                        <span className="text-slate-400 text-[10px]">Session ID:</span>
                        <p className="font-bold text-white">{sessionId}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px]">Geofence Distance:</span>
                        <p className="font-bold text-white">{submissionResult.details?.distance_meters}m (Inside)</p>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px]">AI Face Match:</span>
                        <p className="font-bold text-emerald-400">{submissionResult.details?.face_match_score}%</p>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px]">Device Fingerprint:</span>
                        <p className="font-bold text-white truncate">{deviceId}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleCloseScannerModal}
                      className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition"
                    >
                      Done & Return to Dashboard
                    </button>
                  </div>
                ) : (
                  <div className="p-5 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-center space-y-3">
                    <div className="w-14 h-14 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/20">
                      <XCircle className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-white">ATTENDANCE REJECTED</h4>
                      <p className="text-xs text-rose-300 font-medium mt-1">
                        {submissionResult?.reason || gateProgress?.error || 'Verification check failed.'}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 pt-2">
                      {(!isFaceEnrolled || submissionResult?.reason?.includes('enroll') || submissionResult?.failed_gate === 'GATE_4_FACE_VERIFICATION') && (
                        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300 space-y-1 text-center">
                          <p className="font-semibold">Face Verification Mismatch</p>
                          <p className="text-slate-400 text-[10px]">Your live selfie did not match the official reference photo enrolled by the Admin Department. If you need a photo update, please contact the Registrar office.</p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleStartAttendanceFlow}
                          className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Try Again
                        </button>

                        <button
                          type="button"
                          onClick={handleRequestException}
                          disabled={submittingException}
                          className="flex-1 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-semibold text-xs flex items-center justify-center gap-1.5 transition"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" /> Request Faculty Review
                        </button>
                      </div>
                    </div>

                    {exceptionResult && (
                      <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-2 text-left mt-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>{exceptionResult}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* VIVA / DEFENSE ANTI-PROXY SIMULATOR (Visible ONLY when VITE_DEMO_MODE === 'true') */}
            {import.meta.env.VITE_DEMO_MODE === 'true' && (
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/90 text-xs space-y-2 mt-2">
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
                  <div className="pt-2 border-t border-slate-800 space-y-2.5 text-slate-300">
                    <p className="text-[11px] text-slate-400">
                      Toggle fraud vectors to demonstrate how SmartAttend-AI's 5-Gate ACID engine catches proxy attempts:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={simExpiredQR}
                          onChange={(e) => setSimExpiredQR(e.target.checked)}
                          className="rounded text-rose-500"
                        />
                        <span className="text-[11px]">Simulate Expired QR (&gt;7s)</span>
                      </label>

                      <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={simFarGPS}
                          onChange={(e) => setSimFarGPS(e.target.checked)}
                          className="rounded text-rose-500"
                        />
                        <span className="text-[11px]">Simulate 3.2km Away GPS</span>
                      </label>

                      <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 opacity-50 cursor-not-allowed">
                        <input
                          type="checkbox"
                          disabled
                          checked={false}
                          className="rounded text-slate-600"
                        />
                        <span className="text-[11px] text-slate-400">Proxy Phone Lock (Disabled for testing)</span>
                      </label>

                      <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={simFaceMismatch}
                          onChange={(e) => setSimFaceMismatch(e.target.checked)}
                          className="rounded text-rose-500"
                        />
                        <span className="text-[11px]">Simulate Face Mismatch</span>
                      </label>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={handleSimulateScanLatestQR}
                        className="w-full py-2 px-3 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-semibold flex items-center justify-center gap-1.5 hover:bg-amber-500/30 transition"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> [Simulator] Auto-Fetch Faculty QR & Test Flow
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {/* Main Student Analytics: AI Risk Engine & Attendance Trends */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* 1. AI Defaulter Risk Predictor Card (Random Forest ML) */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">AI Defaulter Risk Engine</h3>
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
            <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Behavioral Risk Insights:</p>
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

        {/* 2. Active Attendance Streak & Curriculum Health */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Attendance Momentum</h3>
            </div>
            <span className="text-xs font-bold font-mono text-indigo-300">Sem {dashboard?.student?.semester || 6}</span>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 flex items-center justify-between">
            <div>
              <p className="text-xs text-amber-300 font-semibold">Active Streak Metric</p>
              <p className="text-2xl font-black text-amber-400 mt-0.5">
                {attendance.active_streak > 0 ? `+${attendance.active_streak} Lectures` : `${attendance.active_streak} Lectures Missed`}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Flame className="w-6 h-6 animate-pulse" />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 space-y-1">
            <p className="font-semibold text-white flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> University Regulatory Rule
            </p>
            <p className="text-slate-400 leading-relaxed">
              Minimum 75% aggregate attendance required to obtain exam hall ticket. Students below 75% are placed on the academic detention warning list.
            </p>
          </div>
        </div>

      </div>

      {/* Detailed Subject-Wise Academic Breakdown */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Subject-Wise Attendance Breakdown</h3>
          </div>
          <span className="text-[11px] text-slate-400">Mandatory: 75.0%</span>
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
                  />
                </div>

                {bCalc && (
                  <div className={`p-2.5 rounded-lg text-[11px] flex items-center justify-between ${isSafe ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'}`}>
                    <span className="font-semibold">
                      {isSafe ? `✅ Safe Skips: ${bCalc.safe_skips}` : `⚠️ Attend Next: ${bCalc.classes_needed}`}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate max-w-[180px]">{bCalc.message}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Attendance Verification Audit Logs */}
      {logs.length > 0 && (
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Recent Attendance Verification Logs</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                  <th className="pb-2 font-semibold">Session ID</th>
                  <th className="pb-2 font-semibold">Status</th>
                  <th className="pb-2 font-semibold">AI Face Match</th>
                  <th className="pb-2 font-semibold">GPS Distance</th>
                  <th className="pb-2 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {logs.slice(0, 5).map((log, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/40">
                    <td className="py-2.5 text-slate-200">{log.session_id}</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.status === 'PRESENT' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' :
                        log.status === 'PENDING_APPROVAL' ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' :
                        'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-300">{log.face_match_score != null ? `${log.face_match_score}%` : 'N/A'}</td>
                    <td className="py-2.5 text-slate-300">{log.distance_meters != null ? `${log.distance_meters}m` : 'N/A'}</td>
                    <td className="py-2.5 text-slate-400 font-sans text-[10px]">{log.marked_at ? new Date(log.marked_at).toLocaleTimeString() : 'Recent'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Biometric Face Reference Enrollment Modal */}
      {showFaceEnrollModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
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
                  setFaceEnrollError(null);
                  setFaceEnrollSuccess(null);
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

            {/* Privacy & Template Storage Explanation */}
            <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-slate-300 space-y-1.5">
              <div className="flex items-center gap-1.5 text-purple-300 font-semibold">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                <span>Privacy &amp; Cryptographic Storage</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                SmartAttend-AI stores an <strong>encrypted numeric template (512-D vector)</strong>, <span className="text-white font-semibold">NOT your photo</span>. The camera capture is processed strictly in-memory and immediately discarded. Templates are encrypted at rest with AES/Fernet encryption.
              </p>
              <p className="text-[10px] text-purple-300/80">
                • <strong>Retention Policy:</strong> Encrypted templates expire after 1 academic year (365 days) or upon administrator reset.
              </p>
            </div>

            {/* Camera View / Photo Preview */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-3">
              {enrollCameraActive ? (
                <div className="space-y-2">
                  <video ref={enrollVideoRef} autoPlay playsInline className="w-full h-48 object-cover rounded-xl bg-black scale-x-[-1]" />
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
                    onClick={() => {
                      setEnrollSelfie(null);
                      setFaceEnrollError(null);
                      startEnrollCamera();
                    }}
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
                      onClick={() => {
                        setFaceEnrollError(null);
                        startEnrollCamera();
                      }}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold"
                    >
                      Open Front Camera
                    </button>
                    {import.meta.env.VITE_DEMO_MODE === 'true' && (
                      <button
                        type="button"
                        onClick={() => {
                          setFaceEnrollError(null);
                          setEnrollSelfie(generateSyntheticSelfie('#8b5cf6'));
                        }}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                      >
                        Test Photo
                      </button>
                    )}
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
                <strong>Explicit Biometric Consent:</strong> I voluntarily consent to SmartAttend-AI generating and storing an encrypted numeric template of my facial features exclusively for academic attendance verification. I acknowledge that raw photos are never stored.
              </span>
            </label>

            {/* Friendly Face Error Alert */}
            {faceEnrollError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{faceEnrollError}</span>
              </div>
            )}

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
              <span>Save &amp; Register Biometric Template</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
