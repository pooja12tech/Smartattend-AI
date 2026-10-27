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

import { useMediaQuery } from '../hooks/useMediaQuery';
import DesktopLayout from '../desktop/DesktopLayout';
import DesktopFacultyHome from '../desktop/faculty/DesktopFacultyHome';
import { navigateToPath, parsePath } from '../router';
import { toast } from './ui/Toast';
import InstallAppButton from './InstallAppButton';
import SmartAttendLoader from './ui/SmartAttendLoader';

export default function FacultyPortal({ user, onLogout }) {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
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

  // Faculty Notifications & Alerts Modal State
  const [showFacultyNotifications, setShowFacultyNotifications] = useState(false);

  // Mobile PWA Navigation View State (Phase A: 'home' | 'classes' | 'live' | 'students' | 'profile')
  const getInitialFacultyTab = () => {
    const { role, tab } = parsePath();
    if (role === 'faculty' && tab) {
      const cleanTab = tab.toLowerCase();
      if (['home', 'classes', 'live', 'students', 'reports', 'profile'].includes(cleanTab)) {
        return cleanTab;
      }
      if (cleanTab === 'timetable') return 'classes';
      if (cleanTab === 'roster') return 'students';
      if (cleanTab === 'setup') return 'home';
    }
    return 'home';
  };

  const [mobileTab, setMobileTab] = useState(getInitialFacultyTab);
  const mobileTabRef = useRef(mobileTab);
  useEffect(() => {
    mobileTabRef.current = mobileTab;
  }, [mobileTab]);

  // Synchronize mobileTab with clean URL path on navigation
  useEffect(() => {
    const handlePopState = () => {
      const tab = getInitialFacultyTab();
      setMobileTab(tab);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [facultyTodaySchedule, setFacultyTodaySchedule] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
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
    setSetupSlot(null);
    setMobileTab(targetTab);
    navigateToPath(`/faculty/${targetTab}`);
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
    const startTime = Date.now();
    try {
      const res = await api.getFacultyTimetableToday();
      if (res && res.today_classes) {
        setFacultyTodaySchedule(res.today_classes);
      }
      const elapsed = Date.now() - startTime;
      if (elapsed < 800) {
        await new Promise((resolve) => setTimeout(resolve, 800 - elapsed));
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

  // Modal & sheet back button handler
  useEffect(() => {
    const handlePopState = () => {
      // 1. If any modal is open, close it first
      if (showPanoramicModal) {
        setShowPanoramicModal(false);
        return;
      }
      if (showFacultyNotifications) {
        setShowFacultyNotifications(false);
        return;
      }
      if (showSyndicateModal) {
        setShowSyndicateModal(false);
        return;
      }
      if (qrProjectorOpen) {
        setQrProjectorOpen(false);
        return;
      }
      if (showLogoutConfirm) {
        setShowLogoutConfirm(false);
        return;
      }

      // 1b. If session summary is visible, return to home dashboard
      if (sessionSummaryRef.current) {
        setSessionSummary(null);
        navigateToMobileTab('home');
        return;
      }

      // 2. If in stepped session setup, return to dashboard
      if (setupSlotRef.current) {
        setSetupSlot(null);
        return;
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showPanoramicModal, showSyndicateModal, showFacultyNotifications, qrProjectorOpen, showLogoutConfirm]);

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
      'from-emerald-600 to-teal-600',
      'from-emerald-600 to-teal-600',
      'from-blue-600 to-cyan-600',
      'from-emerald-600 to-fuchsia-600',
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
      toast.error('Camera access failed: ' + (err.message || 'Permission denied'));
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
      toast.warning('Please upload or snap a classroom photo first.');
      return;
    }
    if (!activeSession) {
      toast.warning('Please start a lecture session first.');
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
        const msg = `Panoramic AI: Successfully verified and marked ${res.auto_marked_count} students PRESENT!`;
        toast.success(msg);
        setManualSuccessMsg(msg);
        setTimeout(() => setManualSuccessMsg(null), 5000);

        // Immediate refresh of roster and live stats
        const live = await api.getFacultyLiveSession(activeSession.session_id);
        setLiveData(live);
        const rData = await api.getSessionRoster(activeSession.session_id);
        if (rData && rData.roster) setRoster(rData.roster);
      }
    } catch (err) {
      toast.error('Panoramic AI scan failed: ' + err.message);
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
  const handleStartSession = async (overrideSubject = null) => {
    if (isSessionActive) {
      toast.warning(`A lecture session is already active (${activeSession.session_code || activeSession.subject_name}). Please end the current session before starting a new one.`);
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
      toast.success(`Lecture session started for ${targetSubject}.`);
    } catch (err) {
      toast.error('Error starting session: ' + err.message);
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
        toast.info('Lecture session is closed.');
        setManualSuccessMsg('Lecture session is closed.');
        setTimeout(() => setManualSuccessMsg(null), 4000);
      } else {
        toast.error('Error ending session: ' + err.message);
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
      toast.warning('Please start or select a lecture session first before marking attendance!');
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
      toast.error('Manual override failed: ' + err.message);
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
      toast.error('Approval action failed: ' + err.message);
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

  if (loadingSchedule && facultyTodaySchedule.length === 0 && !activeSession) {
    return <SmartAttendLoader variant="fullscreen" />;
  }

  return (
    <>
      {!isDesktop ? (
        /* =========================================================================
            FACULTY MOBILE-FIRST LAYOUT (< 1024px Viewport)
            Adheres to Warm-White & Forest-Green Design System (Phase A)
        ========================================================================= */
        <div className="faculty-mobile-app pb-bottom-nav">
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
                onOpenNotifications={() => setShowFacultyNotifications(true)}
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

              {/* PWA Install Button (Shown on phone if not installed) */}
              <InstallAppButton variant="profile" />

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
    ) : (
      /* =========================================================================
          FACULTY DESKTOP EXPERIENCE (>= 1024px Viewport)
          Modern DesktopLayout + DesktopFacultyHome
      ========================================================================= */
      <DesktopLayout
            user={user}
            todayFormattedDate={todayFormattedDate}
            isSessionActive={isSessionActive}
            alertsCount={liveData?.counters?.alerts_count || 0}
            onStartSessionClick={() => {
              const currentOrNext = facultyTodaySchedule.find(c => c.is_current_slot) ||
                facultyTodaySchedule.find(c => c.is_upcoming_slot) ||
                facultyTodaySchedule[0];
              handleStartSession(currentOrNext ? currentOrNext.subject_name : subject);
            }}
            onOpenProjector={() => setQrProjectorOpen(true)}
            onLogout={onLogout}
            onStartSession={(slot) => {
              handleStartSession(slot?.subject_name || slot?.subject_code || subject);
            }}
          >
            <DesktopFacultyHome
              user={user}
              activeSession={activeSession}
              isSessionActive={isSessionActive}
              qrData={qrData}
              liveData={liveData}
              roster={roster}
              todayClasses={facultyTodaySchedule}
              loadingClasses={loadingSchedule}
              highlightedSlot={
                facultyTodaySchedule.find(c => c.is_current_slot) ||
                facultyTodaySchedule.find(c => c.is_upcoming_slot) ||
                facultyTodaySchedule[0] ||
                null
              }
              facultyGps={facultyGps}
              onRecalibrateGps={handleRecalibrateGps}
              ultrasonicBeaconActive={ultrasonicBeaconActive}
              onToggleUltrasonic={() => setUltrasonicBeaconActive(!ultrasonicBeaconActive)}
              onStartSession={(slot) => {
                handleStartSession(slot?.subject_name || slot?.subject_code || subject);
              }}
              onEndSession={handleEndSession}
              starting={starting}
              ending={ending}
              onOpenProjector={() => setQrProjectorOpen(true)}
              onViewAllClasses={() => {
                navigateToPath('/faculty/classes');
              }}
            />
          </DesktopLayout>
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
            <div className="p-6 sm:p-8 rounded-3xl bg-white shadow-2xl shadow-emerald-500/20 border-8 border-slate-800">
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
                <span className="text-emerald-400 font-mono text-lg">{qrData.expires_in_seconds}s</span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-brand-500 to-teal-400 transition-all duration-300 ease-linear rounded-full"
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

      {/* Faculty Mobile Notifications & Security Alerts Modal */}
      {showFacultyNotifications && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#1A4731] flex items-center justify-center">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#111827]">
                    Notifications & Alerts
                  </h3>
                  <p className="text-[11px] text-slate-400">Security telemetry & session notifications</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFacultyNotifications(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center text-xs font-bold transition"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-left">
              {isSessionActive && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-start gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0 animate-ping" />
                  <div>
                    <h4 className="text-xs font-bold text-emerald-950">Active Lecture Session</h4>
                    <p className="text-[11px] text-emerald-800/80 mt-0.5">
                      Session is actively broadcasting dynamic rotating QR codes with 150m geofencing.
                    </p>
                    <span className="text-[10px] font-semibold text-emerald-600 block mt-1">Live Telemetry</span>
                  </div>
                </div>
              )}

              {liveData?.counters?.alerts_count > 0 ? (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-rose-950">Security Alerts Flagged</h4>
                    <p className="text-[11px] text-rose-800/80 mt-0.5">
                      {liveData.counters.alerts_count} student verification attempts flagged for anti-proxy review.
                    </p>
                    <span className="text-[10px] font-semibold text-rose-600 block mt-1">Security Guardian</span>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Zero Security Threats</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      No proxy attacks, spoofing attempts, or liveness failures detected.
                    </p>
                    <span className="text-[10px] font-semibold text-slate-400 block mt-1">Anti-Proxy Engine &bull; 100% Healthy</span>
                  </div>
                </div>
              )}

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3">
                <Radio className="w-4 h-4 text-[#1A4731] mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Classroom GPS Geofence</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Faculty coordinates locked. Attendance outside 150m radius is automatically blocked.
                  </p>
                  <span className="text-[10px] font-semibold text-slate-400 block mt-1">Geofence Status &bull; Active</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowFacultyNotifications(false)}
              className="w-full min-h-[44px] py-2.5 rounded-2xl bg-[#1A4731] hover:bg-[#123323] text-white text-xs font-bold transition shadow-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}
