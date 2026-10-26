import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import {
  Play, Users, ShieldAlert, CheckCircle2, XCircle, Clock, AlertTriangle,
  RefreshCw, Smartphone, Search, Check, Sparkles, UserCheck, ShieldCheck, Square, MapPin,
  LayoutGrid, List, Maximize2, Minimize2, Volume2, VolumeX, Tv, Zap, CheckCheck,
  Camera, Upload, Radio, X, Activity, Eye, Network, Calendar,
  ChevronRight, ChevronLeft, ArrowLeft, LogOut, Bell, Shield, BookOpen, AlertCircle, ArrowUpRight, User
} from 'lucide-react';
import { api } from '../api';
import FacultyTimetable from './FacultyTimetable';
import FacultyBottomNav from './faculty/FacultyBottomNav';
import FacultyDashboardView from './faculty/FacultyDashboardView';
import FacultySessionSetupView from './faculty/FacultySessionSetupView';
import FacultyTimetableMobileView from './faculty/FacultyTimetableMobileView';
import FacultyLiveSessionView from './faculty/FacultyLiveSessionView';
import FacultyStudentRosterView from './faculty/FacultyStudentRosterView';
import FacultySessionSummaryView from './faculty/FacultySessionSummaryView';

export default function FacultyPortal({ user, onLogout }) {
  const [portalTab, setPortalTab] = useState('live'); // 'live' | 'timetable'
  const [subject, setSubject] = useState('CS301 - Operating Systems');
  const [activeSession, setActiveSession] = useState(null);
  const isSessionActive = Boolean(activeSession && activeSession.status !== 'ENDED');
  const [qrData, setQrData] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [searchRoster, setSearchRoster] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [manualSuccessMsg, setManualSuccessMsg] = useState(null);
  const [qrProjectorOpen, setQrProjectorOpen] = useState(false);

  // Live Classroom Wall (Projector Mode) State
  const [viewMode, setViewMode] = useState('wall'); // 'wall' | 'table'
  const [wallFilter, setWallFilter] = useState('ALL'); // 'ALL' | 'PRESENT' | 'UNMARKED'
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [latestArrival, setLatestArrival] = useState(null);
  const prevPresentRollsRef = useRef(new Set());

  // Category 2: Ultrasonic Acoustic Beacon (Inaudible Zero-GPS-Drift Geofencing)
  const [ultrasonicBeaconActive, setUltrasonicBeaconActive] = useState(true);
  const ultrasonicAudioRef = useRef(null);

  // Category 2: Panoramic Classroom Snapshot AI State
  const [showPanoramicModal, setShowPanoramicModal] = useState(false);
  const [panoramicTab, setPanoramicTab] = useState('upload'); // 'upload' | 'camera'
  const [panoramicImage, setPanoramicImage] = useState(null);
  const [panoramicLoading, setPanoramicLoading] = useState(false);
  const [panoramicResult, setPanoramicResult] = useState(null);
  const [panoramicCameraActive, setPanoramicCameraActive] = useState(false);
  const panoramicVideoRef = useRef(null);

  // Category 2: Fraud Syndicate & Proxy Ring Intelligence State
  const [showSyndicateModal, setShowSyndicateModal] = useState(false);
  const [syndicateLoading, setSyndicateLoading] = useState(false);
  const [syndicateData, setSyndicateData] = useState(null);

  // Mobile PWA Navigation View State (Phase A: 'home' | 'classes' | 'live' | 'students' | 'profile')
  const [mobileTab, setMobileTab] = useState('home');
  const mobileTabRef = useRef(mobileTab);
  useEffect(() => {
    mobileTabRef.current = mobileTab;
  }, [mobileTab]);

  const [facultyTodaySchedule, setFacultyTodaySchedule] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Stepped Session Setup State (Screens 4 & 5)
  const [setupSlot, setSetupSlot] = useState(null);
  const setupSlotRef = useRef(setupSlot);
  useEffect(() => {
    setupSlotRef.current = setupSlot;
  }, [setupSlot]);

  // Ended Session Summary State (Screens 11 & 12)
  const [sessionSummary, setSessionSummary] = useState(null);
  const sessionSummaryRef = useRef(sessionSummary);
  useEffect(() => {
    sessionSummaryRef.current = sessionSummary;
  }, [sessionSummary]);

  const handleOpenSessionSetup = (slot) => {
    try {
      window.history.pushState({ smartattend: true, role: 'faculty', setup: true }, '');
    } catch (e) {}
    setSetupSlot(slot || true);
  };

  // Android Back-Button Handling State
  const [exitToast, setExitToast] = useState(false);
  const lastBackPressRef = useRef(0);

  const navigateToMobileTab = (targetTab) => {
    try {
      window.history.pushState({ smartattend: true, role: 'faculty', tab: targetTab }, '');
    } catch (e) {}
    setSetupSlot(null);
    setMobileTab(targetTab);
  };

  const handleInAppBack = () => {
    if (sessionSummary) {
      setSessionSummary(null);
      setMobileTab('home');
      return;
    }
    if (setupSlot) {
      setSetupSlot(null);
      return;
    }
    if (mobileTab !== 'home') {
      setMobileTab('home');
      return;
    }
    if (window.history.length > 1) {
      window.history.back();
    }
  };

  // Fetch today's schedule for faculty
  const loadTodaySchedule = async () => {
    setLoadingSchedule(true);
    try {
      const res = await api.getFacultyTimetableToday();
      if (res && res.today_classes) {
        setFacultyTodaySchedule(res.today_classes);
      }
    } catch (e) {
      console.warn('Could not load today schedule:', e);
    } finally {
      setLoadingSchedule(false);
    }
  };

  useEffect(() => {
    loadTodaySchedule();
  }, []);

  // Android hardware back button handler
  useEffect(() => {
    const handlePopState = () => {
      // 1. If any modal is open, close it first
      if (showPanoramicModal) {
        setShowPanoramicModal(false);
        try {
          window.history.pushState({ smartattend: true, role: 'faculty' }, '');
        } catch (err) {}
        return;
      }
      if (showSyndicateModal) {
        setShowSyndicateModal(false);
        try {
          window.history.pushState({ smartattend: true, role: 'faculty' }, '');
        } catch (err) {}
        return;
      }
      if (qrProjectorOpen) {
        setQrProjectorOpen(false);
        try {
          window.history.pushState({ smartattend: true, role: 'faculty' }, '');
        } catch (err) {}
        return;
      }
      if (showLogoutConfirm) {
        setShowLogoutConfirm(false);
        try {
          window.history.pushState({ smartattend: true, role: 'faculty' }, '');
        } catch (err) {}
        return;
      }

      // 1b. If session summary is visible, return to home dashboard
      if (sessionSummaryRef.current) {
        setSessionSummary(null);
        setMobileTab('home');
        try {
          window.history.pushState({ smartattend: true, role: 'faculty', tab: 'home' }, '');
        } catch (err) {}
        return;
      }

      // 2. If in stepped session setup, return to dashboard
      if (setupSlotRef.current) {
        setSetupSlot(null);
        try {
          window.history.pushState({ smartattend: true, role: 'faculty', tab: 'home' }, '');
        } catch (err) {}
        return;
      }

      // 3. If on secondary tab, return to 'home'
      if (mobileTabRef.current !== 'home') {
        setMobileTab('home');
        try {
          window.history.pushState({ smartattend: true, role: 'faculty', tab: 'home' }, '');
        } catch (err) {}
        return;
      }

      // 4. At root 'home' screen: show double-back exit confirmation toast
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) {
        setExitToast(false);
        window.history.back();
      } else {
        lastBackPressRef.current = now;
        setExitToast(true);
        setTimeout(() => setExitToast(false), 2000);
        try {
          window.history.pushState({ smartattend: true, role: 'faculty', root: true }, '');
        } catch (err) {}
      }
    };

    window.addEventListener('popstate', handlePopState);
    try {
      if (!window.history.state || !window.history.state.smartattend) {
        window.history.replaceState({ smartattend: true, role: 'faculty', initial: true }, '');
        window.history.pushState({ smartattend: true, role: 'faculty', tab: 'home' }, '');
      }
    } catch (err) {}

    return () => window.removeEventListener('popstate', handlePopState);
  }, [showPanoramicModal, showSyndicateModal, qrProjectorOpen, showLogoutConfirm]);

  // Synchronize Android status bar theme-color
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', qrProjectorOpen ? '#000000' : '#F8FAF9');
    }
    return () => {
      const m = document.querySelector('meta[name="theme-color"]');
      if (m) m.setAttribute('content', '#F8FAF9');
    };
  }, [qrProjectorOpen]);

  const facultyName = user?.name || 'Prof. Faculty';
  const facultyLastName = facultyName.split(' ').slice(-1)[0] || 'Faculty';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const todayFormattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  // Web Audio pleasant arrival chime
  const playArrivalChime = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1174.66, audioCtx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.38);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.38);
    } catch (e) {}
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const getAvatarGradient = (rollNo) => {
    const gradients = [
      'from-indigo-600 to-purple-600',
      'from-emerald-600 to-teal-600',
      'from-blue-600 to-cyan-600',
      'from-violet-600 to-fuchsia-600',
      'from-amber-600 to-orange-600',
      'from-rose-600 to-pink-600',
    ];
    const sum = (rollNo || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return gradients[sum % gradients.length];
  };

  const getInitials = (name) => {
    if (!name) return 'ST';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Category 2: Ultrasonic Acoustic Inaudible Beacon
  useEffect(() => {
    if (isSessionActive && ultrasonicBeaconActive) {
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(18800, audioCtx.currentTime); // Inaudible ultrasonic frequency
        gain.gain.setValueAtTime(0.04, audioCtx.currentTime); // Safe low gain
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        ultrasonicAudioRef.current = { audioCtx, osc, gain };
      } catch (e) {
        console.warn('Ultrasonic audio beacon failed to start:', e);
      }
    } else if (ultrasonicAudioRef.current) {
      try {
        ultrasonicAudioRef.current.osc.stop();
        ultrasonicAudioRef.current.audioCtx.close();
      } catch (e) {}
      ultrasonicAudioRef.current = null;
    }
    return () => {
      if (ultrasonicAudioRef.current) {
        try {
          ultrasonicAudioRef.current.osc.stop();
          ultrasonicAudioRef.current.audioCtx.close();
        } catch (e) {}
        ultrasonicAudioRef.current = null;
      }
    };
  }, [isSessionActive, ultrasonicBeaconActive]);

  // Category 2: Panoramic Photo Upload Handler
  const handleUploadPanoramicPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setPanoramicImage(event.target.result);
      setPanoramicResult(null);
    };
    reader.readAsDataURL(file);
  };

  // Category 2: Panoramic Live Webcam Viewfinder Handlers
  const handleStartPanoramicWebcam = async () => {
    setPanoramicCameraActive(true);
    setPanoramicResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      if (panoramicVideoRef.current) {
        panoramicVideoRef.current.srcObject = stream;
        panoramicVideoRef.current.play();
      }
    } catch (err) {
      alert('Camera access failed: ' + (err.message || 'Permission denied'));
      setPanoramicCameraActive(false);
    }
  };

  const handleStopPanoramicWebcam = () => {
    if (panoramicVideoRef.current?.srcObject) {
      panoramicVideoRef.current.srcObject.getTracks().forEach(t => t.stop());
      panoramicVideoRef.current.srcObject = null;
    }
    setPanoramicCameraActive(false);
  };

  const handleCapturePanoramicSnapshot = () => {
    const video = panoramicVideoRef.current;
    if (!video || video.readyState < 2) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const b64 = canvas.toDataURL('image/jpeg', 0.88);
    setPanoramicImage(b64);
    handleStopPanoramicWebcam();
  };

  // Category 2: Run InsightFace Multi-Face AI on Panoramic Photo
  const handleRunPanoramicAI = async () => {
    if (!panoramicImage) {
      alert('Please upload or snap a classroom photo first.');
      return;
    }
    if (!activeSession) {
      alert('Please start a lecture session first.');
      return;
    }

    setPanoramicLoading(true);
    try {
      const res = await api.processPanoramicAttendance(activeSession.session_id, panoramicImage, true);
      setPanoramicResult(res);

      if (res.auto_marked_count > 0) {
        if (soundEnabled) playArrivalChime();
        confetti({
          particleCount: 100,
          spread: 85,
          origin: { y: 0.4 }
        });
        setManualSuccessMsg(`Panoramic AI: Successfully verified and marked ${res.auto_marked_count} students PRESENT!`);
        setTimeout(() => setManualSuccessMsg(null), 5000);

        // Immediate refresh of roster and live stats
        const live = await api.getFacultyLiveSession(activeSession.session_id);
        setLiveData(live);
        const rData = await api.getSessionRoster(activeSession.session_id);
        if (rData && rData.roster) setRoster(rData.roster);
      }
    } catch (err) {
      alert('Panoramic AI scan failed: ' + err.message);
    } finally {
      setPanoramicLoading(false);
    }
  };

  // Category 2: Fraud Syndicate Inspector Handler
  const handleOpenSyndicateInspector = async () => {
    setShowSyndicateModal(true);
    if (!activeSession) return;
    setSyndicateLoading(true);
    try {
      const data = await api.getFraudSyndicate(activeSession.session_id);
      setSyndicateData(data);
    } catch (err) {
      console.warn('Failed to load fraud syndicate data:', err);
    } finally {
      setSyndicateLoading(false);
    }
  };

  // Live faculty GPS state

  const [facultyGps, setFacultyGps] = useState({
    lat: null,
    lng: null,
    accuracy: null,
    status: 'INITIALIZING', // 'INITIALIZING' | 'READY' | 'DENIED' | 'UNAVAILABLE'
    errorMsg: null,
    lastUpdated: null
  });
  const facultyGpsRef = useRef(facultyGps);
  facultyGpsRef.current = facultyGps;

  // Live class roster loaded from GET /api/faculty/session/{id}/roster
  const [roster, setRoster] = useState([]);

  // Continuous live GPS tracking for faculty with multi-tier fallback
  useEffect(() => {
    let isSubscribed = true;

    if (!navigator.geolocation) {
      setFacultyGps({
        lat: 19.0760,
        lng: 72.8777,
        accuracy: 20,
        status: 'READY',
        errorMsg: null,
        lastUpdated: new Date().toLocaleTimeString()
      });
      return;
    }

    const handleSuccess = (pos) => {
      if (!isSubscribed) return;
      if (pos?.coords) {
        setFacultyGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy || 15),
          status: 'READY',
          errorMsg: null,
          lastUpdated: new Date().toLocaleTimeString()
        });
      }
    };

    const handleError = (err) => {
      if (!isSubscribed) return;
      console.warn('Faculty GPS primary high-accuracy error, attempting network fallback:', err);
      // Fallback 1: Low-accuracy network geolocation
      navigator.geolocation.getCurrentPosition(
        handleSuccess,
        (fallbackErr) => {
          if (!isSubscribed) return;
          console.warn('Faculty GPS fallback error, using campus boundary coordinates:', fallbackErr);
          // Fallback 2: Default campus coordinates (19.0760, 72.8777) so faculty is never blocked
          setFacultyGps({
            lat: 19.0760,
            lng: 72.8777,
            accuracy: 25,
            status: 'READY',
            errorMsg: null,
            lastUpdated: new Date().toLocaleTimeString()
          });
        },
        { enableHighAccuracy: false, timeout: 6000, maximumAge: 30000 }
      );
    };

    // Initial grab
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 5000
    });

    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 10000
    });

    return () => {
      isSubscribed = false;
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Manual GPS Sync / Recalibrate button
  const handleRecalibrateGps = async () => {
    setFacultyGps(prev => ({ ...prev, status: 'INITIALIZING' }));
    if (!navigator.geolocation) {
      setFacultyGps({
        lat: 19.0760,
        lng: 72.8777,
        accuracy: 20,
        status: 'READY',
        errorMsg: null,
        lastUpdated: new Date().toLocaleTimeString()
      });
      return;
    }
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 6000,
          maximumAge: 0
        });
      });
      const newLat = pos.coords.latitude;
      const newLng = pos.coords.longitude;
      const acc = Math.round(pos.coords.accuracy || 15);
      const updated = {
        lat: newLat,
        lng: newLng,
        accuracy: acc,
        status: 'READY',
        errorMsg: null,
        lastUpdated: new Date().toLocaleTimeString()
      };
      setFacultyGps(updated);

      if (activeSession?.session_id) {
        await api.updateSessionLocation(activeSession.session_id, {
          class_lat: newLat,
          class_lng: newLng,
          geofence_radius_meters: 150
        });
        setManualSuccessMsg(`Faculty GPS synchronized: (${newLat.toFixed(4)}, ${newLng.toFixed(4)}) ±${acc}m (150m geofence active)`);
        setTimeout(() => setManualSuccessMsg(null), 4000);
      }
    } catch (err) {
      console.warn('Manual GPS recalibration error, setting campus reference:', err);
      const campusLat = 19.0760;
      const campusLng = 72.8777;
      setFacultyGps({
        lat: campusLat,
        lng: campusLng,
        accuracy: 25,
        status: 'READY',
        errorMsg: null,
        lastUpdated: new Date().toLocaleTimeString()
      });
      if (activeSession?.session_id) {
        try {
          await api.updateSessionLocation(activeSession.session_id, {
            class_lat: campusLat,
            class_lng: campusLng,
            geofence_radius_meters: 150
          });
        } catch (e) {}
      }
      setManualSuccessMsg(`Campus GPS locked: (${campusLat.toFixed(4)}, ${campusLng.toFixed(4)}) 150m geofence`);
      setTimeout(() => setManualSuccessMsg(null), 4000);
    }
  };

  // Start lecture session with dynamic teacher GPS anchoring (150m radius)
  // Start lecture session with dynamic teacher GPS anchoring (150m radius)
  const handleStartSession = async (overrideSubject = null) => {
    if (isSessionActive) {
      alert(`A lecture session is already active (${activeSession.session_code || activeSession.subject_name}). Please end the current session before starting a new one.`);
      setPortalTab('live');
      return;
    }

    const targetSubject = (typeof overrideSubject === 'string' && overrideSubject.trim()) ? overrideSubject : subject;
    setSubject(targetSubject);
    setPortalTab('live');
    setStarting(true);
    let teacherLat = facultyGpsRef.current.lat;
    let teacherLng = facultyGpsRef.current.lng;

    // If GPS is not acquired yet, try an immediate fresh grab or fallback to campus coordinates
    if (!teacherLat || !teacherLng) {
      if (navigator.geolocation) {
        try {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: false,
              timeout: 4000,
              maximumAge: 10000
            });
          });
          if (pos?.coords) {
            teacherLat = pos.coords.latitude;
            teacherLng = pos.coords.longitude;
            setFacultyGps({
              lat: teacherLat,
              lng: teacherLng,
              accuracy: Math.round(pos.coords.accuracy || 15),
              status: 'READY',
              errorMsg: null,
              lastUpdated: new Date().toLocaleTimeString()
            });
          }
        } catch (geoErr) {
          console.warn('Teacher geolocation not accessible in browser, using campus coordinates:', geoErr);
        }
      }

      // Smooth default to campus coordinates if still not acquired
      if (!teacherLat || !teacherLng) {
        teacherLat = 19.0760;
        teacherLng = 72.8777;
        setFacultyGps({
          lat: teacherLat,
          lng: teacherLng,
          accuracy: 25,
          status: 'READY',
          errorMsg: null,
          lastUpdated: new Date().toLocaleTimeString()
        });
      }
    }

    try {
      const res = await api.startSession({
        subject_name: targetSubject,
        class_lat: teacherLat,
        class_lng: teacherLng,
        geofence_radius_meters: 150
      });
      setActiveSession(res.session);
    } catch (err) {
      alert('Error starting session: ' + err.message);
    } finally {
      setStarting(false);
    }
  };

  // End active lecture session and generate session summary report
  const handleEndSession = async () => {
    if (!activeSession) return;
    setEnding(true);
    const sid = activeSession.session_id;
    try {
      const res = await api.endSession(sid);

      // Fetch finalized roster from backend (absentees are now inserted in DB)
      let finalRoster = roster;
      try {
        const rData = await api.getSessionRoster(sid);
        if (rData && rData.roster) {
          finalRoster = rData.roster;
          setRoster(finalRoster);
        }
      } catch (e) {
        console.warn('Could not fetch final roster after ending session:', e);
      }

      const pCount = finalRoster.filter(s => s.status === 'PRESENT' || s.status === 'MANUAL_PRESENT').length;
      const aCount = finalRoster.filter(s => s.status === 'ABSENT').length;
      const pendCount = finalRoster.filter(s => s.status === 'PENDING_APPROVAL').length;
      const tCount = finalRoster.length;
      const pct = tCount > 0 ? Math.round((pCount / tCount) * 100) : 0;

      let durationText = '45 mins';
      if (activeSession.started_at) {
        const diffMins = Math.round((Date.now() - new Date(activeSession.started_at).getTime()) / 60000);
        durationText = `${Math.max(1, diffMins)} mins`;
      }

      setSessionSummary({
        session: res.session || activeSession,
        totalEnrolled: tCount,
        presentCount: pCount,
        absentCount: aCount,
        pendingCount: pendCount,
        attendancePct: pct,
        durationText: durationText,
        absenteesCreated: res.absentees_created || 0,
        finalRoster: finalRoster
      });

      setActiveSession(null);
      setQrData(null);
      setManualSuccessMsg('Lecture session ended successfully. Attendance is now closed & finalized.');
      setTimeout(() => setManualSuccessMsg(null), 4000);
      setMobileTab('live');
    } catch (err) {
      const errMsg = String(err.message || err.detail || '');
      const isAlreadyEnded = err.status === 400 && (
        errMsg.includes('ENDED') || errMsg.includes('closed') || errMsg.includes('not active')
      );
      if (isAlreadyEnded) {
        setActiveSession(null);
        setQrData(null);
        setManualSuccessMsg('Lecture session is closed.');
        setTimeout(() => setManualSuccessMsg(null), 4000);
      } else {
        alert('Error ending session: ' + err.message);
      }
    } finally {
      setEnding(false);
    }
  };

  // Poll dynamic rotating QR code, live status, and roster data during active sessions
  useEffect(() => {
    let timer = null;
    let isCancelled = false;

    // Only poll when on the live console tab and session is actively running
    if (!isSessionActive || !activeSession?.session_id || portalTab !== 'live') {
      if (!isSessionActive) {
        setQrData(null);
      }
      return;
    }

    const sessionId = activeSession.session_id;

    // Helper to immediately cease recurring polls when backend detects session is closed
    const stopSessionPolling = (noticeMsg) => {
      isCancelled = true;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      setQrData(null);
      setActiveSession(prev => (prev?.session_id === sessionId ? { ...prev, status: 'ENDED' } : prev));
      if (noticeMsg) {
        setManualSuccessMsg(noticeMsg);
        setTimeout(() => setManualSuccessMsg(null), 4000);
      }
    };

    const fetchQR = async () => {
      if (isCancelled) return;
      try {
        const lat = facultyGpsRef.current.lat;
        const lng = facultyGpsRef.current.lng;
        const data = await api.getSessionQR(sessionId, lat, lng);
        if (!isCancelled) {
          setQrData(data);
        }
      } catch (err) {
        if (isCancelled) return;
        const errMsg = String(err.message || err.detail || '');
        // Backend returns 400 when session is not ACTIVE (e.g., status is ENDED)
        const isSessionEnded = err.status === 400 && (
          errMsg.includes('ENDED') ||
          errMsg.includes('Attendance is closed') ||
          errMsg.includes('not active') ||
          errMsg.includes('is currently')
        );
        if (isSessionEnded || err.status === 404) {
          console.warn(`[FacultyPortal] QR polling halted: session ${sessionId} is inactive/ended (${errMsg}).`);
          stopSessionPolling('Lecture session ended. QR rotation stopped.');
          return;
        }
        console.error('Error polling QR:', err);
      }
    };

    const fetchLiveStatus = async () => {
      if (isCancelled) return;
      try {
        const live = await api.getFacultyLiveSession(sessionId);
        if (!isCancelled && live) {
          setLiveData(live);
          if (live.session?.status && live.session.status !== 'ACTIVE') {
            console.warn(`[FacultyPortal] Live status indicates session is ${live.session.status}. Halting polling.`);
            stopSessionPolling(`Session status is ${live.session.status}. Attendance is closed.`);
          }
        }
      } catch (err) {
        if (isCancelled) return;
        if (err.status === 404) {
          stopSessionPolling('Session not found.');
          return;
        }
        console.error('Error fetching live session data:', err);
      }
    };

    const fetchRoster = async () => {
      if (isCancelled) return;
      try {
        const rData = await api.getSessionRoster(sessionId);
        if (!isCancelled && rData && rData.roster) {
          const currentPresentRolls = new Set(
            rData.roster.filter(s => s.status === 'PRESENT' || s.status === 'MANUAL_PRESENT').map(s => s.roll_no)
          );

          // Detect newly verified arrivals
          const newArrivals = rData.roster.filter(
            s => (s.status === 'PRESENT' || s.status === 'MANUAL_PRESENT') && !prevPresentRollsRef.current.has(s.roll_no)
          );

          if (prevPresentRollsRef.current.size > 0 && newArrivals.length > 0) {
            const newest = newArrivals[0];
            setLatestArrival({
              name: newest.name,
              roll_no: newest.roll_no,
              distance: newest.distance_meters,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
            setTimeout(() => setLatestArrival(null), 4500);

            if (soundEnabled) {
              playArrivalChime();
            }
            confetti({
              particleCount: 55,
              spread: 75,
              origin: { y: 0.35 }
            });
          }

          prevPresentRollsRef.current = currentPresentRolls;
          setRoster(rData.roster);
        }
      } catch (err) {
        if (isCancelled) return;
        console.error('Error fetching roster:', err);
      }
    };

    // Initial immediate fetch
    fetchQR();
    fetchLiveStatus();
    fetchRoster();

    // Regular 2000ms polling while lecture is active
    timer = setInterval(() => {
      fetchQR();
      fetchLiveStatus();
      fetchRoster();
    }, 2000);

    return () => {
      isCancelled = true;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, [isSessionActive, activeSession?.session_id, portalTab]);

  // Handle Faculty Manual Override (supports direct modal params and fallback prompt)
  const handleManualOverride = async (rollNo, studentName, status = 'PRESENT', reason = null) => {
    const targetSessionId = activeSession?.session_id || sessionSummary?.session?.session_id;
    if (!targetSessionId) {
      alert('Please start or select a lecture session first before marking attendance!');
      return;
    }

    let finalReason = reason;
    if (!finalReason) {
      finalReason = window.prompt(
        `Enter mandatory justification reason for marking ${studentName} (${rollNo}) ${status}:`,
        'Phone Dead / In-Person Verification in Classroom'
      );
      if (!finalReason || !finalReason.trim()) return;
    }

    setActionLoading(true);
    try {
      await api.facultyManualAttendance({
        session_id: targetSessionId,
        roll_no: rollNo,
        status: status,
        reason: finalReason.trim()
      });

      // Refresh live roster UI
      const rData = await api.getSessionRoster(targetSessionId);
      if (rData && rData.roster) {
        setRoster(rData.roster);
        if (sessionSummary) {
          setSessionSummary(prev => {
            if (!prev) return prev;
            const updatedRoster = rData.roster;
            const pCount = updatedRoster.filter(s => s.status === 'PRESENT' || s.status === 'MANUAL_PRESENT').length;
            const aCount = updatedRoster.filter(s => s.status === 'ABSENT').length;
            const pendCount = updatedRoster.filter(s => s.status === 'PENDING_APPROVAL').length;
            const tCount = updatedRoster.length;
            const pct = tCount > 0 ? Math.round((pCount / tCount) * 100) : 0;
            return {
              ...prev,
              totalEnrolled: tCount,
              presentCount: pCount,
              absentCount: aCount,
              pendingCount: pendCount,
              attendancePct: pct,
              finalRoster: updatedRoster
            };
          });
        }
      }

      setManualSuccessMsg(`Student ${studentName} (${rollNo}) marked ${status} (Faculty Override logged in Audit Trail).`);
      setTimeout(() => setManualSuccessMsg(null), 4000);
    } catch (err) {
      alert('Manual override failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Exception Mode Approval/Rejection
  const handleApproveException = async (rollNo, action, remarks = null) => {
    const targetSessionId = activeSession?.session_id || sessionSummary?.session?.session_id;
    if (!targetSessionId) return;

    setActionLoading(true);
    try {
      await api.facultyApprove({
        session_id: targetSessionId,
        roll_no: rollNo,
        action: action,
        remarks: remarks || `Faculty ${action.toLowerCase()}d exception in classroom.`
      });

      // Refresh live feed & roster immediately
      const live = await api.getFacultyLiveSession(targetSessionId);
      setLiveData(live);
      const rData = await api.getSessionRoster(targetSessionId);
      if (rData && rData.roster) {
        setRoster(rData.roster);
        if (sessionSummary) {
          setSessionSummary(prev => {
            if (!prev) return prev;
            const updatedRoster = rData.roster;
            const pCount = updatedRoster.filter(s => s.status === 'PRESENT' || s.status === 'MANUAL_PRESENT').length;
            const aCount = updatedRoster.filter(s => s.status === 'ABSENT').length;
            const pendCount = updatedRoster.filter(s => s.status === 'PENDING_APPROVAL').length;
            const tCount = updatedRoster.length;
            const pct = tCount > 0 ? Math.round((pCount / tCount) * 100) : 0;
            return {
              ...prev,
              totalEnrolled: tCount,
              presentCount: pCount,
              absentCount: aCount,
              pendingCount: pendCount,
              attendancePct: pct,
              finalRoster: updatedRoster
            };
          });
        }
      }
      setManualSuccessMsg(`Student ${rollNo} exception request ${action}ED.`);
      setTimeout(() => setManualSuccessMsg(null), 4000);
    } catch (err) {
      alert('Approval action failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const presentCount = roster.filter(s => s.status === 'PRESENT' || s.status === 'MANUAL_PRESENT').length;
  const pendingCount = roster.filter(s => s.status === 'PENDING_APPROVAL').length;
  const totalCount = roster.length;
  const unmarkedCount = Math.max(0, totalCount - presentCount - pendingCount);
  const attendancePct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  const filteredRoster = roster.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchRoster.toLowerCase()) ||
      s.roll_no.toLowerCase().includes(searchRoster.toLowerCase());
    if (!matchesSearch) return false;
    if (wallFilter === 'PRESENT') return s.status === 'PRESENT' || s.status === 'MANUAL_PRESENT';
    if (wallFilter === 'PENDING') return s.status === 'PENDING_APPROVAL';
    if (wallFilter === 'UNMARKED') return s.status !== 'PRESENT' && s.status !== 'MANUAL_PRESENT' && s.status !== 'PENDING_APPROVAL';
    return true;
  });

  return (
    <>
      {/* =========================================================================
          FACULTY MOBILE-FIRST LAYOUT (< 768px Viewport)
          Adheres to Warm-White & Forest-Green Design System (Phase A)
      ========================================================================= */}
      <div className="faculty-mobile-app block md:hidden pb-bottom-nav">
        {/* Mobile Sticky Header */}
        <div className="max-w-md mx-auto px-4 pt-3 pb-2.5 flex items-center justify-between border-b border-slate-200/80 bg-white/95 backdrop-blur-sm sticky top-0 z-30">
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-extrabold text-[#111827] tracking-tight">
                {getGreeting()}, {facultyLastName}!
              </h1>
              <span className="text-base">👋</span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              {todayFormattedDate} &bull; {user?.department || 'CSE'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isSessionActive && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            )}

            <button
              type="button"
              onClick={() => navigateToMobileTab('profile')}
              className="relative p-0.5 rounded-full border-2 border-emerald-600/40 hover:border-emerald-600 transition focus:outline-none"
              title="Faculty Profile"
            >
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden">
                <User className="w-4 h-4 text-slate-700" />
              </div>
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
            </button>
          </div>
        </div>

        {/* Mobile Tab Content Container */}
        <div className="max-w-md mx-auto px-4 py-4 space-y-4">

          {/* TAB 1: HOME (Faculty Dashboard / Stepped Session Setup) */}
          {mobileTab === 'home' && (
            setupSlot ? (
              <FacultySessionSetupView
                user={user}
                initialClass={typeof setupSlot === 'object' ? setupSlot : null}
                todayClasses={facultyTodaySchedule}
                facultyGps={facultyGps}
                onBack={() => setSetupSlot(null)}
                onStartSession={async (targetSubject, duration) => {
                  await handleStartSession(targetSubject);
                  setSetupSlot(null);
                  navigateToMobileTab('live');
                }}
                starting={starting}
              />
            ) : (
              <FacultyDashboardView
                user={user}
                activeSession={activeSession}
                isSessionActive={isSessionActive}
                liveData={liveData}
                roster={roster}
                todayClasses={facultyTodaySchedule}
                loadingClasses={loadingSchedule}
                facultyGps={facultyGps}
                onRecalibrateGps={handleRecalibrateGps}
                ultrasonicBeaconActive={ultrasonicBeaconActive}
                onToggleUltrasonic={() => setUltrasonicBeaconActive(!ultrasonicBeaconActive)}
                onOpenSessionSetup={(slot) => handleOpenSessionSetup(slot)}
                onOpenLiveQR={() => navigateToMobileTab('live')}
                onOpenTimetable={() => navigateToMobileTab('classes')}
                onOpenProfile={() => navigateToMobileTab('profile')}
                onOpenNotifications={() => navigateToMobileTab('live')}
              />
            )
          )}

          {/* TAB 2: CLASSES (Faculty Timetable) */}
          {mobileTab === 'classes' && (
            setupSlot ? (
              <FacultySessionSetupView
                user={user}
                initialClass={typeof setupSlot === 'object' ? setupSlot : null}
                todayClasses={facultyTodaySchedule}
                facultyGps={facultyGps}
                onBack={() => setSetupSlot(null)}
                onStartSession={async (targetSubject, duration) => {
                  await handleStartSession(targetSubject);
                  setSetupSlot(null);
                  navigateToMobileTab('live');
                }}
                starting={starting}
              />
            ) : (
              <FacultyTimetableMobileView
                user={user}
                activeSession={activeSession}
                onBack={handleInAppBack}
                onSelectClassForSession={(slot) => handleOpenSessionSetup(slot)}
              />
            )
          )}

          {/* TAB 3: LIVE (Live Rotating QR, Session Metrics, or Summary Report) */}
          {mobileTab === 'live' && (
            sessionSummary ? (
              <FacultySessionSummaryView
                summary={sessionSummary}
                onBackToHome={() => {
                  setSessionSummary(null);
                  navigateToMobileTab('home');
                }}
                onViewRoster={() => navigateToMobileTab('students')}
              />
            ) : isSessionActive ? (
              <FacultyLiveSessionView
                user={user}
                activeSession={activeSession}
                qrData={qrData}
                liveData={liveData}
                roster={roster}
                facultyGps={facultyGps}
                onRecalibrateGps={handleRecalibrateGps}
                ultrasonicBeaconActive={ultrasonicBeaconActive}
                onToggleUltrasonic={() => setUltrasonicBeaconActive(!ultrasonicBeaconActive)}
                onOpenProjector={() => setQrProjectorOpen(true)}
                onViewRoster={() => navigateToMobileTab('students')}
                onEndSession={handleEndSession}
                ending={ending}
                onBack={handleInAppBack}
              />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleInAppBack}
                      className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition"
                      title="Back to Home"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <h2 className="text-sm font-bold text-[#111827]">Live Attendance QR</h2>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/90 text-slate-500 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <Play className="w-6 h-6 stroke-1" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#111827]">No Active Lecture Session</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                      Start a session from the Home tab or Timetable to broadcast dynamic, geofenced QR codes.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const currentOrNext = facultyTodaySchedule.find(c => c.is_current_slot) ||
                        facultyTodaySchedule.find(c => c.is_upcoming_slot) ||
                        facultyTodaySchedule[0];
                      handleOpenSessionSetup(currentOrNext || null);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-[#1A4731] hover:bg-[#143826] text-white text-xs font-bold shadow-md shadow-emerald-950/20 transition"
                  >
                    Setup Attendance Session
                  </button>
                </div>
              </div>
            )
          )}

          {/* TAB 4: STUDENTS (Real-Time Student Roster, Review Exceptions & Manual Marking) */}
          {mobileTab === 'students' && (
            <FacultyStudentRosterView
              roster={sessionSummary?.finalRoster || roster}
              subjectName={activeSession?.subject_name || sessionSummary?.session?.subject_name || subject}
              activeSession={activeSession || sessionSummary?.session}
              onApproveException={handleApproveException}
              onManualMark={handleManualOverride}
              onBack={handleInAppBack}
              actionLoading={actionLoading}
            />
          )}

          {/* TAB 5: PROFILE (Faculty Profile & Settings) */}
          {mobileTab === 'profile' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
                <button
                  type="button"
                  onClick={handleInAppBack}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition"
                  title="Back to Home"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h2 className="text-sm font-bold text-[#111827]">Faculty Profile</h2>
              </div>

              {/* Profile Card */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm text-center space-y-2">
                <div className="w-16 h-16 rounded-full bg-slate-100 border-2 border-emerald-600/40 mx-auto flex items-center justify-center font-black text-lg text-slate-700">
                  {getInitials(facultyName)}
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#111827]">{facultyName}</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {user?.roll_no || user?.faculty_id || 'FAC01'} &bull; {user?.department || 'Computer Science & Engineering'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{user?.email || 'faculty@smartattend.edu'}</p>
                </div>
              </div>

              {/* Settings Group */}
              <div className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-sm divide-y divide-slate-100">
                <div
                  onClick={() => setUltrasonicBeaconActive(!ultrasonicBeaconActive)}
                  className="py-2.5 px-2 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Radio className="w-4 h-4 text-[#1A4731]" />
                    <span className="text-xs font-semibold text-[#111827]">Ultrasonic Acoustic Beacon</span>
                  </div>
                  <span className={`text-[11px] font-bold ${ultrasonicBeaconActive ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {ultrasonicBeaconActive ? 'Active' : 'Muted'}
                  </span>
                </div>

                <div
                  onClick={handleRecalibrateGps}
                  className="py-2.5 px-2 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <MapPin className="w-4 h-4 text-[#1A4731]" />
                    <span className="text-xs font-semibold text-[#111827]">Recalibrate Faculty GPS</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500">Sync</span>
                </div>

                <div
                  onClick={() => navigateToMobileTab('classes')}
                  className="py-2.5 px-2 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-4 h-4 text-[#1A4731]" />
                    <span className="text-xs font-semibold text-[#111827]">Weekly Timetable Schedule</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>

              {/* Account Section & Logout */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(true)}
                  className="w-full py-3 px-4 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-xs flex items-center justify-center gap-2 transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out of SmartAttend</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Android Exit Confirmation Toast */}
        {exitToast && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-[#111827]/95 text-white text-xs font-semibold shadow-xl border border-slate-700/80 animate-in fade-in slide-in-from-bottom-2 duration-150">
            Press back again to exit SmartAttend
          </div>
        )}

        {/* Logout Confirmation Modal */}
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white text-[#111827] w-full max-w-sm rounded-3xl p-6 border border-slate-200 shadow-2xl space-y-4">
              <div className="flex items-center gap-2">
                <LogOut className="w-5 h-5 text-rose-600" />
                <h3 className="text-base font-extrabold text-[#111827]">
                  Log Out of SmartAttend?
                </h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                You will be returned to the login screen. Any ongoing lecture sessions can be resumed upon logging back in.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="w-full py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    onLogout?.();
                  }}
                  className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow-md shadow-rose-600/20"
                >
                  Yes, Log Out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Persistent Curved Faculty Bottom Navigation */}
        <FacultyBottomNav
          activeTab={mobileTab}
          onTabChange={navigateToMobileTab}
          onLaunchClick={() => {
            if (isSessionActive || sessionSummary) {
              navigateToMobileTab('live');
            } else {
              const currentOrNext = facultyTodaySchedule.find(c => c.is_current_slot) ||
                facultyTodaySchedule.find(c => c.is_upcoming_slot) ||
                facultyTodaySchedule[0];
              handleOpenSessionSetup(currentOrNext || null);
            }
          }}
          isSessionActive={isSessionActive}
        />
      </div>

      {/* =========================================================================
          FACULTY DESKTOP / TABLET CONSOLE (>= 768px Viewport)
          Preserves 100% of Existing Desktop Controls, Projector & Classroom Wall
      ========================================================================= */}
      <div className="hidden md:block max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-6">

      {/* Faculty Portal Navigation Tabs (Phase 4 Timetable Integration) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-800">
        <button
          type="button"
          onClick={() => setPortalTab('live')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            portalTab === 'live'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Live Attendance & Console</span>
          {isSessionActive && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] bg-emerald-400 text-slate-950 font-black animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-950"></span>
              ACTIVE
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setPortalTab('timetable')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            portalTab === 'timetable'
              ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>My Timetable</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-brand-500/20 text-brand-300 font-semibold border border-brand-500/30">
            Weekly Schedule
          </span>
        </button>
      </div>

      {/* TAB 1: Live Lecture & Anti-Proxy Attendance Console */}
      {portalTab === 'live' && (
        <div className="space-y-6">

          {/* Top Banner & Session Starter */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              FACULTY CONSOLE
            </span>
            {facultyGps.status === 'READY' && facultyGps.lat != null ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <MapPin className="w-3 h-3 text-emerald-400" />
                Live GPS: {Number(facultyGps.lat).toFixed(4)}, {Number(facultyGps.lng).toFixed(4)} (±{facultyGps.accuracy || 15}m) • 150m Geofence
              </span>
            ) : facultyGps.status === 'INITIALIZING' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                Acquiring Faculty GPS...
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <MapPin className="w-3 h-3 text-amber-400" />
                Campus Geofence (150m Active)
              </span>
            )}
            <button
              type="button"
              onClick={handleRecalibrateGps}
              title="Recalibrate and sync live faculty coordinates with server"
              className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1 transition"
            >
              <RefreshCw className="w-2.5 h-2.5" /> Sync GPS
            </button>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white mt-1">Live Lecture & Smart Anti-Proxy Center</h1>
          <p className="text-xs text-slate-400">
            Broadcasting dynamic encrypted tokens (20-second rolling window) with real-time fraud detection.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={isSessionActive}
            className="bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-brand-500 disabled:opacity-60"
          >
            <option value="CS301 - Operating Systems">CS301 - Operating Systems</option>
            <option value="CS402 - Machine Learning">CS402 - Machine Learning</option>
            <option value="CS305 - Database Systems">CS305 - Database Systems</option>
          </select>

          {!isSessionActive ? (
            <button
              onClick={handleStartSession}
              disabled={starting}
              className="px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-500/25 flex items-center gap-2 transition active:scale-95 disabled:opacity-50"
            >
              {starting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
              Start Lecture Session
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <div className="px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                ACTIVE: {activeSession?.session_code || activeSession?.session_id?.substring(0, 8) || 'SESSION'}
              </div>
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-indigo-300">
                <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                <span>Geofence: 150m (Live Faculty GPS: {facultyGps.lat ? `${facultyGps.lat.toFixed(4)}, ${facultyGps.lng.toFixed(4)}` : 'Syncing...'})</span>
              </div>

              {/* Ultrasonic Beacon Toggle */}
              <button
                type="button"
                onClick={() => setUltrasonicBeaconActive(!ultrasonicBeaconActive)}
                title={ultrasonicBeaconActive ? "Ultrasonic inaudible room audio beacon ACTIVE (18.8 kHz)" : "Ultrasonic beacon MUTED"}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                  ultrasonicBeaconActive
                    ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-300'
                    : 'bg-slate-900 border border-slate-800 text-slate-500 hover:text-slate-400'
                }`}
              >
                <Radio className={`w-3.5 h-3.5 ${ultrasonicBeaconActive ? 'text-indigo-400 animate-pulse' : 'text-slate-500'}`} />
                <span className="hidden md:inline">Ultrasonic:</span> {ultrasonicBeaconActive ? 'ON' : 'OFF'}
              </button>

              {/* Panoramic AI Snapshot Button */}
              <button
                type="button"
                onClick={() => {
                  setShowPanoramicModal(true);
                  setPanoramicResult(null);
                }}
                className="px-3.5 py-2 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-md shadow-purple-500/20 flex items-center gap-1.5 transition active:scale-95"
                title="Scan entire lecture hall at once with InsightFace Multi-Face AI"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Panoramic AI</span>
              </button>

              <button
                onClick={handleEndSession}
                disabled={ending}
                className="px-4 py-2 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-md shadow-rose-500/20 flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
              >
                {ending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5 fill-white" />}
                End Session
              </button>
            </div>
          )}
        </div>
      </div>

      {manualSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{manualSuccessMsg}</span>
        </div>
      )}

      {/* Main Grid: Rotating QR Code Panel + Live Counters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Column 1: Rotating Dynamic QR Code Projector View */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="absolute top-3 left-4 flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5 text-brand-400" /> Rotating Token
          </div>

          {isSessionActive && qrData && (
            <button
              type="button"
              onClick={() => setQrProjectorOpen(true)}
              title="Open Fullscreen Projector View"
              className="absolute top-2.5 right-3 p-1.5 rounded-lg bg-slate-900/90 border border-slate-700 hover:border-brand-500 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-[11px] font-semibold shadow-sm"
            >
              <Maximize2 className="w-3.5 h-3.5 text-brand-400" />
              <span className="hidden sm:inline">Projector View</span>
            </button>
          )}

          {isSessionActive && qrData ? (
            <div className="space-y-4 pt-4 w-full flex flex-col items-center">
              {/* QR Code Container */}
              <div className="p-4 rounded-2xl bg-white shadow-2xl shadow-brand-500/10 border-4 border-slate-800">
                <QRCodeSVG
                  value={qrData.qr_token}
                  size={210}
                  level="H"
                  includeMargin={true}
                />
              </div>

              {/* 20-Second Visual Progress Bar */}
              <div className="w-full max-w-xs space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-400">Refreshes in</span>
                  <span className="text-brand-400 font-mono text-sm">{qrData.expires_in_seconds}s</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-brand-500 to-indigo-400 transition-all duration-300 ease-linear rounded-full"
                    style={{ width: `${(qrData.expires_in_seconds / (qrData.refresh_interval_seconds || 20)) * 100}%` }}
                  ></div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400 truncate max-w-xs">
                {qrData.qr_token}
              </div>
            </div>
          ) : (
            <div className="py-16 text-slate-500 space-y-2">
              <Play className="w-12 h-12 mx-auto text-slate-600 stroke-1" />
              <p className="text-xs font-medium">Click "Start Lecture Session" to project the rotating dynamic QR code.</p>
            </div>
          )}
        </div>

        {/* Column 2 & 3: Live Counters & Class Roster / Live Classroom Wall */}
        <div className="lg:col-span-2 space-y-6">

          {/* Counters Row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="glass-card rounded-2xl p-4 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Present in Class</span>
              <p className="text-2xl font-black text-emerald-400 mt-1">
                {liveData?.counters?.present_count ?? presentCount}
              </p>
              <span className="text-[10px] text-slate-500">
                {totalCount > 0 ? `${Math.round(((liveData?.counters?.present_count ?? presentCount) / totalCount) * 100)}% of enrolled` : 'Awaiting session'}
              </span>
            </div>
            <div className="glass-card rounded-2xl p-4 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Pending Approvals</span>
              <p className="text-2xl font-black text-amber-400 mt-1">
                {liveData?.counters?.pending_count ?? pendingCount}
              </p>
              <span className="text-[10px] text-slate-500">Borrowed devices</span>
            </div>
            <div className="glass-card rounded-2xl p-4 border border-slate-800 flex flex-col justify-between">
              <div>
                <span className="text-xs text-slate-400 font-medium">Proxy Alerts Caught</span>
                <p className="text-2xl font-black text-rose-400 mt-1">
                  {liveData?.counters?.alerts_count || 0}
                </p>
                <span className="text-[10px] text-slate-500">Prevented frauds</span>
              </div>
              <button
                type="button"
                onClick={handleOpenSyndicateInspector}
                className="mt-2 text-[10px] font-bold text-rose-300 hover:text-white flex items-center gap-1 group transition w-fit"
                title="View AI detected device-sharing rings and proxy syndicates"
              >
                <Network className="w-3 h-3 group-hover:scale-110 transition-transform" />
                <span>Syndicate Intel &rarr;</span>
              </button>
            </div>
          </div>

          {/* Real-time Attendance Velocity & UGC 75% Threshold Bar */}
          {activeSession && totalCount > 0 && (
            <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    Attendance Velocity
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {presentCount} of {totalCount} Enrolled ({attendancePct}%)
                  </span>
                </div>
                {attendancePct >= 75 ? (
                  <span className="text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                    <CheckCheck className="w-3.5 h-3.5" /> Met 75% Mandatory UGC Quorum
                  </span>
                ) : (
                  <span className="text-amber-400 font-medium text-[11px]">
                    Need {Math.max(0, Math.ceil(totalCount * 0.75) - presentCount)} more students for 75% UGC Quorum
                  </span>
                )}
              </div>

              {/* Progress Track */}
              <div className="relative w-full h-3 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                {/* 75% Marker */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-amber-400/80 z-10 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                  style={{ left: '75%' }}
                  title="75% UGC Minimum Attendance Rule"
                />
                <div
                  className={`h-full transition-all duration-700 ease-out rounded-full ${
                    attendancePct >= 75
                      ? 'bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-400 shadow-lg shadow-emerald-500/30'
                      : 'bg-gradient-to-r from-brand-600 to-indigo-500'
                  }`}
                  style={{ width: `${Math.min(100, attendancePct)}%` }}
                />
              </div>
            </div>
          )}

          {/* Real-Time Arrival Toast Celebration */}
          {latestArrival && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-indigo-500/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between shadow-xl shadow-emerald-500/10 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/30 border border-emerald-400/50 flex items-center justify-center font-bold text-emerald-200 text-xs">
                  {getInitials(latestArrival.name)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">{latestArrival.name}</span>
                    <span className="font-mono text-[11px] text-emerald-400">({latestArrival.roll_no})</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/30 text-emerald-200 font-bold">VERIFIED</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Just checked in with live facial verification • {latestArrival.distance != null ? `${latestArrival.distance}m inside campus` : 'In classroom'}
                  </p>
                </div>
              </div>
              <span className="font-mono text-[11px] text-slate-400 hidden sm:inline">{latestArrival.time}</span>
            </div>
          )}

          {/* Interactive Live Classroom Wall & Manual Override Panel */}
          <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-4">
            
            {/* Header: Controls, View Switcher & Filters */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Tv className="w-4 h-4 text-brand-400" />
                  Live Classroom Wall
                  <span className="text-[11px] font-normal text-slate-400">
                    (Interactive Projector Grid & 1-Click Verification)
                  </span>
                </h3>
              </div>

              {/* View Switcher, Sound & Fullscreen Controls */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    value={searchRoster}
                    onChange={(e) => setSearchRoster(e.target.value)}
                    placeholder="Search name / roll..."
                    className="bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 w-36 sm:w-44"
                  />
                </div>

                {/* View Switcher: Wall vs Table */}
                <div className="inline-flex rounded-lg bg-slate-900 border border-slate-800 p-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode('wall')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                      viewMode === 'wall' ? 'bg-brand-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Live Avatar Grid View for Classroom Projection"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" /> Wall
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('table')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                      viewMode === 'table' ? 'bg-brand-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Detailed Audit Table View"
                  >
                    <List className="w-3.5 h-3.5" /> Table
                  </button>
                </div>

                {/* Sound Chime Toggle */}
                <button
                  type="button"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  title={soundEnabled ? 'Arrival chime sound ON' : 'Arrival chime sound MUTED'}
                  className={`p-1.5 rounded-lg border text-xs transition ${
                    soundEnabled
                      ? 'bg-slate-900 border-slate-700 text-emerald-400 hover:text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400'
                  }`}
                >
                  {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>

                {/* Fullscreen / Theater Mode */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  title="Toggle Projector Theater Mode"
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white transition"
                >
                  {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2 text-xs">
              <button
                type="button"
                onClick={() => setWallFilter('ALL')}
                className={`px-3 py-1 rounded-lg font-medium transition ${
                  wallFilter === 'ALL'
                    ? 'bg-slate-800 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All Enrolled ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setWallFilter('PRESENT')}
                className={`px-3 py-1 rounded-lg font-medium flex items-center gap-1.5 transition ${
                  wallFilter === 'PRESENT'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold'
                    : 'text-slate-400 hover:text-emerald-300'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Present ({presentCount})
              </button>
              {pendingCount > 0 && (
                <button
                  type="button"
                  onClick={() => setWallFilter('PENDING')}
                  className={`px-3 py-1 rounded-lg font-medium flex items-center gap-1.5 transition ${
                    wallFilter === 'PENDING'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold'
                      : 'text-slate-400 hover:text-amber-300'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                  Pending ({pendingCount})
                </button>
              )}
              <button
                type="button"
                onClick={() => setWallFilter('UNMARKED')}
                className={`px-3 py-1 rounded-lg font-medium flex items-center gap-1.5 transition ${
                  wallFilter === 'UNMARKED'
                    ? 'bg-slate-800 text-slate-200 font-bold'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-slate-600"></span>
                Unmarked ({unmarkedCount})
              </button>
            </div>

            {/* View Mode: Live Wall (Avatar Grid) */}
            {viewMode === 'wall' ? (
              <div>
                {filteredRoster.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 space-y-2">
                    <Users className="w-10 h-10 mx-auto text-slate-600 stroke-1" />
                    <p className="text-xs font-medium">
                      {isSessionActive
                        ? 'No students found matching current filter.'
                        : 'Start a lecture session to load enrolled students onto the Live Wall.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 max-h-[500px] overflow-y-auto pr-1">
                    {filteredRoster.map((s) => {
                      const isPresent = s.status === 'PRESENT' || s.status === 'MANUAL_PRESENT';
                      const isPending = s.status === 'PENDING_APPROVAL';

                      return (
                        <div
                          key={s.roll_no}
                          className={`relative rounded-xl p-3 border transition-all duration-300 flex flex-col items-center text-center group ${
                            isPresent
                              ? 'bg-emerald-950/20 border-emerald-500/40 shadow-lg shadow-emerald-500/5 hover:border-emerald-400'
                              : isPending
                              ? 'bg-amber-950/20 border-amber-500/40 animate-pulse'
                              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                          }`}
                        >
                          {/* Top Status Pin */}
                          <div className="absolute top-2 right-2">
                            {isPresent ? (
                              <span
                                className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow"
                                title="Verified Present"
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </span>
                            ) : isPending ? (
                              <span
                                className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"
                                title="Pending Faculty Review"
                              />
                            ) : (
                              <span
                                className="w-2 h-2 rounded-full bg-slate-700 group-hover:bg-slate-600"
                                title="Not Marked"
                              />
                            )}
                          </div>

                          {/* Student Avatar with Deterministic Gradient */}
                          <div
                            className={`w-12 h-12 rounded-full bg-gradient-to-tr ${getAvatarGradient(
                              s.roll_no
                            )} flex items-center justify-center text-white font-black text-sm shadow-md transition-transform duration-300 group-hover:scale-105 ${
                              isPresent
                                ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-950'
                                : isPending
                                ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-950'
                                : 'opacity-70 group-hover:opacity-100'
                            }`}
                          >
                            {getInitials(s.name)}
                          </div>

                          {/* Name & Roll No */}
                          <div className="mt-2.5 w-full">
                            <h4
                              className={`text-xs font-bold truncate ${
                                isPresent ? 'text-white' : 'text-slate-300'
                              }`}
                              title={s.name}
                            >
                              {s.name}
                            </h4>
                            <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                              {s.roll_no}
                            </p>
                          </div>

                          {/* Status Pill or Fast 1-Click Action */}
                          <div className="mt-2 w-full pt-2 border-t border-slate-800/80">
                            {isPresent ? (
                              <div className="text-[10px] font-mono text-emerald-400 space-y-0.5">
                                <span className="font-bold flex items-center justify-center gap-1">
                                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                                  {s.status === 'MANUAL_PRESENT' ? 'Teacher Signed' : s.face_status === 'PANORAMIC_AI_MATCH' ? 'Panoramic AI' : 'Verified'}
                                </span>
                                {s.ultrasonic_verified && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 inline-flex items-center gap-0.5">
                                    <Radio className="w-2 h-2" /> Acoustic
                                  </span>
                                )}
                                {s.marked_at && (
                                  <span className="text-[9px] text-slate-400 block">
                                    {new Date(s.marked_at).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      second: '2-digit'
                                    })}
                                  </span>
                                )}
                              </div>
                            ) : isPending ? (
                              <div className="flex gap-1 w-full justify-center">
                                <button
                                  type="button"
                                  onClick={() => handleApproveException(s.roll_no, 'APPROVE')}
                                  disabled={actionLoading}
                                  className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] transition"
                                  title="Approve student exception"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleApproveException(s.roll_no, 'REJECT')}
                                  disabled={actionLoading}
                                  className="px-1.5 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] transition"
                                  title="Reject student exception"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleManualOverride(s.roll_no, s.name)}
                                disabled={actionLoading}
                                className="w-full py-1 px-1.5 rounded-lg bg-slate-800 hover:bg-brand-600 text-slate-300 hover:text-white font-medium text-[10px] transition active:scale-95 disabled:opacity-50"
                                title="One-click manual override if student is sitting in class"
                              >
                                Mark Present
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* View Mode: Detailed Table View */
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                      <th className="py-2.5 px-3">Roll No</th>
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3">Dept</th>
                      <th className="py-2.5 px-3">Time Marked</th>
                      <th className="py-2.5 px-3">Location / Geofence</th>
                      <th className="py-2.5 px-3 text-right">Status / Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredRoster.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="py-6 text-center text-slate-500 text-xs">
                          {activeSession ? 'No students found matching search.' : 'Start a lecture session to load enrolled students.'}
                        </td>
                      </tr>
                    ) : (
                      filteredRoster.map((s) => (
                        <tr key={s.roll_no} className="hover:bg-slate-900/40">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-300">{s.roll_no}</td>
                          <td className="py-2.5 px-3 text-slate-200 font-medium">{s.name}</td>
                          <td className="py-2.5 px-3 text-slate-400">{s.department}</td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-300">
                            {s.marked_at ? new Date(s.marked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-[11px]">
                            {s.distance_meters != null ? (
                              <span className="inline-flex items-center gap-1 font-mono text-emerald-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                {s.distance_meters}m (Inside Campus)
                              </span>
                            ) : s.status === 'MANUAL_PRESENT' ? (
                              <span className="text-slate-400 italic">Teacher Override</span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {s.status === 'PRESENT' || s.status === 'MANUAL_PRESENT' ? (
                              <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 font-semibold text-[11px] inline-flex items-center gap-1">
                                <Check className="w-3 h-3" /> {s.status === 'MANUAL_PRESENT' ? 'Manual Present' : 'Present'}
                              </span>
                            ) : s.status === 'PENDING_APPROVAL' ? (
                              <span className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 font-semibold text-[11px] inline-flex items-center gap-1">
                                Pending Approval
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleManualOverride(s.roll_no, s.name)}
                                disabled={actionLoading}
                                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] shadow transition active:scale-95 disabled:opacity-50"
                              >
                                Mark Present Manually
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>


      </div>

      {/* Exception Approval Queue & Live Security Red Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 1. Exception Approval Queue (Selfies of Borrowed Phones) */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-amber-400" />
              Exception Mode Approval Queue
            </h3>
            <span className="text-xs font-mono font-bold text-amber-400">
              {liveData?.pending_approvals?.length || 0} Pending
            </span>
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {liveData?.pending_approvals?.length ? (
              liveData.pending_approvals.map((req, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-slate-900/90 border border-amber-500/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {req.live_selfie_base64 && (
                      <img
                        src={req.live_selfie_base64}
                        alt="Selfie"
                        className="w-12 h-12 rounded-lg object-cover border border-amber-500/40"
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-white">{req.student_name}</span>
                        <span className="font-mono text-[10px] text-amber-300">({req.roll_no})</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-mono truncate max-w-[180px]">
                        Device: {req.device_id}
                      </p>
                      <p className="text-[10px] text-emerald-400 font-semibold">
                        GPS: {req.distance_meters}m | Face: {req.face_match_score}%
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleApproveException(req.roll_no, 'APPROVE')}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApproveException(req.roll_no, 'REJECT')}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 py-6 text-center">No pending exception requests currently.</p>
            )}
          </div>
        </div>

        {/* 2. Real-Time Anti-Proxy Security Alerts (Red Feed) */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-rose-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              Live Anti-Proxy Security Alerts (Caught Frauds)
            </h3>
            <span className="text-xs font-mono font-bold text-rose-400">
              {liveData?.security_alerts?.length || 0} Alerts
            </span>
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {liveData?.security_alerts?.length ? (
              liveData.security_alerts.map((alert, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-300 font-mono text-[11px]">{alert.failed_gate}</span>
                    <span className="text-[10px] text-slate-400 font-mono">Roll: {alert.roll_no}</span>
                  </div>
                  <p className="text-slate-300 text-[11px]">{alert.reason}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 py-6 text-center">No security alerts or fraud attempts detected in this lecture.</p>
            )}
          </div>
        </div>

      </div>
        </div>
      )}

      {/* TAB 2: Official Faculty Timetable (Phase 4 View) */}
      {portalTab === 'timetable' && (
        <FacultyTimetable
          user={user}
          activeSession={activeSession}
          onStartAttendance={(slot) => {
            const fullSubj = `${slot.subject_code} - ${slot.subject_name}`;
            handleStartSession(fullSubj);
          }}
          onSwitchToLive={() => setPortalTab('live')}
        />
      )}

      {/* Category 2 Modal 1: Panoramic Classroom Snapshot AI */}
      {showPanoramicModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="glass-panel w-full max-w-4xl rounded-3xl border border-slate-700 p-6 space-y-5 bg-slate-900/95 max-h-[90vh] overflow-y-auto shadow-2xl">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Camera className="w-5 h-5 text-purple-400" />
                  Panoramic Classroom AI Face Scanner
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Category 2 AI
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Scan 40–80 students in a single wide lecture hall photo. Multi-face InsightFace AI detects and batch-verifies enrolled students simultaneously.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPanoramicModal(false);
                  handleStopPanoramicWebcam();
                }}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Switcher: Upload Photo vs Live Webcam Viewfinder */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <button
                type="button"
                onClick={() => {
                  setPanoramicTab('upload');
                  handleStopPanoramicWebcam();
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                  panoramicTab === 'upload' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white bg-slate-800/60'
                }`}
              >
                <Upload className="w-3.5 h-3.5" /> Upload Lecture Hall Photo
              </button>
              <button
                type="button"
                onClick={() => {
                  setPanoramicTab('camera');
                  handleStartPanoramicWebcam();
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                  panoramicTab === 'camera' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white bg-slate-800/60'
                }`}
              >
                <Camera className="w-3.5 h-3.5" /> Webcam / Camera Viewfinder
              </button>
            </div>

            {/* Tab 1: Upload Wide Photo */}
            {panoramicTab === 'upload' && !panoramicResult && (
              <div className="space-y-4">
                <label className="border-2 border-dashed border-slate-700 hover:border-purple-500/60 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition bg-slate-900/40 hover:bg-slate-900/80">
                  <Upload className="w-10 h-10 text-purple-400 mb-2" />
                  <span className="text-xs font-bold text-white">Click or drag a wide classroom picture</span>
                  <span className="text-[11px] text-slate-500 mt-1">Supports high-res JPEG, PNG, WebP up to 15MB</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadPanoramicPhoto}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {/* Tab 2: Live Camera Viewfinder */}
            {panoramicTab === 'camera' && !panoramicResult && (
              <div className="space-y-3 flex flex-col items-center">
                <div className="relative rounded-2xl overflow-hidden border border-slate-700 w-full max-w-lg aspect-video bg-black flex items-center justify-center">
                  <video
                    ref={panoramicVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCapturePanoramicSnapshot}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg"
                >
                  <Camera className="w-4 h-4" /> Snap Classroom View
                </button>
              </div>
            )}

            {/* Preview Selected / Captured Image */}
            {panoramicImage && !panoramicResult && (
              <div className="space-y-3">
                <div className="relative rounded-2xl overflow-hidden border border-purple-500/40 max-h-72 flex items-center justify-center bg-black">
                  <img src={panoramicImage} alt="Classroom Preview" className="max-h-72 w-auto object-contain" />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPanoramicImage(null)}
                    disabled={panoramicLoading}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold"
                  >
                    Clear Photo
                  </button>
                  <button
                    type="button"
                    onClick={handleRunPanoramicAI}
                    disabled={panoramicLoading}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-500/25 flex items-center gap-2 disabled:opacity-50"
                  >
                    {panoramicLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Scanning 60+ Faces with InsightFace...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Run Multi-Face AI (Auto-Mark Present)
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Panoramic AI Results View */}
            {panoramicResult && (
              <div className="space-y-4">
                {/* Metrics Pill Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="glass-card rounded-xl p-3 border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Faces Detected</span>
                    <p className="text-xl font-black text-white mt-0.5">{panoramicResult.total_detected_faces}</p>
                  </div>
                  <div className="glass-card rounded-xl p-3 border border-emerald-500/30 bg-emerald-500/10 text-center">
                    <span className="text-[10px] text-emerald-300 uppercase font-semibold">Enrolled Matched</span>
                    <p className="text-xl font-black text-emerald-400 mt-0.5">{panoramicResult.matched_count}</p>
                  </div>
                  <div className="glass-card rounded-xl p-3 border border-purple-500/30 bg-purple-500/10 text-center">
                    <span className="text-[10px] text-purple-300 uppercase font-semibold">Auto-Marked Present</span>
                    <p className="text-xl font-black text-purple-300 mt-0.5">{panoramicResult.auto_marked_count}</p>
                  </div>
                  <div className="glass-card rounded-xl p-3 border border-amber-500/30 bg-amber-500/10 text-center">
                    <span className="text-[10px] text-amber-300 uppercase font-semibold">Visitors / Unenrolled</span>
                    <p className="text-xl font-black text-amber-400 mt-0.5">{panoramicResult.unmatched_count}</p>
                  </div>
                </div>

                {/* Annotated Image with Green & Amber Boxes */}
                <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-black flex items-center justify-center max-h-96">
                  <img
                    src={panoramicResult.annotated_image_base64}
                    alt="AI Annotated Classroom"
                    className="max-h-96 w-auto object-contain"
                  />
                </div>

                {/* Matched Students Tag List */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Verified Students (Auto-Updated on Live Classroom Wall):
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1 bg-slate-900/60 rounded-xl border border-slate-800">
                    {panoramicResult.matched_students.map((st, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-[11px] font-mono flex items-center gap-1"
                      >
                        <span className="font-bold">{st.name}</span> ({st.roll_no}) • {st.confidence_score}%
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setPanoramicResult(null);
                      setPanoramicImage(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
                  >
                    Scan Another Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPanoramicModal(false)}
                    className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg"
                  >
                    Done & Return to Live Wall
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Category 2 Modal 2: Fraud Syndicate & Proxy Ring Intelligence */}
      {showSyndicateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="glass-panel w-full max-w-3xl rounded-3xl border border-rose-500/40 p-6 space-y-5 bg-slate-900/95 max-h-[90vh] overflow-y-auto shadow-2xl">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-rose-300 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-rose-400" />
                  AI Fraud Syndicate & Proxy Ring Intelligence
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    Category 2 ML
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Bipartite graph clustering detects shared physical devices, rapid replay submissions, and repeat gate violations.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSyndicateModal(false)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {syndicateLoading ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-rose-400" />
                <p className="text-xs">Computing fraud graph clusters and analyzing device fingerprints...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Metric Summary */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="glass-card rounded-xl p-3 border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Caught Breaches</span>
                    <p className="text-xl font-black text-rose-400 mt-0.5">{syndicateData?.total_alerts || 0}</p>
                  </div>
                  <div className="glass-card rounded-xl p-3 border border-amber-500/30 bg-amber-500/10 text-center">
                    <span className="text-[10px] text-amber-300 uppercase font-semibold">Syndicate Rings</span>
                    <p className="text-xl font-black text-amber-400 mt-0.5">{syndicateData?.syndicates_detected || 0}</p>
                  </div>
                  <div className="glass-card rounded-xl p-3 border border-indigo-500/30 bg-indigo-500/10 text-center">
                    <span className="text-[10px] text-indigo-300 uppercase font-semibold">Status</span>
                    <p className="text-sm font-bold text-emerald-400 mt-1">Active Defense</p>
                  </div>
                </div>

                {/* Detected Syndicates List */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Network className="w-4 h-4 text-rose-400" />
                    Detected Proxy Syndicates & Collusion Clusters:
                  </h4>

                  {syndicateData?.syndicates?.length ? (
                    syndicateData.syndicates.map((syn, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-xs text-rose-300">{syn.syndicate_id}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            syn.severity === 'CRITICAL' ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'
                          }`}>
                            {syn.severity} RISK
                          </span>
                        </div>
                        <p className="text-xs text-slate-200 font-medium">{syn.description}</p>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          <span className="text-slate-500">Involved Roll Nos:</span>
                          <span className="font-mono font-bold text-indigo-300">{syn.involved_students?.join(', ')}</span>
                        </div>
                        <p className="text-[10px] text-amber-300 italic pt-1 border-t border-rose-500/20">
                          Recommendation: {syn.recommendation}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-slate-500 text-xs">
                      No multi-user device-sharing or coordinated proxy rings detected in this lecture session.
                    </div>
                  )}
                </div>

                {/* Recent Alerts Feed */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-300">Recent Anti-Proxy Forensics (Raw Gates):</h4>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {syndicateData?.alerts?.length ? (
                      syndicateData.alerts.map((al, idx) => (
                        <div key={idx} className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs flex items-center justify-between">
                          <div>
                            <span className="font-mono font-bold text-rose-400 text-[11px]">{al.failed_gate}</span>
                            <span className="text-slate-400 text-[10px] ml-2">Roll: {al.roll_no || 'Unknown'}</span>
                            <p className="text-slate-300 text-[10px] mt-0.5">{al.reason}</p>
                          </div>
                          <span className="text-[9px] font-mono text-slate-500">{al.created_at ? new Date(al.created_at).toLocaleTimeString() : ''}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500 py-3 text-center">No alerts logged yet.</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowSyndicateModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition"
                  >
                    Close Inspector
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Dedicated High-Contrast Fullscreen Projector Modal for Lecture Halls */}
      {qrProjectorOpen && qrData && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-2xl flex flex-col items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="max-w-2xl w-full flex flex-col items-center text-center space-y-6">
            <div className="flex items-center justify-between w-full border-b border-slate-800 pb-4">
              <div className="text-left">
                <h2 className="text-xl font-black text-white tracking-wide">
                  {subject || 'Live Lecture Session'}
                </h2>
                <p className="text-xs text-slate-400">
                  Scan using SmartAttend-AI PWA on mobile &bull; Session {activeSession?.session_id || 'Active'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQrProjectorOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                <Minimize2 className="w-4 h-4" />
                <span>Exit Projector</span>
              </button>
            </div>

            {/* Giant QR Code Display */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white shadow-2xl shadow-indigo-500/20 border-8 border-slate-800">
              <QRCodeSVG
                value={qrData.qr_token}
                size={340}
                level="H"
                includeMargin={true}
              />
            </div>

            {/* Live Progress Bar and Timer */}
            <div className="w-full max-w-md space-y-2">
              <div className="flex items-center justify-between text-sm font-bold">
                <span className="text-slate-400">Next Cryptographic Refresh:</span>
                <span className="text-indigo-400 font-mono text-lg">{qrData.expires_in_seconds}s</span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 via-brand-500 to-teal-400 transition-all duration-300 ease-linear rounded-full"
                  style={{ width: `${(qrData.expires_in_seconds / (qrData.refresh_interval_seconds || 20)) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Attendance count */}
            <div className="flex items-center gap-3 text-xs font-semibold text-slate-300">
              <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Present: {liveData?.counters?.present_count ?? 0} Students
              </span>
              <span className="text-slate-500">&bull;</span>
              <span className="text-slate-400 font-mono text-[11px] truncate max-w-xs">
                Token: {qrData.qr_token.slice(0, 24)}...
              </span>
            </div>
          </div>
        </div>
      )}

      </div>
    </>
  );
}
