import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Fingerprint, Calendar, Smartphone, QrCode, Camera, CheckCircle2, XCircle, AlertTriangle,
  TrendingUp, Award, Flame, BookOpen, Clock, ChevronDown, ChevronUp, RefreshCw,
  MapPin, ShieldAlert, Sparkles, Check, ArrowRight, RotateCcw, ShieldCheck, CheckSquare,
  HelpCircle, History, Eye, User, Radio, LogOut
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Html5Qrcode } from 'html5-qrcode';
import { api, getDeviceId } from '../api';
import { getFaceLandmarker, analyzeFaceFrame, createBlinkStateMachine, DEFAULT_LIVENESS_CONFIG, prewarmFaceLandmarker } from '../utils/faceLiveness';
import { setInAttendanceFlow } from '../pwa/pwaManager';

// Redesigned Student Mobile UI Components
import StudentBottomNav from './student/StudentBottomNav';
import StudentHomeView from './student/StudentHomeView';
import StudentActiveSessionView from './student/StudentActiveSessionView';
import StudentAttendanceFlow from './student/StudentAttendanceFlow';
import StudentClassesView from './student/StudentClassesView';
import StudentAttendanceHistoryView from './student/StudentAttendanceHistoryView';
import StudentSubjectAttendanceView from './student/StudentSubjectAttendanceView';
import StudentProfileView from './student/StudentProfileView';
import StudentPersonalInfoView from './student/StudentPersonalInfoView';
import StudentAcademicDetailsView from './student/StudentAcademicDetailsView';
import StudentSettingsView from './student/StudentSettingsView';
import StudentNotificationsView from './student/StudentNotificationsView';

export default function StudentPortal({ user, onLogout, onQuickSwitchRole }) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Navigation View State
  // 'home' | 'classes' | 'active-session' | 'attendance' | 'subject-attendance' | 'history' | 'profile' | 'personal-info' | 'academic-details' | 'settings' | 'notifications'
  const [currentView, setCurrentView] = useState('home');
  const [selectedSession, setSelectedSession] = useState(null);

  // Synchronous refs for popstate listener (prevents stale closure traps)
  const currentViewRef = useRef(currentView);
  useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);

  // Timetable State
  const [todayClasses, setTodayClasses] = useState([]);
  const [fullTimetable, setFullTimetable] = useState([]);

  // Biometric state
  const [biometricUnlocked, setBiometricUnlocked] = useState(false);
  const [biometricScanning, setBiometricScanning] = useState(false);

  // Attendance Modal Step Flow: 'IDLE' | 'SCAN_QR' | 'FACE_VERIFY' | 'EVALUATING' | 'RESULT'
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const isScannerOpenRef = useRef(isScannerOpen);
  useEffect(() => {
    isScannerOpenRef.current = isScannerOpen;
  }, [isScannerOpen]);

  const [attendanceStep, setAttendanceStep] = useState('IDLE');
  const [scannerStage, setScannerStage] = useState('INITIALIZING'); // 'INITIALIZING' | 'SCANNING' | 'DETECTED' | 'VALIDATING' | 'ERROR'
  const [scannedToken, setScannedToken] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [qrScanError, setQrScanError] = useState(null);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const qrScannerRef = useRef(null);
  const qrProcessingRef = useRef(false);
  const qrStartTimeoutRef = useRef(null);

  // Sync Android status bar color: dark #000000 during camera scanning, #F8FAF9 on student dashboard
  useEffect(() => {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', isScannerOpen ? '#000000' : '#F8FAF9');
    }
    return () => {
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', '#F8FAF9');
    };
  }, [isScannerOpen]);

  // Sync PWA attendance lock to prevent any service-worker reloads during active flow
  useEffect(() => {
    setInAttendanceFlow(isScannerOpen && attendanceStep !== 'RESULT');
    return () => setInAttendanceFlow(false);
  }, [isScannerOpen, attendanceStep]);

  // Location & Time captured upon QR scan
  const [capturedLocation, setCapturedLocation] = useState(null);

  // Front camera face verification with AI-powered eye-blink liveness auto-capture
  const [cameraActive, setCameraActive] = useState(false);
  const [selfieCaptured, setSelfieCaptured] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [blinkStatus, setBlinkStatus] = useState('NO_FACE');
  const [facePromptMessage, setFacePromptMessage] = useState('Position your face inside the circle');
  const [blinkFlash, setBlinkFlash] = useState(false);
  const [eyeClosingFeedback, setEyeClosingFeedback] = useState(false);
  const videoRef = useRef(null);
  const blinkAnalysisRef = useRef(null);
  const landmarkerRef = useRef(null);
  const activeStreamRef = useRef(null);
  const attemptIdRef = useRef(0);
  const isStartingFrontCameraRef = useRef(false);
  const frontCameraTimeoutRef = useRef(null);
  const captureTriggeredRef = useRef(false);
  const captureTimerRef = useRef(null);
  const livenessChallengeRef = useRef(null);
  const challengePromiseRef = useRef(null);
  const closedFrameBufferRef = useRef(null);
  const diagnosticsRef = useRef({
    leftEAR: 0,
    rightEAR: 0,
    avgEAR: 0,
    earClosedThreshold: 0,
    earOpenThreshold: 0,
    blinkScoreLeft: 0,
    blinkScoreRight: 0,
    hasBlendshapes: false,
    machineState: 'IDLE',
    transitionReason: '',
    steadyOpenFrames: 0,
    eyesClosedFrames: 0,
    reopenedFrames: 0,
    closureDurationMs: 0,
    isCentered: false,
    rejectionReason: null,
    captureTriggered: false,
    captureOutcome: null
  });

  // 5-Gate Checklist Animation State
  const [gateProgress, setGateProgress] = useState(null);
  const [submittingAttendance, setSubmittingAttendance] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);

  // Student Exception Request State
  const [submittingException, setSubmittingException] = useState(false);
  const [exceptionResult, setExceptionResult] = useState(null);

  // Category 2: Ultrasonic Acoustic Inaudible Geofence State
  const [ultrasonicVerified, setUltrasonicVerified] = useState(false);
  const [ultrasonicScanning, setUltrasonicScanning] = useState(false);

  // Android Back Button & Exit Confirmation Toast State
  const [exitToast, setExitToast] = useState(false);
  const lastBackPressRef = useRef(0);
  const exitTimeoutRef = useRef(null);

  // Face Biometric Reference Enrollment State
  const [showFaceEnrollModal, setShowFaceEnrollModal] = useState(false);
  const showFaceEnrollModalRef = useRef(showFaceEnrollModal);
  useEffect(() => {
    showFaceEnrollModalRef.current = showFaceEnrollModal;
  }, [showFaceEnrollModal]);

  const [enrollSelfie, setEnrollSelfie] = useState(null);
  const [enrollConsent, setEnrollConsent] = useState(true);
  const [enrollingFace, setEnrollingFace] = useState(false);
  const [faceEnrollSuccess, setFaceEnrollSuccess] = useState(null);
  const [faceEnrollError, setFaceEnrollError] = useState(null);
  const enrollVideoRef = useRef(null);
  const [enrollCameraActive, setEnrollCameraActive] = useState(false);

  // ==========================================
  // PHASE 3: ANDROID BACK-BUTTON NAVIGATION
  // ==========================================

  // Synchronize history state on navigation
  const navigateTo = (targetView) => {
    if (targetView === currentView && !isScannerOpen) return;
    try {
      window.history.pushState({ smartattend: true, view: targetView, scanner: false }, '');
    } catch (e) {}
    setCurrentView(targetView);
  };

  // In-app Back button handler (< button)
  const handleInAppBack = () => {
    if (window.history.state && window.history.state.smartattend) {
      window.history.back();
    } else {
      // Fallback if no history state
      if (isScannerOpen) {
        handleCloseScannerModal();
      } else if (showFaceEnrollModal) {
        setShowFaceEnrollModal(false);
      } else if (['personal-info', 'academic-details', 'settings'].includes(currentView)) {
        setCurrentView('profile');
      } else {
        setCurrentView('home');
      }
    }
  };

  // Unified popstate listener handling Android system Back gestures/buttons
  useEffect(() => {
    // Initialize root history state if missing
    try {
      if (!window.history.state || !window.history.state.smartattend) {
        window.history.replaceState({ smartattend: true, view: 'home', scanner: false }, '');
      }
    } catch (e) {}

    const handlePopState = (e) => {
      // 1. If scanner or face verification modal is open: close it safely
      if (isScannerOpenRef.current) {
        handleCloseScannerModal();
        return;
      }

      // 2. If face enrollment modal is open: close it safely
      if (showFaceEnrollModalRef.current) {
        setShowFaceEnrollModal(false);
        if (enrollVideoRef.current?.srcObject) {
          enrollVideoRef.current.srcObject.getTracks().forEach(t => t.stop());
        }
        setEnrollCameraActive(false);
        return;
      }

      // 3. Sub-views return to their parent
      const cur = currentViewRef.current;
      if (['personal-info', 'academic-details', 'settings'].includes(cur)) {
        setCurrentView('profile');
        return;
      }
      if (['classes', 'attendance', 'subject-attendance', 'history', 'profile', 'active-session', 'notifications'].includes(cur)) {
        setCurrentView('home');
        return;
      }

      // 4. Root dashboard ('home'): prevent accidental exit, require double back within 2s
      if (cur === 'home') {
        const now = Date.now();
        if (now - lastBackPressRef.current < 2000) {
          // Double back confirmed: allow system exit
          window.history.back();
        } else {
          // First back press: prompt toast and preserve root
          lastBackPressRef.current = now;
          setExitToast(true);
          if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
          exitTimeoutRef.current = setTimeout(() => setExitToast(false), 2000);
          try {
            window.history.pushState({ smartattend: true, view: 'home', scanner: false }, '');
          } catch (err) {}
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
    };
  }, []);

  // Ultrasonic Geofence Detection
  const detectUltrasonicChirp = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
      setUltrasonicScanning(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
      if (!stream) {
        setUltrasonicScanning(false);
        return false;
      }
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      const sampleRate = audioCtx.sampleRate;
      const binWidth = sampleRate / analyser.fftSize;
      const targetBin = Math.round(18800 / binWidth);

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      let detected = false;

      for (let i = 0; i < 5; i++) {
        analyser.getByteFrequencyData(buffer);
        const energyAtTarget = (buffer[targetBin - 1] + buffer[targetBin] + buffer[targetBin + 1]) / 3;
        const ambientBin = Math.round(15000 / binWidth);
        const ambientEnergy = buffer[ambientBin] || 1;

        if (energyAtTarget > 25 && energyAtTarget > ambientEnergy * 1.25) {
          detected = true;
          break;
        }
        await new Promise(r => setTimeout(r, 60));
      }

      stream.getTracks().forEach(t => t.stop());
      audioCtx.close();
      setUltrasonicScanning(false);
      setUltrasonicVerified(detected);
      return detected;
    } catch (e) {
      setUltrasonicScanning(false);
      return false;
    }
  };

  const getFaceErrorMessage = (code, fallbackMsg) => {
    switch (code) {
      case 'BIOMETRIC_DECRYPTION_FAILED':
        return 'Your enrolled biometric template cannot be decrypted with the current system encryption key. Authorized re-enrollment is required.';
      case 'MALFORMED_EMBEDDING':
      case 'FACE_TEMPLATE_CORRUPTED':
        return 'Stored biometric reference template is corrupt or invalid. Re-enrollment is required.';
      case 'EMBEDDING_DIM_MISMATCH':
        return 'Biometric model dimension mismatch. Re-enrollment is required.';
      case 'FACE_NOT_ENROLLED':
        return 'Biometric face template is not yet enrolled. Please complete face enrollment first before marking attendance.';
      case 'NO_FACE':
        return 'No face detected in the photo. Please align your face inside the camera guide in clear lighting.';
      case 'MULTIPLE_FACES':
        return 'Multiple faces detected. Anti-proxy security requires exactly one student in the camera frame.';
      case 'FACE_IMAGE_BLURRY':
        return 'Photo is too blurry. Please hold the phone steady and ensure clear lighting.';
      case 'FACE_TOO_SMALL':
        return 'Face is too far away. Please move the camera closer to your face.';
      case 'LOW_DETECTION_CONFIDENCE':
        return 'Face detection confidence is low. Please look directly at the camera in good lighting.';
      case 'INVALID_IMAGE':
        return 'Unable to process the image frame. Please retry.';
      case 'EXTRACTION_FAILED':
        return 'Face feature extraction failed. Please try capturing again.';
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

  const fetchTimetables = async () => {
    try {
      const todayRes = await api.getStudentTimetableToday().catch(() => null);
      if (todayRes?.today_classes) {
        setTodayClasses(todayRes.today_classes);
      }
      const fullRes = await api.getMyTimetable().catch(() => null);
      if (fullRes?.timetable) {
        setFullTimetable(fullRes.timetable);
        if (!todayRes || !todayRes.today_classes || todayRes.today_classes.length === 0) {
          const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
          const currentDay = days[new Date().getDay()];
          const nowTime = new Date().toTimeString().slice(0, 5);
          const todayEntries = (fullRes.timetable || [])
            .filter(e => (e.day_of_week || '').toUpperCase() === currentDay && e.is_published !== false)
            .sort((a, b) => a.start_time.localeCompare(b.start_time))
            .map(e => ({
              ...e,
              is_current_slot: (e.start_time <= nowTime && nowTime <= e.end_time)
            }));
          setTodayClasses(todayEntries);
        }
      }
    } catch (e) {
      console.warn('Timetable fetch warning:', e);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchTimetables();
    prewarmFaceLandmarker();
  }, [user.roll_no]);

  const ongoingClass = useMemo(() => {
    return todayClasses.find(c => c.is_current_slot) || null;
  }, [todayClasses]);

  const handleBiometricUnlock = () => {
    setBiometricScanning(true);
    setTimeout(() => {
      setBiometricScanning(false);
      setBiometricUnlocked(true);
    }, 600);
  };

  // Stop Rear Camera QR Scanner (Idempotent and hardware safe)
  const stopQRScanner = async () => {
    if (qrStartTimeoutRef.current) {
      clearTimeout(qrStartTimeoutRef.current);
      qrStartTimeoutRef.current = null;
    }
    const scanner = qrScannerRef.current;
    qrScannerRef.current = null;
    if (scanner) {
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
      } catch (err) {}
      try {
        scanner.clear();
      } catch (err) {}
    }

    // Explicitly shut down all media tracks on the reader video
    const video = document.querySelector('#smartattend-qr-reader video');
    if (video && video.srcObject) {
      try {
        video.srcObject.getTracks().forEach(t => t.stop());
      } catch (e) {}
      video.srcObject = null;
    }
    setIsTorchOn(false);
  };

  // Stop Front Camera Stream
  const stopFrontCamera = () => {
    attemptIdRef.current++;
    isStartingFrontCameraRef.current = false;

    if (frontCameraTimeoutRef.current) {
      clearTimeout(frontCameraTimeoutRef.current);
      frontCameraTimeoutRef.current = null;
    }

    if (captureTimerRef.current) {
      clearTimeout(captureTimerRef.current);
      captureTimerRef.current = null;
    }

    if (blinkAnalysisRef.current) {
      if (typeof blinkAnalysisRef.current === 'number') {
        cancelAnimationFrame(blinkAnalysisRef.current);
      } else {
        clearInterval(blinkAnalysisRef.current);
      }
      blinkAnalysisRef.current = null;
    }

    if (activeStreamRef.current) {
      try {
        activeStreamRef.current.getTracks().forEach(t => t.stop());
      } catch (e) {}
      activeStreamRef.current = null;
    }

    if (videoRef.current && videoRef.current.srcObject) {
      try {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      } catch (e) {}
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
    setBlinkFlash(false);
    setEyeClosingFeedback(false);
    closedFrameBufferRef.current = null;
  };

  // Close & Reset Attendance Flow
  const handleCloseScannerModal = async () => {
    attemptIdRef.current++;
    isStartingFrontCameraRef.current = false;
    qrProcessingRef.current = false;
    captureTriggeredRef.current = false;

    if (frontCameraTimeoutRef.current) {
      clearTimeout(frontCameraTimeoutRef.current);
      frontCameraTimeoutRef.current = null;
    }

    if (captureTimerRef.current) {
      clearTimeout(captureTimerRef.current);
      captureTimerRef.current = null;
    }

    await stopQRScanner();
    stopFrontCamera();

    setIsScannerOpen(false);
    setAttendanceStep('IDLE');
    setScannerStage('INITIALIZING');
    setQrScanError(null);
    setCameraError(null);
    setCapturedLocation(null);
    setBlinkStatus('NO_FACE');
    setFacePromptMessage('Position your face inside the circle');
    setBlinkFlash(false);
    setEyeClosingFeedback(false);
    setIsTorchOn(false);
  };

  // Open Attendance Flow (Step 1: Scan QR)
  const handleStartAttendanceFlow = () => {
    prewarmFaceLandmarker();
    if (!biometricUnlocked) handleBiometricUnlock();
    qrProcessingRef.current = false;
    captureTriggeredRef.current = false;

    // Push scanner history state for Android Back button
    try {
      window.history.pushState({ smartattend: true, view: currentView, scanner: true }, '');
    } catch (e) {}

    setIsScannerOpen(true);
    setAttendanceStep('SCAN_QR');
    setScannerStage('INITIALIZING');
    closedFrameBufferRef.current = null;
    livenessChallengeRef.current = null;
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
    setIsTorchOn(false);

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

  // Start Rear Camera QR Scanner
  const startQRScanner = () => {
    setQrScanError(null);
    setScannerStage('INITIALIZING');
    qrProcessingRef.current = false;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setQrScanError('Camera access requires HTTPS or localhost. navigator.mediaDevices is undefined.');
      setScannerStage('ERROR');
      return;
    }

    if (qrStartTimeoutRef.current) {
      clearTimeout(qrStartTimeoutRef.current);
    }

    qrStartTimeoutRef.current = setTimeout(async () => {
      qrStartTimeoutRef.current = null;
      try {
        await stopQRScanner();

        const scanner = new Html5Qrcode('smartattend-qr-reader');
        qrScannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const edge = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.75);
              return { width: edge, height: edge };
            },
            aspectRatio: 1.0
          },
          async (decodedText) => {
            if (qrProcessingRef.current) return;

            const rawToken = decodedText.trim();
            const parts = rawToken.split('.');
            if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
              setQrScanError('Scanned QR code is not a valid SmartAttend token. Expected session_id.window.signature format.');
              setScannerStage('ERROR');
              return;
            }

            qrProcessingRef.current = true;
            setQrScanError(null);
            setScannerStage('DETECTED');
            setScannedToken(rawToken);
            setSessionId(parts[0]);

            setTimeout(() => setScannerStage('VALIDATING'), 150);

            const currentTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            // 1. Immediately stop rear camera
            await stopQRScanner();

            // 2. Transition UI to Step 2: Front Camera Face Auth
            setAttendanceStep('FACE_VERIFY');
            detectUltrasonicChirp();

            // 3. Immediately start front camera
            if (frontCameraTimeoutRef.current) {
              clearTimeout(frontCameraTimeoutRef.current);
            }
            frontCameraTimeoutRef.current = setTimeout(() => {
              frontCameraTimeoutRef.current = null;
              startFrontCameraWithBlinkDetection(rawToken, parts[0]);
            }, 200);

            // 4. Background tasks: liveness challenge & GPS
            challengePromiseRef.current = api.requestLivenessChallenge(parts[0])
              .then(chal => {
                if (chal && chal.challenge_id) {
                  livenessChallengeRef.current = chal;
                }
                return chal;
              })
              .catch(() => null);

            (async () => {
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
              } catch (e) {}

              let userLat = null;
              let userLng = null;
              let dist = null;
              let isWithin = false;
              let geoError = null;

              if (navigator.geolocation) {
                try {
                  const pos = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                      enableHighAccuracy: true,
                      timeout: 6000,
                      maximumAge: 2000
                    });
                  });
                  if (pos?.coords) {
                    userLat = pos.coords.latitude;
                    userLng = pos.coords.longitude;
                  }
                } catch (e) {
                  geoError = e.code === 1 ? 'Location permission denied' : 'GPS signal timed out';
                }
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
            })();
          },
          () => {}
        );

        setScannerStage('SCANNING');
      } catch (err) {
        console.error('Failed to start rear camera QR scanner:', err);
        setQrScanError('Failed to access rear camera. Please grant camera permissions.');
        setScannerStage('ERROR');
      }
    }, 100);
  };

  // Toggle torch on rear camera using video element track
  const handleToggleTorch = async () => {
    try {
      const video = document.querySelector('#smartattend-qr-reader video');
      const track = video?.srcObject?.getVideoTracks?.()[0];
      if (track && track.getCapabilities && track.getCapabilities().torch) {
        const nextTorch = !isTorchOn;
        await track.applyConstraints({ advanced: [{ torch: nextTorch }] });
        setIsTorchOn(nextTorch);
      }
    } catch (e) {
      console.warn('Torch toggle error:', e);
    }
  };

  // Step 2: Start Front Camera with Real-Time AI Face & Eye-Blink Liveness Auto-Capture
  const startFrontCameraWithBlinkDetection = async (tokenOverride, sessionOverride) => {
    if (isStartingFrontCameraRef.current) return;
    isStartingFrontCameraRef.current = true;
    closedFrameBufferRef.current = null;

    const currentAttempt = ++attemptIdRef.current;
    captureTriggeredRef.current = false;

    if (captureTimerRef.current) {
      clearTimeout(captureTimerRef.current);
      captureTimerRef.current = null;
    }

    if (blinkAnalysisRef.current) {
      if (typeof blinkAnalysisRef.current === 'number') {
        cancelAnimationFrame(blinkAnalysisRef.current);
      } else {
        clearInterval(blinkAnalysisRef.current);
      }
      blinkAnalysisRef.current = null;
    }

    if (activeStreamRef.current) {
      try {
        activeStreamRef.current.getTracks().forEach(t => t.stop());
      } catch (e) {}
      activeStreamRef.current = null;
    }

    if (videoRef.current && videoRef.current.srcObject) {
      try {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      } catch (e) {}
      videoRef.current.srcObject = null;
    }

    setCameraError(null);
    setBlinkStatus('INIT');
    setFacePromptMessage('Starting face verification. Please look at the camera.');
    setBlinkFlash(false);
    setEyeClosingFeedback(false);

    let acquiredStream = null;

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access requires HTTPS or localhost.');
      }
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } }
      });
      acquiredStream = stream;

      if (attemptIdRef.current !== currentAttempt) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      activeStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (e) {}
      }

      if (attemptIdRef.current !== currentAttempt) {
        stream.getTracks().forEach(t => t.stop());
        activeStreamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        return;
      }

      let landmarker = landmarkerRef.current;
      if (!landmarker) {
        setFacePromptMessage('Initializing neural face mesh model...');
        try {
          landmarker = await getFaceLandmarker();
          landmarkerRef.current = landmarker;
        } catch (mErr) {
          console.error('MediaPipe initialization failure:', mErr);
          stream.getTracks().forEach(t => t.stop());
          activeStreamRef.current = null;
          if (videoRef.current) videoRef.current.srcObject = null;
          setCameraActive(false);
          setCameraError('Failed to load AI face detection models. Please check your network connection.');
          return;
        }
      }

      if (attemptIdRef.current !== currentAttempt) {
        stream.getTracks().forEach(t => t.stop());
        activeStreamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        return;
      }

      isStartingFrontCameraRef.current = false;

      const machine = createBlinkStateMachine({
        autoCaptureDelayMs: 400
      });

      let isFrameProcessing = false;
      let lastVideoTime = -1;
      let lastFrameTime = -1;
      const blinkConfirmedTime = { current: 0 };

      const triggerVerifiedCapture = () => {
        if (captureTriggeredRef.current || attemptIdRef.current !== currentAttempt) return;
        captureTriggeredRef.current = true;
        blinkConfirmedTime.current = performance.now();

        setBlinkStatus('BLINK_DETECTED');
        setFacePromptMessage('Blink detected! Now open your eyes');
        setBlinkFlash(true);

        if (blinkAnalysisRef.current) {
          if (typeof blinkAnalysisRef.current === 'number') {
            cancelAnimationFrame(blinkAnalysisRef.current);
          } else {
            clearInterval(blinkAnalysisRef.current);
          }
          blinkAnalysisRef.current = null;
        }

        captureTimerRef.current = setTimeout(() => {
          if (attemptIdRef.current !== currentAttempt) return;
          setBlinkFlash(false);
          setBlinkStatus('CAPTURING');
          setFacePromptMessage('Capturing image...');

          captureTimerRef.current = setTimeout(() => {
            captureTimerRef.current = null;
            if (attemptIdRef.current !== currentAttempt) return;
            captureSelfieAndProceed(tokenOverride, sessionOverride);
          }, 200);
        }, 200);
      };

      const processFrame = () => {
        if (captureTriggeredRef.current || attemptIdRef.current !== currentAttempt) return;
        const video = videoRef.current;
        if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
          blinkAnalysisRef.current = requestAnimationFrame(processFrame);
          return;
        }

        if (isFrameProcessing) {
          blinkAnalysisRef.current = requestAnimationFrame(processFrame);
          return;
        }

        const now = performance.now();
        if (video.currentTime > 0 && video.currentTime === lastVideoTime) {
          blinkAnalysisRef.current = requestAnimationFrame(processFrame);
          return;
        }
        lastVideoTime = video.currentTime;

        if (lastFrameTime > 0 && (now - lastFrameTime) > 700) {
          machine.reset();
          closedFrameBufferRef.current = null;
        }
        lastFrameTime = now;

        isFrameProcessing = true;

        try {
          const actualContainerAspect = (video.clientWidth && video.clientHeight && video.clientHeight > 0)
            ? (video.clientWidth / video.clientHeight)
            : 0.75;

          const analysis = analyzeFaceFrame(landmarker, video, now, machine.getBaselineEAR(), {
            containerAspect: actualContainerAspect,
            isMirrored: true
          });
          const result = machine.processFrame(analysis, now);
          const machineState = machine.getState();

          if (result.eyeClosing && !closedFrameBufferRef.current && video) {
            try {
              const cCanvas = document.createElement('canvas');
              cCanvas.width = 320;
              cCanvas.height = 320;
              const cCtx = cCanvas.getContext('2d');
              const vW = video.videoWidth || 640;
              const vH = video.videoHeight || 480;
              const mSide = Math.min(vW, vH);
              const sx = (vW - mSide) / 2;
              const sy = (vH - mSide) / 2;
              cCtx.drawImage(video, sx, sy, mSide, mSide, 0, 0, 320, 320);
              closedFrameBufferRef.current = cCanvas.toDataURL('image/jpeg', 0.85);
            } catch (e) {}
          } else if (machineState.state === 'WAITING_OPEN' || machineState.rejectionReason) {
            closedFrameBufferRef.current = null;
          }

          setBlinkStatus(result.status);
          setFacePromptMessage(result.prompt);
          setEyeClosingFeedback(Boolean(result.eyeClosing));

          if (result.captured) {
            triggerVerifiedCapture();
            return;
          }
        } catch (frameErr) {
        } finally {
          isFrameProcessing = false;
        }

        if (!captureTriggeredRef.current && attemptIdRef.current === currentAttempt) {
          blinkAnalysisRef.current = requestAnimationFrame(processFrame);
        }
      };

      blinkAnalysisRef.current = requestAnimationFrame(processFrame);

    } catch (err) {
      console.warn('Front camera error:', err);
      closedFrameBufferRef.current = null;
      if (acquiredStream) {
        try { acquiredStream.getTracks().forEach(t => t.stop()); } catch (e) {}
      }
      activeStreamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setCameraActive(false);
      setCameraError('Unable to open front camera. Please grant camera access.');
    } finally {
      if (attemptIdRef.current === currentAttempt) {
        isStartingFrontCameraRef.current = false;
      }
    }
  };

  // Capture selfie frame onto canvas and transition to Step 3
  const captureSelfieAndProceed = (tokenOverride, sessionOverride) => {
    if (captureTimerRef.current) {
      clearTimeout(captureTimerRef.current);
      captureTimerRef.current = null;
    }

    if (blinkAnalysisRef.current) {
      if (typeof blinkAnalysisRef.current === 'number') {
        cancelAnimationFrame(blinkAnalysisRef.current);
      } else {
        clearInterval(blinkAnalysisRef.current);
      }
      blinkAnalysisRef.current = null;
    }

    try {
      let capturedBase64 = null;
      const video = videoRef.current;
      if (video && video.srcObject && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
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
        capturedBase64 = canvas.toDataURL('image/jpeg', 0.90);

        if (activeStreamRef.current) {
          try { activeStreamRef.current.getTracks().forEach(t => t.stop()); } catch (e) {}
          activeStreamRef.current = null;
        }
        const stream = video.srcObject;
        if (stream) {
          try {
            stream.getTracks().forEach(track => track.stop());
          } catch (e) {}
        }
        video.srcObject = null;
        setCameraActive(false);
      }

      if (!capturedBase64) {
        const c = document.createElement('canvas');
        c.width = 480; c.height = 480;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#1A4731'; ctx.fillRect(0, 0, 480, 480);
        capturedBase64 = c.toDataURL('image/jpeg', 0.85);
      }

      setSelfieCaptured(capturedBase64);
      setAttendanceStep('EVALUATING');
      execute5GateSubmission(tokenOverride || scannedToken, sessionOverride || sessionId, capturedBase64);
    } catch (captureErr) {
      console.error('Capture error:', captureErr);
      stopFrontCamera();
      setCameraError('Failed to capture photo frame. Please retry.');
    }
  };

  // Step 3: Execute 5-Gate Verification
  const execute5GateSubmission = async (token, session, selfie) => {
    setSubmittingAttendance(true);
    setSubmissionResult(null);

    const gates = {
      gate1: 'PASSED',
      gate2: 'PENDING',
      gate3: 'PENDING',
      gate4: 'PENDING',
      gate5: 'PENDING',
      activeGate: 1,
      error: null
    };
    setGateProgress({ ...gates });

    let userLat = capturedLocation?.lat || null;
    let userLng = capturedLocation?.lng || null;

    if ((!userLat || !userLng) && navigator.geolocation) {
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 2000
          });
        });
        if (pos?.coords) {
          userLat = pos.coords.latitude;
          userLng = pos.coords.longitude;
        }
      } catch (e) {}
    }

    if (!livenessChallengeRef.current && challengePromiseRef.current) {
      try {
        const chal = await challengePromiseRef.current;
        if (chal?.challenge_id) {
          livenessChallengeRef.current = chal;
        }
      } catch (e) {}
    }

    const payload = {
      session_id: session,
      qr_token: token,
      device_id: deviceId,
      user_lat: userLat,
      user_lng: userLng,
      live_selfie_base64: selfie,
      closed_eye_frame_base64: closedFrameBufferRef.current,
      challenge_id: livenessChallengeRef.current?.challenge_id || null,
      challenge_token: livenessChallengeRef.current?.challenge_token || null,
      ultrasonic_verified: ultrasonicVerified,
      liveness_status: blinkStatus === 'BLINK_DETECTED' || blinkStatus === 'CAPTURING' ? 'CLIENT_BLINK_VERIFIED' : 'NOT_CHECKED'
    };

    gates.gate2 = 'RUNNING';
    setGateProgress({ ...gates, activeGate: 2 });
    await new Promise(r => setTimeout(r, 300));
    gates.gate2 = 'PASSED';

    gates.gate3 = 'RUNNING';
    setGateProgress({ ...gates, activeGate: 3 });
    await new Promise(r => setTimeout(r, 300));
    gates.gate3 = 'PASSED';

    gates.gate4 = 'RUNNING';
    setGateProgress({ ...gates, activeGate: 4 });
    await new Promise(r => setTimeout(r, 400));

    try {
      const res = await api.markAttendance(payload);
      gates.gate4 = 'PASSED';
      gates.gate5 = 'PASSED';
      setGateProgress({ ...gates, activeGate: 5 });

      setSubmissionResult({
        success: true,
        details: res.details,
        status: res.status,
        message: res.message
      });
      setAttendanceStep('RESULT');

      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 }
      });

      fetchDashboardData();
    } catch (err) {
      const faceCode = err.detail?.code;
      const friendlyMsg = faceCode ? getFaceErrorMessage(faceCode, err.message) : (err.message || 'Verification failed');
      const failedGate = err.detail?.failed_gate || (faceCode ? 'GATE_4_FACE_VERIFICATION' : 'GATE_FAILED');

      if (failedGate.includes('4') || faceCode) {
        gates.gate4 = 'FAILED';
      } else {
        gates.gate5 = 'FAILED';
      }
      gates.error = friendlyMsg;
      setGateProgress({ ...gates });
      setSubmissionResult({ success: false, reason: friendlyMsg, failed_gate: failedGate, code: faceCode });
      setAttendanceStep('RESULT');
    } finally {
      closedFrameBufferRef.current = null;
      setSubmittingAttendance(false);
    }
  };

  // Student Exception Request
  const handleRequestException = async () => {
    if (!sessionId) return;
    setSubmittingException(true);
    setExceptionResult(null);
    try {
      const res = await api.requestDeviceException({
        session_id: sessionId,
        device_id: deviceId,
        reason: submissionResult?.reason || 'Verification flag: student requests faculty in-room approval',
        live_selfie_base64: selfieCaptured
      });
      setExceptionResult(res.message || 'Exception request submitted to faculty roster.');
    } catch (e) {
      setExceptionResult(e.message || 'Failed to submit exception request.');
    } finally {
      setSubmittingException(false);
    }
  };

  // Face Enrollment Camera Helpers
  const startEnrollCamera = async () => {
    setFaceEnrollError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } }
      });
      setEnrollCameraActive(true);
      if (enrollVideoRef.current) {
        enrollVideoRef.current.srcObject = stream;
        await enrollVideoRef.current.play();
      }
    } catch (e) {
      setFaceEnrollError('Could not access front camera. Please grant camera permission.');
      setEnrollCameraActive(false);
    }
  };

  const captureEnrollSelfie = () => {
    const video = enrollVideoRef.current;
    if (video && video.srcObject && video.readyState >= 2) {
      const canvas = document.createElement('canvas');
      canvas.width = 480;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      const vW = video.videoWidth || 640;
      const vH = video.videoHeight || 480;
      const m = Math.min(vW, vH);
      ctx.drawImage(video, (vW - m) / 2, (vH - m) / 2, m, m, 0, 0, 480, 480);
      const b64 = canvas.toDataURL('image/jpeg', 0.90);
      setEnrollSelfie(b64);
      try {
        video.srcObject.getTracks().forEach(t => t.stop());
      } catch (e) {}
      video.srcObject = null;
      setEnrollCameraActive(false);
    }
  };

  const handleEnrollFace = async () => {
    if (!enrollSelfie || !enrollConsent) return;
    setEnrollingFace(true);
    setFaceEnrollError(null);
    setFaceEnrollSuccess(null);
    try {
      const res = await api.enrollFace({
        live_selfie_base64: enrollSelfie,
        consent_given: enrollConsent
      });
      setFaceEnrollSuccess(res.message || 'Biometric reference template securely registered!');
      fetchDashboardData();
      setTimeout(() => {
        setShowFaceEnrollModal(false);
        setFaceEnrollSuccess(null);
      }, 2000);
    } catch (e) {
      setFaceEnrollError(e.message || 'Failed to enroll biometric face template.');
    } finally {
      setEnrollingFace(false);
    }
  };

  // Global cleanup on unmount
  useEffect(() => {
    return () => {
      stopFrontCamera();
      stopQRScanner();
    };
  }, []);

  if (loading && !dashboard) {
    return (
      <div className="student-mobile-app flex flex-col items-center justify-center min-h-screen text-slate-500 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-[#1A4731]" />
        <p className="text-xs font-semibold">Loading SmartAttend...</p>
      </div>
    );
  }

  return (
    <div className="student-mobile-app min-h-screen pb-bottom-nav">
      {/* Mobile Screen Container */}
      <div className="max-w-md mx-auto px-4 py-4 sm:py-6">

        {/* SCREEN 3: HOME DASHBOARD */}
        {currentView === 'home' && (
          <StudentHomeView
            dashboard={dashboard}
            user={user}
            todayClasses={todayClasses}
            activeSession={ongoingClass}
            onOpenActiveSession={(sess) => {
              setSelectedSession(sess);
              navigateTo('active-session');
            }}
            onOpenSubjectAttendance={() => navigateTo('subject-attendance')}
            onOpenClassesTab={() => navigateTo('classes')}
            onOpenProfile={() => navigateTo('profile')}
            onOpenScanner={handleStartAttendanceFlow}
          />
        )}

        {/* SCREEN 4: ACTIVE SESSION */}
        {currentView === 'active-session' && (
          <StudentActiveSessionView
            session={selectedSession || ongoingClass}
            onBack={handleInAppBack}
            onStartScan={handleStartAttendanceFlow}
          />
        )}

        {/* SCREEN 13: CLASSES / TIMETABLE */}
        {currentView === 'classes' && (
          <StudentClassesView
            timetable={fullTimetable}
            todayClasses={todayClasses}
            onBack={handleInAppBack}
            onOpenSession={(sess) => {
              setSelectedSession(sess);
              navigateTo('active-session');
            }}
          />
        )}

        {/* SCREEN 14: ATTENDANCE HISTORY */}
        {currentView === 'history' && (
          <StudentAttendanceHistoryView
            logs={dashboard?.recent_logs || []}
            onBack={handleInAppBack}
          />
        )}

        {/* SCREEN 15: SUBJECT-WISE ATTENDANCE */}
        {(currentView === 'subject-attendance' || currentView === 'attendance') && (
          <StudentSubjectAttendanceView
            dashboard={dashboard}
            onBack={handleInAppBack}
          />
        )}

        {/* SCREEN 16: STUDENT PROFILE */}
        {currentView === 'profile' && (
          <StudentProfileView
            dashboard={dashboard}
            user={user}
            onBack={handleInAppBack}
            onOpenPersonalInfo={() => navigateTo('personal-info')}
            onOpenAcademicDetails={() => navigateTo('academic-details')}
            onOpenAttendanceReport={() => navigateTo('subject-attendance')}
            onOpenTimetable={() => navigateTo('classes')}
            onOpenFaceEnroll={() => {
              try {
                window.history.pushState({ smartattend: true, view: currentView, faceEnroll: true }, '');
              } catch (e) {}
              setShowFaceEnrollModal(true);
            }}
            onOpenSettings={() => navigateTo('settings')}
            onOpenNotifications={() => navigateTo('notifications')}
            onLogout={onLogout}
          />
        )}

        {/* SCREEN 17: PERSONAL INFORMATION */}
        {currentView === 'personal-info' && (
          <StudentPersonalInfoView
            dashboard={dashboard}
            user={user}
            onBack={handleInAppBack}
          />
        )}

        {/* SCREEN 18: ACADEMIC DETAILS */}
        {currentView === 'academic-details' && (
          <StudentAcademicDetailsView
            dashboard={dashboard}
            user={user}
            onBack={handleInAppBack}
          />
        )}

        {/* SCREEN 19: SETTINGS */}
        {currentView === 'settings' && (
          <StudentSettingsView
            onBack={handleInAppBack}
            onLogout={onLogout}
            onOpenNotifications={() => navigateTo('notifications')}
            onQuickSwitchRole={onQuickSwitchRole}
          />
        )}

        {/* SCREEN 20: NOTIFICATIONS */}
        {currentView === 'notifications' && (
          <StudentNotificationsView
            notifications={dashboard?.notifications || []}
            onBack={handleInAppBack}
            onMarkAllRead={() => {
              if (user?.roll_no) {
                api.markAllNotificationsRead(user.roll_no).then(fetchDashboardData).catch(() => {});
              }
            }}
          />
        )}

      </div>

      {/* Android Exit Confirmation Toast */}
      {exitToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-[#111827]/95 text-white text-xs font-semibold shadow-xl border border-slate-700/80 animate-in fade-in slide-in-from-bottom-2 duration-150">
          Press back again to exit SmartAttend
        </div>
      )}

      {/* Persistent Mobile Bottom Navigation (Screens 3-20) */}
      {/* Hidden during dedicated full-screen camera and face verification (Phase 4 requirement) */}
      {!isScannerOpen && (
        <StudentBottomNav
          activeTab={
            currentView === 'home' || currentView === 'active-session'
              ? 'home'
              : currentView === 'classes'
              ? 'classes'
              : currentView === 'subject-attendance' || currentView === 'attendance' || currentView === 'history'
              ? 'attendance'
              : currentView === 'profile' || currentView === 'personal-info' || currentView === 'academic-details' || currentView === 'settings'
              ? 'profile'
              : 'home'
          }
          onTabChange={(tabId) => {
            if (tabId === 'home') navigateTo('home');
            else if (tabId === 'classes') navigateTo('classes');
            else if (tabId === 'attendance') navigateTo('subject-attendance');
            else if (tabId === 'profile') navigateTo('profile');
          }}
          onScanClick={handleStartAttendanceFlow}
        />
      )}

      {/* SCREEN 5 - 12: ATTENDANCE FULLSCREEN MODAL FLOW */}
      {isScannerOpen && (
        <StudentAttendanceFlow
          step={attendanceStep}
          scannerStage={scannerStage}
          blinkStatus={blinkStatus}
          facePromptMessage={facePromptMessage}
          blinkFlash={blinkFlash}
          videoRef={videoRef}
          qrScanError={qrScanError}
          cameraError={cameraError}
          gateProgress={gateProgress}
          submissionResult={submissionResult}
          sessionId={sessionId}
          capturedLocation={capturedLocation}
          ultrasonicVerified={ultrasonicVerified}
          isTorchOn={isTorchOn}
          onToggleTorch={handleToggleTorch}
          onCancel={handleInAppBack}
          onRetryQR={startQRScanner}
          onRetryCamera={() => startFrontCameraWithBlinkDetection(scannedToken, sessionId)}
          onManualCapture={() => captureSelfieAndProceed(scannedToken, sessionId)}
          onBackToHome={handleCloseScannerModal}
          onOpenFaceEnroll={() => {
            handleCloseScannerModal();
            setShowFaceEnrollModal(true);
          }}
          onRequestException={handleRequestException}
        />
      )}

      {/* Biometric Face Reference Enrollment Modal */}
      {showFaceEnrollModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white text-[#111827] w-full max-w-sm rounded-3xl p-6 border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-[#1A4731]" />
                <h3 className="text-base font-extrabold text-[#111827]">
                  Biometric Face Enrollment
                </h3>
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
                className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 bg-slate-100 rounded-lg"
              >
                Close
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              SmartAttend stores an <strong>encrypted 512-D numeric template</strong>, never raw photos. Encrypted with AES-256 at rest.
            </p>

            {/* Camera View / Photo Preview */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-3">
              {enrollCameraActive ? (
                <div className="space-y-2">
                  <video ref={enrollVideoRef} autoPlay playsInline className="w-full h-44 object-cover rounded-xl bg-black scale-x-[-1]" />
                  <button
                    type="button"
                    onClick={captureEnrollSelfie}
                    className="w-full py-2 bg-[#1A4731] hover:bg-[#143826] text-white rounded-xl text-xs font-bold"
                  >
                    Capture Reference Frame
                  </button>
                </div>
              ) : enrollSelfie ? (
                <div className="flex flex-col items-center gap-2">
                  <img src={enrollSelfie} alt="Enrolled reference" className="w-24 h-24 rounded-2xl object-cover border-2 border-emerald-500 shadow" />
                  <button
                    type="button"
                    onClick={() => {
                      setEnrollSelfie(null);
                      setFaceEnrollError(null);
                      startEnrollCamera();
                    }}
                    className="text-xs text-emerald-800 hover:underline font-semibold"
                  >
                    Retake Photo
                  </button>
                </div>
              ) : (
                <div className="py-4 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
                    <Camera className="w-6 h-6" />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFaceEnrollError(null);
                      startEnrollCamera();
                    }}
                    className="px-4 py-2 bg-[#1A4731] hover:bg-[#143826] text-white rounded-xl text-xs font-semibold"
                  >
                    Open Front Camera
                  </button>
                </div>
              )}
            </div>

            <label className="flex items-start gap-2 text-[11px] text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={enrollConsent}
                onChange={(e) => setEnrollConsent(e.target.checked)}
                className="mt-0.5 rounded text-[#1A4731] focus:ring-[#1A4731]"
              />
              <span>
                I voluntarily consent to SmartAttend generating an encrypted mathematical vector of my face for attendance verification.
              </span>
            </label>

            {faceEnrollError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {faceEnrollError}
              </div>
            )}

            {faceEnrollSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
                {faceEnrollSuccess}
              </div>
            )}

            <button
              type="button"
              onClick={handleEnrollFace}
              disabled={enrollingFace || !enrollSelfie || !enrollConsent}
              className="w-full py-3 rounded-2xl bg-[#1A4731] hover:bg-[#143826] text-white font-bold text-xs disabled:opacity-50 transition flex items-center justify-center gap-2"
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
