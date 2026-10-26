import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Users, ShieldAlert, Award, Smartphone, RefreshCw, UserPlus, Download,
  CheckCircle2, AlertTriangle, TrendingUp, Search, Plus, X,
  BookOpen, History, Camera, Lock, Unlock, FileText, Check, Trash2, GraduationCap, Building2,
  Calendar
} from 'lucide-react';
import { api } from '../api';
import AdminTimetableManagement from './AdminTimetableManagement';

import AdminBottomNav from './admin/AdminBottomNav';
import AdminDashboardView from './admin/AdminDashboardView';
import AdminLiveSessionsView from './admin/AdminLiveSessionsView';
import AdminPendingReviewView from './admin/AdminPendingReviewView';
import AdminManualMarkView from './admin/AdminManualMarkView';
import AdminStudentsView from './admin/AdminStudentsView';
import AdminFacultyView from './admin/AdminFacultyView';
import AdminDepartmentsView from './admin/AdminDepartmentsView';
import AdminTimetableMobileView from './admin/AdminTimetableMobileView';
import AdminReportsView from './admin/AdminReportsView';
import AdminSettingsView from './admin/AdminSettingsView';

export default function AdminPortal({ user }) {
  // Navigation tabs: 'overview' | 'teachers' | 'students' | 'subjects' | 'audit'
  const [activeTab, setActiveTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionSuccess, setActionSuccess] = useState(null);

  // Real Database Users
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');
  const [selectedSemFilter, setSelectedSemFilter] = useState('ALL');

  // Device & Face Reset State
  const [resettingRoll, setResettingRoll] = useState(null);
  const [resettingFaceRoll, setResettingFaceRoll] = useState(null);
  const [deletingUserRoll, setDeletingUserRoll] = useState(null);

  // Subjects State
  const [subjectsList, setSubjectsList] = useState([]);
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [subCode, setSubCode] = useState('');
  const [subName, setSubName] = useState('');
  const [subCredits, setSubCredits] = useState(4);
  const [subFaculty, setSubFaculty] = useState('faculty');
  const [creatingSubject, setCreatingSubject] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Add User Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRole, setNewRole] = useState('student'); // 'student' | 'faculty' | 'admin'
  const [newRoll, setNewRoll] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('studentpassword');
  const [newDept, setNewDept] = useState('Computer Science & Engineering');
  const [newSemester, setNewSemester] = useState(6);
  const [newInitAtt, setNewInitAtt] = useState(85.0);
  const [creatingUser, setCreatingUser] = useState(false);
  const [newStudentPhoto, setNewStudentPhoto] = useState(null);

  // Admin Camera Capture & Biometric Enrollment Modal State
  const [showFaceCaptureModal, setShowFaceCaptureModal] = useState(false);
  const [targetStudentForFace, setTargetStudentForFace] = useState(null);
  const [adminCameraActive, setAdminCameraActive] = useState(false);
  const [capturedFacePhoto, setCapturedFacePhoto] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [enrollingFaceLoading, setEnrollingFaceLoading] = useState(false);
  const adminVideoRef = useRef(null);
  const adminCanvasRef = useRef(null);
  const adminStreamRef = useRef(null);

  // Mobile App Navigation State (Reference Screens 1-14)
  const [mobileTab, setMobileTab] = useState('home'); // 'home' | 'users' | 'academics' | 'attendance' | 'more'
  const [mobileScreen, setMobileScreen] = useState('dashboard'); // 'dashboard' | 'live_sessions' | 'pending_reviews' | 'manual_mark' | 'students' | 'faculty' | 'departments' | 'timetable' | 'reports' | 'settings'
  const [mobileSelectedStudentRoll, setMobileSelectedStudentRoll] = useState(null);
  const [pendingReviewsList, setPendingReviewsList] = useState([]);

  // Detail views state
  const [selectedStudentForDetails, setSelectedStudentForDetails] = useState(null);
  const selectedStudentForDetailsRef = useRef(selectedStudentForDetails);
  useEffect(() => {
    selectedStudentForDetailsRef.current = selectedStudentForDetails;
  }, [selectedStudentForDetails]);

  const [selectedSessionForDetails, setSelectedSessionForDetails] = useState(null);
  const selectedSessionForDetailsRef = useRef(selectedSessionForDetails);
  useEffect(() => {
    selectedSessionForDetailsRef.current = selectedSessionForDetails;
  }, [selectedSessionForDetails]);

  // Synchronous refs for popstate listener to avoid stale closure traps
  const mobileTabRef = useRef(mobileTab);
  useEffect(() => {
    mobileTabRef.current = mobileTab;
  }, [mobileTab]);

  const mobileScreenRef = useRef(mobileScreen);
  useEffect(() => {
    mobileScreenRef.current = mobileScreen;
  }, [mobileScreen]);

  const showAddModalRef = useRef(showAddModal);
  useEffect(() => {
    showAddModalRef.current = showAddModal;
  }, [showAddModal]);

  const showAddSubjectModalRef = useRef(showAddSubjectModal);
  useEffect(() => {
    showAddSubjectModalRef.current = showAddSubjectModal;
  }, [showAddSubjectModal]);

  const showFaceCaptureModalRef = useRef(showFaceCaptureModal);
  useEffect(() => {
    showFaceCaptureModalRef.current = showFaceCaptureModal;
  }, [showFaceCaptureModal]);

  const showLogoutConfirmRef = useRef(showLogoutConfirm);
  useEffect(() => {
    showLogoutConfirmRef.current = showLogoutConfirm;
  }, [showLogoutConfirm]);

  const [exitToast, setExitToast] = useState(false);
  const lastBackPressRef = useRef(0);
  const exitTimeoutRef = useRef(null);

  const fetchPendingReviews = async () => {
    try {
      const data = await api.getAdminPendingReviews();
      setPendingReviewsList(data.pending_reviews || []);
    } catch (e) {
      console.error('Failed to load pending reviews list:', e);
    }
  };

  const handleMobileTabChange = (tabId, subScreen = null) => {
    const targetScreen = subScreen || (
      tabId === 'home' ? 'dashboard' :
      tabId === 'users' ? 'students' :
      tabId === 'academics' ? 'departments' :
      tabId === 'attendance' ? 'live_sessions' : 'settings'
    );
    try {
      window.history.pushState({ smartattend: true, role: 'admin', tab: tabId, screen: targetScreen }, '');
    } catch {}
    setMobileTab(tabId);
    setMobileScreen(targetScreen);
  };

  const handleOpenLiveSessions = () => {
    try {
      window.history.pushState({ smartattend: true, role: 'admin', screen: 'live_sessions', tab: 'attendance' }, '');
    } catch {}
    setMobileTab('attendance');
    setMobileScreen('live_sessions');
  };

  const handleOpenPendingReviews = () => {
    try {
      window.history.pushState({ smartattend: true, role: 'admin', screen: 'pending_reviews', tab: 'attendance' }, '');
    } catch {}
    setMobileTab('attendance');
    setMobileScreen('pending_reviews');
  };

  const handleOpenManualMark = () => {
    try {
      window.history.pushState({ smartattend: true, role: 'admin', screen: 'manual_mark', tab: 'attendance' }, '');
    } catch {}
    setMobileTab('attendance');
    setMobileScreen('manual_mark');
  };

  const handleOpenStudents = (studentRoll = null) => {
    try {
      window.history.pushState({ smartattend: true, role: 'admin', screen: 'students', tab: 'users' }, '');
    } catch {}
    setMobileTab('users');
    setMobileSelectedStudentRoll(studentRoll);
    if (studentRoll) {
      const match = usersList.find(u => u.roll_no === studentRoll);
      if (match) setSelectedStudentForDetails(match);
    }
    setMobileScreen('students');
  };

  const handleOpenFaculty = () => {
    try {
      window.history.pushState({ smartattend: true, role: 'admin', screen: 'faculty', tab: 'users' }, '');
    } catch {}
    setMobileTab('users');
    setMobileScreen('faculty');
  };

  const handleOpenDepartments = () => {
    try {
      window.history.pushState({ smartattend: true, role: 'admin', screen: 'departments', tab: 'academics' }, '');
    } catch {}
    setMobileTab('academics');
    setMobileScreen('departments');
  };

  const handleOpenTimetable = () => {
    try {
      window.history.pushState({ smartattend: true, role: 'admin', screen: 'timetable', tab: 'academics' }, '');
    } catch {}
    setMobileTab('academics');
    setMobileScreen('timetable');
  };

  const handleOpenReports = () => {
    try {
      window.history.pushState({ smartattend: true, role: 'admin', screen: 'reports', tab: 'more' }, '');
    } catch {}
    setMobileTab('more');
    setMobileScreen('reports');
  };

  const handleOpenSettings = () => {
    try {
      window.history.pushState({ smartattend: true, role: 'admin', screen: 'settings', tab: 'more' }, '');
    } catch {}
    setMobileTab('more');
    setMobileScreen('settings');
  };

  const handleOpenLogoutConfirm = () => {
    try {
      window.history.pushState({ smartattend: true, role: 'admin', modal: 'logout_confirm' }, '');
    } catch {}
    setShowLogoutConfirm(true);
  };

  const fetchOverview = async () => {
    try {
      const data = await api.getAdminOverview();
      setOverview(data);
    } catch (err) {
      console.error('Failed to load admin overview:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await api.getAdminUsers();
      setUsersList(data.users || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchSubjects = async () => {
    try {
      const data = await api.getSubjects();
      setSubjectsList(data.subjects || []);
    } catch (err) {
      console.error('Failed to fetch subjects:', err);
    }
  };

  const fetchAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const data = await api.getAuditLogs({ limit: 50 });
      setAuditLogs(data.audit_logs || []);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    fetchUsers();
    fetchSubjects();
    fetchAuditLogs();
    fetchPendingReviews();
  }, []);

  // Initialize PWA root history state so Android hardware back button cannot immediately close the app
  useEffect(() => {
    try {
      if (!window.history.state || !window.history.state.smartattend) {
        window.history.replaceState({ smartattend: true, role: 'admin', initial: true }, '');
        window.history.pushState({ smartattend: true, role: 'admin', screen: 'dashboard', tab: 'home' }, '');
      }
    } catch {}
  }, []);

  // Unified popstate listener handling Android system Back gestures & hardware back buttons
  useEffect(() => {
    const handlePopState = () => {
      // 1. If any modal is open, close it first and keep user inside current view
      if (showFaceCaptureModalRef.current) {
        if (adminStreamRef.current) {
          adminStreamRef.current.getTracks().forEach((track) => track.stop());
          adminStreamRef.current = null;
        }
        setAdminCameraActive(false);
        setShowFaceCaptureModal(false);
        setTargetStudentForFace(null);
        setCapturedFacePhoto(null);
        try {
          window.history.pushState({ smartattend: true, role: 'admin', screen: mobileScreenRef.current, tab: mobileTabRef.current }, '');
        } catch {}
        return;
      }

      if (showAddModalRef.current) {
        setShowAddModal(false);
        try {
          window.history.pushState({ smartattend: true, role: 'admin', screen: mobileScreenRef.current, tab: mobileTabRef.current }, '');
        } catch {}
        return;
      }

      if (showAddSubjectModalRef.current) {
        setShowAddSubjectModal(false);
        try {
          window.history.pushState({ smartattend: true, role: 'admin', screen: mobileScreenRef.current, tab: mobileTabRef.current }, '');
        } catch {}
        return;
      }

      if (showLogoutConfirmRef.current) {
        setShowLogoutConfirm(false);
        try {
          window.history.pushState({ smartattend: true, role: 'admin', screen: mobileScreenRef.current, tab: mobileTabRef.current }, '');
        } catch {}
        return;
      }

      // 2. Nested detail views: close student details or session student list
      if (selectedStudentForDetailsRef.current) {
        setSelectedStudentForDetails(null);
        setMobileSelectedStudentRoll(null);
        try {
          window.history.pushState({ smartattend: true, role: 'admin', screen: 'students', tab: 'users' }, '');
        } catch {}
        return;
      }

      if (selectedSessionForDetailsRef.current) {
        setSelectedSessionForDetails(null);
        try {
          window.history.pushState({ smartattend: true, role: 'admin', screen: 'live_sessions', tab: 'attendance' }, '');
        } catch {}
        return;
      }

      // 3. Sub-screens: if viewing sub-screen, return to dashboard
      if (mobileScreenRef.current !== 'dashboard') {
        setMobileScreen('dashboard');
        setMobileTab('home');
        try {
          window.history.pushState({ smartattend: true, role: 'admin', screen: 'dashboard', tab: 'home' }, '');
        } catch {}
        return;
      }

      // 4. Secondary tab on dashboard: switch to 'home' tab
      if (mobileTabRef.current !== 'home') {
        setMobileTab('home');
        try {
          window.history.pushState({ smartattend: true, role: 'admin', screen: 'dashboard', tab: 'home' }, '');
        } catch {}
        return;
      }

      // 5. At root dashboard 'home': double-press back to exit confirmation
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) {
        setExitToast(false);
        window.history.back();
      } else {
        lastBackPressRef.current = now;
        setExitToast(true);
        if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
        exitTimeoutRef.current = setTimeout(() => setExitToast(false), 2000);
        try {
          window.history.pushState({ smartattend: true, role: 'admin', screen: 'dashboard', tab: 'home' }, '');
        } catch {}
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
    };
  }, []);

  // 1-Click Hardware Device Reset with Mandatory Reason
  const handleResetDevice = async (rollNo) => {
    const reason = window.prompt(`Enter mandatory reason for resetting hardware device lock for ${rollNo}:`, 'Student purchased replacement phone / hardware damage');
    if (!reason) return;

    setResettingRoll(rollNo);
    try {
      await api.adminResetDevice(rollNo, reason);
      setActionSuccess(`Hardware device lock reset for student ${rollNo}. Event logged in Audit Trail.`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchUsers();
      fetchOverview();
      fetchAuditLogs();
    } catch (err) {
      alert('Failed to reset device lock: ' + err.message);
    } finally {
      setResettingRoll(null);
    }
  };

  // 1-Click Face Reference Template Reset
  const handleResetFace = async (rollNo) => {
    const reason = window.prompt(`Enter mandatory reason for resetting facial reference template for ${rollNo}:`, 'Student facial appearance changed / lighting recalibration request');
    if (!reason) return;

    setResettingFaceRoll(rollNo);
    try {
      await api.adminResetFace(rollNo, reason);
      setActionSuccess(`Biometric template reset for student ${rollNo}. Student must re-enroll face template.`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchUsers();
      fetchOverview();
      fetchAuditLogs();
    } catch (err) {
      alert('Failed to reset face template: ' + err.message);
    } finally {
      setResettingFaceRoll(null);
    }
  };

  // --- Admin Camera & Biometric Enrollment Controls ---
  const attachStreamToVideo = useCallback((videoEl) => {
    adminVideoRef.current = videoEl;
    if (videoEl && adminStreamRef.current) {
      if (videoEl.srcObject !== adminStreamRef.current) {
        videoEl.srcObject = adminStreamRef.current;
      }
      videoEl.muted = true;
      videoEl.setAttribute('playsinline', 'true');
      videoEl.play().catch(e => console.warn('Video play catch:', e));
    }
  }, []);

  const startAdminCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access requires HTTPS or localhost context.');
      }
      if (adminStreamRef.current) {
        adminStreamRef.current.getTracks().forEach(t => t.stop());
        adminStreamRef.current = null;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });
      adminStreamRef.current = stream;
      setAdminCameraActive(true);

      const video = adminVideoRef.current;
      if (video) {
        video.srcObject = stream;
        video.muted = true;
        video.setAttribute('playsinline', 'true');
        try {
          await video.play();
        } catch (err) {
          console.warn('Auto-play error:', err);
        }
      }
    } catch (err) {
      console.error('Admin camera access error:', err);
      setCameraError(err.message || 'Unable to access camera. Check device/browser permissions.');
      setAdminCameraActive(false);
    }
  };

  const stopAdminCamera = () => {
    if (adminStreamRef.current) {
      adminStreamRef.current.getTracks().forEach(t => t.stop());
      adminStreamRef.current = null;
    }
    if (adminVideoRef.current) {
      adminVideoRef.current.srcObject = null;
    }
    setAdminCameraActive(false);
  };

  const captureAdminPhoto = () => {
    const video = adminVideoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError('Camera stream is not ready yet. Please wait a moment and try again.');
      return;
    }
    const canvas = adminCanvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    // Mirror horizontally to match mirrored user preview
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedFacePhoto(dataUrl);
    stopAdminCamera();
  };

  const handleAdminFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCapturedFacePhoto(reader.result);
      stopAdminCamera();
    };
    reader.readAsDataURL(file);
  };

  const openFaceCaptureModal = (student) => {
    setTargetStudentForFace(student);
    setCapturedFacePhoto(null);
    setCameraError(null);
    setShowFaceCaptureModal(true);
  };

  const closeFaceCaptureModal = () => {
    stopAdminCamera();
    setShowFaceCaptureModal(false);
    setTargetStudentForFace(null);
    setCapturedFacePhoto(null);
    setCameraError(null);
  };

  // Auto-start camera when modal is opened, stop when closed
  useEffect(() => {
    if (showFaceCaptureModal && !capturedFacePhoto) {
      startAdminCamera();
    } else if (!showFaceCaptureModal) {
      stopAdminCamera();
    }
  }, [showFaceCaptureModal]);

  // Clean up media tracks on unmount
  useEffect(() => {
    return () => {
      if (adminStreamRef.current) {
        adminStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const handleSaveEnrolledFace = async () => {
    if (!targetStudentForFace || !capturedFacePhoto) return;
    setEnrollingFaceLoading(true);
    setCameraError(null);
    try {
      const res = await api.adminEnrollFace(
        targetStudentForFace.roll_no,
        capturedFacePhoto,
        `Official admission face verified by Admin (${user?.name || 'Administrator'})`
      );
      setActionSuccess(res.message || `Official photo registered for ${targetStudentForFace.name}`);
      setTimeout(() => setActionSuccess(null), 5000);
      closeFaceCaptureModal();
      await fetchUsers();
      await fetchOverview();
    } catch (err) {
      setCameraError(err.message || 'Failed to extract face template. Please ensure front-facing pose and good lighting.');
    } finally {
      setEnrollingFaceLoading(false);
    }
  };

  // Delete User Account
  const handleDeleteUser = async (rollOrId, name, role) => {
    if (!window.confirm(`Are you sure you want to permanently delete ${role} account "${name}" (${rollOrId})?`)) {
      return;
    }

    setDeletingUserRoll(rollOrId);
    try {
      await api.adminDeleteUser(rollOrId);
      setActionSuccess(`${role.toUpperCase()} account "${name}" (${rollOrId}) deleted successfully.`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchUsers();
      fetchOverview();
      fetchAuditLogs();
    } catch (err) {
      alert('Failed to delete user: ' + err.message);
    } finally {
      setDeletingUserRoll(null);
    }
  };

  // Create Subject
  const handleCreateSubject = async (e) => {
    e.preventDefault();
    setCreatingSubject(true);
    try {
      await api.adminCreateSubject({
        code: subCode.trim().toUpperCase(),
        name: subName.trim(),
        department: newDept,
        semester: 6,
        credits: parseInt(subCredits) || 4,
        faculty_id: subFaculty,
        faculty_name: subFaculty,
        min_attendance_pct: 75.0
      });
      setShowAddSubjectModal(false);
      setActionSuccess(`Subject ${subCode.toUpperCase()} successfully created and added to curriculum.`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchSubjects();
      fetchAuditLogs();
      setSubCode('');
      setSubName('');
    } catch (err) {
      alert('Failed to create subject: ' + err.message);
    } finally {
      setCreatingSubject(false);
    }
  };

  // Open Add Modal for specific role
  const openAddModalForRole = (role) => {
    try {
      window.history.pushState({ smartattend: true, role: 'admin', modal: 'add_user' }, '');
    } catch {}
    setNewRole(role);
    if (role === 'student') {
      setNewPassword('studentpassword');
      setNewRoll('');
    } else if (role === 'faculty') {
      setNewPassword('facultypassword');
      setNewRoll('');
    } else {
      setNewPassword('adminpassword');
      setNewRoll('');
    }
    setShowAddModal(true);
  };

  // Add User Handler (Student or Teacher)
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreatingUser(true);
    try {
      await api.adminCreateUser({
        role: newRole,
        roll_no: newRoll.trim(),
        name: newName.trim(),
        email: newEmail.trim(),
        password: newPassword.trim(),
        department: newDept,
        semester: parseInt(newSemester) || 6,
        initial_attendance_pct: parseFloat(newInitAtt) || 85.0,
        photo_base64: newStudentPhoto || null
      });

      setShowAddModal(false);
      setNewStudentPhoto(null);
      setActionSuccess(`New ${newRole.toUpperCase()} account created for ${newName} (${newRoll}).`);
      setTimeout(() => setActionSuccess(null), 4000);

      // Re-fetch database lists immediately so newly added user appears right away!
      await fetchUsers();
      await fetchOverview();
      await fetchAuditLogs();

      // Reset form
      setNewRoll('');
      setNewName('');
      setNewEmail('');
    } catch (err) {
      alert('Error creating user: ' + err.message);
    } finally {
      setCreatingUser(false);
    }
  };

  // 1-Click CSV Export for Defaulters
  const handleExportDefaultersCSV = () => {
    if (!overview?.high_risk_defaulters?.length) {
      alert('No defaulters to export.');
      return;
    }

    const headers = 'Roll No,Student Name,Department,Attendance %,ML Defaulter Risk %,Risk Level\n';
    const rows = (overview?.high_risk_defaulters || []).map(d =>
      `${d.roll_no},"${d.name}","${d.department}",${d.attendance_pct}%,${d.risk_pct}%,${d.risk_level}`
    ).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `smartattend_defaulters_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && !overview) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
        <p className="text-sm font-medium">Loading SmartAttend Administration Console...</p>
      </div>
    );
  }

  const counts = overview?.counts || {};
  const defaulters = overview?.high_risk_defaulters || [];
  const deptBreakdown = overview?.department_breakdown || {};
  const classBreakdown = overview?.class_breakdown || {};

  // Filtered lists
  const studentsList = usersList.filter(u => u.role === 'student');
  const facultyList = usersList.filter(u => u.role === 'faculty');

  const filteredStudents = studentsList.filter(stu => {
    const matchesSearch = stu.name.toLowerCase().includes(searchQuery.toLowerCase()) || stu.roll_no.toLowerCase().includes(searchQuery.toLowerCase()) || stu.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDeptFilter === 'ALL' || stu.department === selectedDeptFilter;
    const matchesSem = selectedSemFilter === 'ALL' || String(stu.semester) === String(selectedSemFilter);
    return matchesSearch && matchesDept && matchesSem;
  });

  const filteredFaculty = facultyList.filter(fac => {
    const matchesSearch = fac.name.toLowerCase().includes(searchQuery.toLowerCase()) || fac.roll_no.toLowerCase().includes(searchQuery.toLowerCase()) || fac.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDeptFilter === 'ALL' || fac.department === selectedDeptFilter;
    return matchesSearch && matchesDept;
  });

  // Extract unique departments and semesters for filter dropdowns
  const allDepartments = Array.from(new Set(usersList.map(u => u.department || 'Computer Science & Engineering')));
  const allSemesters = [1, 2, 3, 4, 5, 6, 7, 8];

  return (
    <>
      {/* MOBILE APPLICATION (< 768px): Polished Forest Green & Warm White 14-Screen UI */}
      <div className="block md:hidden min-h-screen bg-[#F8FAF9] text-[#111827] px-3.5 pt-3 pb-24">
        {mobileScreen === 'dashboard' && (
          <AdminDashboardView
            user={user}
            overview={overview}
            subjectsCount={subjectsList.length}
            pendingCount={pendingReviewsList.length}
            onNavigateTab={handleMobileTabChange}
            onOpenLiveSessions={handleOpenLiveSessions}
            onOpenPendingReviews={handleOpenPendingReviews}
            onOpenSettings={handleOpenSettings}
            onOpenProfile={() => handleOpenSettings()}
          />
        )}

        {mobileScreen === 'live_sessions' && (
          <AdminLiveSessionsView
            overview={overview}
            selectedSession={selectedSessionForDetails}
            onSelectSession={(session) => {
              setSelectedSessionForDetails(session);
              try {
                window.history.pushState({ smartattend: true, role: 'admin', screen: 'live_sessions', session: session?.id }, '');
              } catch {}
            }}
            onClearSelectedSession={() => setSelectedSessionForDetails(null)}
            onBack={() => {
              if (selectedSessionForDetails) {
                setSelectedSessionForDetails(null);
              } else {
                setMobileScreen('dashboard');
                setMobileTab('home');
              }
            }}
            onSelectStudent={(roll) => handleOpenStudents(roll)}
          />
        )}

        {mobileScreen === 'pending_reviews' && (
          <AdminPendingReviewView
            onBack={() => {
              setMobileScreen('dashboard');
              setMobileTab('home');
            }}
            onStudentReviewed={() => {
              fetchPendingReviews();
              fetchOverview();
            }}
          />
        )}

        {mobileScreen === 'manual_mark' && (
          <AdminManualMarkView
            overview={overview}
            usersList={usersList}
            onBack={() => {
              setMobileScreen('dashboard');
              setMobileTab('home');
            }}
            onSuccess={() => {
              fetchOverview();
            }}
          />
        )}

        {mobileScreen === 'students' && (
          <AdminStudentsView
            usersList={usersList}
            selectedStudentRoll={mobileSelectedStudentRoll}
            selectedStudent={selectedStudentForDetails}
            onSelectStudent={(student) => {
              setSelectedStudentForDetails(student);
              try {
                window.history.pushState({ smartattend: true, role: 'admin', screen: 'students', roll: student?.roll_no }, '');
              } catch {}
            }}
            onClearSelectedStudent={() => {
              setSelectedStudentForDetails(null);
              setMobileSelectedStudentRoll(null);
            }}
            onBack={() => {
              if (selectedStudentForDetails) {
                setSelectedStudentForDetails(null);
                setMobileSelectedStudentRoll(null);
              } else {
                setMobileScreen('dashboard');
                setMobileTab('home');
              }
            }}
            onRefreshUsers={fetchUsers}
            onOpenAddStudentModal={() => openAddModalForRole('student')}
          />
        )}

        {mobileScreen === 'faculty' && (
          <AdminFacultyView
            usersList={usersList}
            onBack={() => {
              setMobileScreen('dashboard');
              setMobileTab('home');
            }}
            onRefreshUsers={fetchUsers}
            onOpenAddFacultyModal={() => openAddModalForRole('faculty')}
          />
        )}

        {mobileScreen === 'departments' && (
          <AdminDepartmentsView
            overview={overview}
            usersList={usersList}
            subjectsList={subjectsList}
            onBack={() => {
              setMobileScreen('dashboard');
              setMobileTab('home');
            }}
            onOpenAddSubjectModal={() => {
              try {
                window.history.pushState({ smartattend: true, role: 'admin', modal: 'add_subject' }, '');
              } catch {}
              setShowAddSubjectModal(true);
            }}
          />
        )}

        {mobileScreen === 'timetable' && (
          <AdminTimetableMobileView
            onBack={() => {
              setMobileScreen('dashboard');
              setMobileTab('home');
            }}
            onOpenFullManagement={() => {
              setActiveTab('timetable');
            }}
          />
        )}

        {mobileScreen === 'reports' && (
          <AdminReportsView
            overview={overview}
            onBack={() => {
              setMobileScreen('dashboard');
              setMobileTab('home');
            }}
          />
        )}

        {mobileScreen === 'settings' && (
          <AdminSettingsView
            onBack={() => {
              setMobileScreen('dashboard');
              setMobileTab('home');
            }}
            onOpenAuditLogs={() => fetchAuditLogs()}
            onLogout={handleOpenLogoutConfirm}
          />
        )}

        {/* Android Exit Confirmation Toast */}
        {exitToast && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-[#111827]/95 text-white text-xs font-semibold shadow-xl border border-slate-700/80 animate-in fade-in slide-in-from-bottom-2 duration-150 pointer-events-none">
            Press back again to exit SmartAttend
          </div>
        )}

        {/* Curved Mobile Bottom Navigation */}
        <AdminBottomNav
          activeTab={mobileTab}
          onTabChange={handleMobileTabChange}
          pendingCount={pendingReviewsList.length}
          activeSessionsCount={(overview?.sessions || []).filter(s => s.status === 'ACTIVE').length}
        />
      </div>

      {/* DESKTOP EXPERIENCE (>= 768px): Full-Featured Admin Control Center Console */}
      <div className="hidden md:block max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-6">

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-400 flex items-center justify-center text-sm font-bold shadow-lg shadow-purple-500/10">
              AD
            </span>
            <span>Administrator Control Center</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Institutional oversight, class & department distributions, teacher roster, and student biometric locks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => openAddModalForRole('student')}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-brand-500/20 flex items-center gap-1.5 transition active:scale-95"
          >
            <UserPlus className="w-3.5 h-3.5" /> + Add Student
          </button>

          <button
            onClick={() => openAddModalForRole('faculty')}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 transition active:scale-95"
          >
            <UserPlus className="w-3.5 h-3.5" /> + Add Teacher
          </button>

          <button
            onClick={() => { fetchOverview(); fetchUsers(); fetchAuditLogs(); }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Refresh All"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {!overview && !loading && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="font-bold">Backend Server Offline or Unreachable</p>
              <p className="text-slate-400 text-[11px] mt-0.5">
                Could not connect to FastAPI backend on <code className="text-amber-300 font-mono">http://127.0.0.1:8000</code>. Please start the backend server in your terminal.
              </p>
            </div>
          </div>
          <button
            onClick={() => { fetchOverview(); fetchUsers(); fetchSubjects(); }}
            className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold transition flex items-center gap-1.5 shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reconnect
          </button>
        </div>
      )}

      {/* Portal Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${activeTab === 'overview' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Overview & Breakdown</span>
        </button>

        <button
          onClick={() => { setActiveTab('teachers'); fetchUsers(); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${activeTab === 'teachers' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Teachers Directory ({facultyList.length})</span>
        </button>

        <button
          onClick={() => { setActiveTab('students'); fetchUsers(); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${activeTab === 'students' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`}
        >
          <Users className="w-4 h-4" />
          <span>Students & Biometrics ({studentsList.length})</span>
        </button>

        <button
          onClick={() => { setActiveTab('subjects'); fetchSubjects(); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${activeTab === 'subjects' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Curriculum & Subjects ({subjectsList.length})</span>
        </button>

        <button
          onClick={() => { setActiveTab('timetable'); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${activeTab === 'timetable' ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`}
        >
          <Calendar className="w-4 h-4" />
          <span>Timetable & Schedules</span>
        </button>

        <button
          onClick={() => { setActiveTab('audit'); fetchAuditLogs(); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${activeTab === 'audit' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`}
        >
          <History className="w-4 h-4" />
          <span>Audit Trail Logs</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW & BREAKDOWN */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Institution Overview KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card rounded-2xl p-5 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Total Students</span>
                <Users className="w-4 h-4 text-indigo-400" />
              </div>
              <p className="text-3xl font-black text-white mt-2">{studentsList.length || counts.students || 0}</p>
              <p className="text-[10px] text-slate-400 mt-1">Enrolled across departments</p>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Active Teachers</span>
                <GraduationCap className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-3xl font-black text-white mt-2">{facultyList.length || counts.faculty || 0}</p>
              <p className="text-[10px] text-slate-400 mt-1">Teaching faculty members</p>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>System Average Attendance</span>
                <Award className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-3xl font-black text-white mt-2">{(overview?.system_average_attendance_pct ?? 80.0)}%</p>
              <p className="text-[10px] text-emerald-400 mt-1">Safe campus threshold: 75%</p>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Active Subjects</span>
                <BookOpen className="w-4 h-4 text-purple-400" />
              </div>
              <p className="text-3xl font-black text-white mt-2">{subjectsList.length || 3}</p>
              <p className="text-[10px] text-slate-400 mt-1">Semester curriculum courses</p>
            </div>
          </div>

          {/* Department-wise & Class-wise Breakdown Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Department-wise Distribution */}
            <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Department-Wise Distribution</h3>
              </div>
              <p className="text-xs text-slate-400">Total students and faculty mapped per academic department.</p>

              <div className="space-y-3">
                {Object.keys(deptBreakdown).length > 0 ? (
                  Object.entries(deptBreakdown).map(([dept, data]) => (
                    <div key={dept} className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-white">{dept}</h4>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                          <span className="flex items-center gap-1 text-indigo-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span> {data.students} Students
                          </span>
                          <span className="flex items-center gap-1 text-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> {data.faculty} Faculty
                          </span>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-mono text-xs font-bold">
                        {data.students + data.faculty} total
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">No department data available.</p>
                )}
              </div>
            </div>

            {/* Class / Semester-wise Distribution */}
            <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-brand-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Class / Semester-Wise Distribution</h3>
              </div>
              <p className="text-xs text-slate-400">Student enrollment spread across academic semesters.</p>

              <div className="grid grid-cols-2 gap-3">
                {Object.keys(classBreakdown).length > 0 ? (
                  Object.entries(classBreakdown).map(([sem, count]) => (
                    <div key={sem} className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center space-y-1">
                      <span className="text-[11px] uppercase font-bold text-slate-400">{sem}</span>
                      <p className="text-2xl font-black text-brand-300">{count}</p>
                      <span className="text-[10px] text-slate-500">Enrolled Students</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 col-span-2">No class distribution data available.</p>
                )}
              </div>
            </div>
          </div>

          {/* Defaulters Section */}
          <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  AI Predictive Defaulters & High Risk Students
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Students forecasted by the ML model to fall below the 75% attendance threshold.</p>
              </div>

              {defaulters.length > 0 && (
                <button
                  onClick={handleExportDefaultersCSV}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
                >
                  <Download className="w-3.5 h-3.5 text-purple-400" /> Export CSV
                </button>
              )}
            </div>

            {defaulters.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                      <th className="py-2.5 px-3">Roll No</th>
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3">Department</th>
                      <th className="py-2.5 px-3">Current Att.</th>
                      <th className="py-2.5 px-3">ML Defaulter Risk</th>
                      <th className="py-2.5 px-3">Risk Level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {defaulters.map((d) => (
                      <tr key={d.roll_no} className="hover:bg-slate-900/40">
                        <td className="py-3 px-3 font-bold text-slate-200">{d.roll_no}</td>
                        <td className="py-3 px-3 font-sans font-semibold text-white">{d.name}</td>
                        <td className="py-3 px-3 font-sans text-slate-400">{d.department}</td>
                        <td className="py-3 px-3 font-bold text-slate-300">{d.attendance_pct}%</td>
                        <td className="py-3 px-3 text-rose-400 font-bold">{d.risk_pct}%</td>
                        <td className="py-3 px-3 font-sans">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            d.risk_level === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {d.risk_level}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-3">No students currently flagged as high-risk defaulters.</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TEACHERS DIRECTORY */}
      {activeTab === 'teachers' && (
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-emerald-400" />
                Teaching Faculty Roster & Management
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage registered professors, faculty identifiers, and academic departments.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search teacher by name or ID..."
                  className="bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              <button
                onClick={() => openAddModalForRole('faculty')}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add Teacher
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                  <th className="py-2.5 px-3">Faculty ID</th>
                  <th className="py-2.5 px-3">Teacher Name</th>
                  <th className="py-2.5 px-3">Email Address</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredFaculty.length > 0 ? (
                  filteredFaculty.map((fac) => (
                    <tr key={fac.id || fac.roll_no} className="hover:bg-slate-900/40">
                      <td className="py-3 px-3 font-mono font-bold text-emerald-300">{fac.roll_no}</td>
                      <td className="py-3 px-3 font-semibold text-white">{fac.name}</td>
                      <td className="py-3 px-3 text-slate-300">{fac.email}</td>
                      <td className="py-3 px-3 text-slate-400">{fac.department}</td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(fac.roll_no, fac.name, 'faculty')}
                          disabled={deletingUserRoll === fac.roll_no}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[11px] font-bold transition flex items-center gap-1 ml-auto disabled:opacity-40"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="py-6 text-center text-slate-500">
                      No faculty members found. Click "+ Add Teacher" to add.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: STUDENTS DIRECTORY & BIOMETRICS */}
      {activeTab === 'students' && (
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                Student Roster, Hardware Locks & Biometric Status
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Class-wise and department-wise roster. Reset hardware device binding or face templates with audit logging.
              </p>
            </div>

            <button
              onClick={() => openAddModalForRole('student')}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1 self-start sm:self-auto transition"
            >
              <Plus className="w-3.5 h-3.5" /> Add Student
            </button>
          </div>

          {/* Filters Bar: Search + Department Filter + Semester Filter */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student by name, roll no, email..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* Department Filter */}
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
            >
              <option value="ALL">All Departments</option>
              {allDepartments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>

            {/* Semester / Class Filter */}
            <select
              value={selectedSemFilter}
              onChange={(e) => setSelectedSemFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
            >
              <option value="ALL">All Semesters (Classes)</option>
              {allSemesters.map(sem => (
                <option key={sem} value={sem}>Semester {sem}</option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                  <th className="py-2.5 px-3">Roll No</th>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3">Class (Sem)</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Att. %</th>
                  <th className="py-2.5 px-3">Bound Hardware Device <span className="text-[10px] text-amber-400 font-normal">(Paused)</span></th>
                  <th className="py-2.5 px-3">Face Auth</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((stu) => (
                    <tr key={stu.id || stu.roll_no} className="hover:bg-slate-900/40">
                      <td className="py-3 px-3 font-mono font-bold text-slate-200">{stu.roll_no}</td>
                      <td className="py-3 px-3 font-semibold text-white">{stu.name}</td>
                      <td className="py-3 px-3 font-mono text-slate-300">Sem {stu.semester || 6}</td>
                      <td className="py-3 px-3 text-slate-400 max-w-[150px] truncate">{stu.department}</td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-200">{stu.current_attendance_pct}%</td>
                      <td className="py-3 px-3 font-mono">
                        {stu.bound_device_id === 'UNBOUND' ? (
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-bold">UNBOUND</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold truncate max-w-[120px] inline-block">{stu.bound_device_id}</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          {stu.has_registered_face ? (
                            <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[10px] font-bold">ENROLLED</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">NOT ENROLLED</span>
                          )}
                          <button
                            type="button"
                            onClick={() => openFaceCaptureModal(stu)}
                            className="px-2 py-0.5 rounded bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold flex items-center gap-1 transition active:scale-95"
                            title="Capture verified student photo using camera"
                          >
                            <Camera className="w-3 h-3 text-indigo-400" />
                            <span>{stu.has_registered_face ? 'Retake' : 'Capture'}</span>
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleResetDevice(stu.roll_no)}
                          disabled={resettingRoll === stu.roll_no || stu.bound_device_id === 'UNBOUND'}
                          className="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[10px] font-bold transition active:scale-95 disabled:opacity-30"
                          title="Reset bound device"
                        >
                          {resettingRoll === stu.roll_no ? 'Resetting...' : 'Reset Device'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleResetFace(stu.roll_no)}
                          disabled={resettingFaceRoll === stu.roll_no || !stu.has_registered_face}
                          className="px-2 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-[10px] font-bold transition active:scale-95 disabled:opacity-30"
                          title="Reset face template"
                        >
                          {resettingFaceRoll === stu.roll_no ? 'Resetting...' : 'Reset Face'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteUser(stu.roll_no, stu.name, 'student')}
                          disabled={deletingUserRoll === stu.roll_no}
                          className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 border border-slate-700 text-[10px] font-bold transition"
                          title="Delete student"
                        >
                          <Trash2 className="w-3 h-3 inline" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="py-6 text-center text-slate-500">
                      No students found matching filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: CURRICULUM & SUBJECTS */}
      {activeTab === 'subjects' && (
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-purple-400" />
                Academic Curriculum & Course Modules
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Register semester courses, assign teaching faculty, and set minimum attendance thresholds.
              </p>
            </div>

            <button
              onClick={() => setShowAddSubjectModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1 transition"
            >
              <Plus className="w-3.5 h-3.5" /> Add Subject
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                  <th className="py-2.5 px-3">Subject Code</th>
                  <th className="py-2.5 px-3">Course Name</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Semester</th>
                  <th className="py-2.5 px-3">Credits</th>
                  <th className="py-2.5 px-3">Assigned Faculty</th>
                  <th className="py-2.5 px-3">Lectures Held</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {subjectsList.map((subj) => (
                  <tr key={subj.code} className="hover:bg-slate-900/40">
                    <td className="py-3 px-3 font-bold text-purple-400">{subj.code}</td>
                    <td className="py-3 px-3 font-sans font-semibold text-white">{subj.name}</td>
                    <td className="py-3 px-3 font-sans text-slate-400">{subj.department}</td>
                    <td className="py-3 px-3 text-slate-300">Sem {subj.semester || 6}</td>
                    <td className="py-3 px-3 text-slate-300">{subj.credits}</td>
                    <td className="py-3 px-3 font-sans text-emerald-300">{subj.faculty_name || subj.faculty_id}</td>
                    <td className="py-3 px-3 text-slate-400">{subj.total_conducted || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT TRAIL LOGS */}
      {activeTab === 'audit' && (
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <History className="w-4 h-4 text-purple-400" />
                Immutable System Audit Trail (ACID Audit Log)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Cryptographically tracked administrative events, device lock resets, and account provisions.
              </p>
            </div>

            <button
              onClick={fetchAuditLogs}
              disabled={loadingAudit}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAudit ? 'animate-spin' : ''}`} />
              <span>Refresh Trail</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Actor</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Target</th>
                  <th className="py-2.5 px-3">Reason / Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {auditLogs.length > 0 ? (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-900/40">
                      <td className="py-2.5 px-3 text-slate-400 font-sans text-[10px]">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">{log.actor_name || log.actor_id} ({log.actor_role})</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[10px] font-bold">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-200">{log.target_type}: {log.target_id}</td>
                      <td className="py-2.5 px-3 font-sans text-slate-400">{log.reason || 'N/A'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="py-6 text-center text-slate-500">
                      No audit events recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: TIMETABLE & SCHEDULES (PHASE 3) */}
      {activeTab === 'timetable' && (
        <AdminTimetableManagement
          user={user}
          facultyList={facultyList}
          subjectsList={subjectsList}
          allDepartments={allDepartments}
          onTimetableUpdated={() => {
            fetchOverview();
            fetchAuditLogs();
          }}
        />
      )}

      {/* Modal: Add User (Student or Teacher) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 border border-slate-700 shadow-2xl relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-1">
              Add New {newRole === 'student' ? 'Student' : newRole === 'faculty' ? 'Teacher / Faculty' : 'Administrator'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Provision a verified account directly into the institutional database.
            </p>

            <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Account Role</label>
                <select
                  value={newRole}
                  onChange={(e) => {
                    const role = e.target.value;
                    setNewRole(role);
                    if (role === 'student') setNewPassword('studentpassword');
                    else if (role === 'faculty') setNewPassword('facultypassword');
                    else setNewPassword('adminpassword');
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="student">👨‍🎓 Student</option>
                  <option value="faculty">👨‍🏫 Teacher / Faculty</option>
                  <option value="admin">👨‍💼 Administrator</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {newRole === 'student' ? 'Student Roll Number / Username' : newRole === 'faculty' ? 'Faculty ID / Username' : 'Admin ID'}
                </label>
                <input
                  type="text"
                  required
                  value={newRoll}
                  onChange={(e) => setNewRoll(e.target.value)}
                  placeholder={newRole === 'student' ? 'e.g. STU05' : 'e.g. FAC02'}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={newRole === 'student' ? 'e.g. Siddharth Joshi' : 'e.g. Prof. Priya Nair'}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder={newRole === 'student' ? 'e.g. siddharth@smartattend.edu' : 'e.g. priya@smartattend.edu'}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Password</label>
                <input
                  type="text"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Academic Department</label>
                <select
                  value={newDept}
                  onChange={(e) => setNewDept(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                  <option value="Information Technology">Information Technology</option>
                  <option value="Electronics & Communication">Electronics & Communication</option>
                  <option value="Mechanical Engineering">Mechanical Engineering</option>
                  <option value="Administration">Administration</option>
                </select>
              </div>

              {newRole === 'student' && (
                <>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-slate-300 font-medium text-[11px] flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-purple-400" />
                        <span>Verified Admission Photo (Optional at creation)</span>
                      </label>
                      {newStudentPhoto && (
                        <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Photo Attached
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {newStudentPhoto ? (
                        <div className="relative shrink-0">
                          <img src={newStudentPhoto} alt="New Student" className="w-14 h-14 rounded-xl object-cover border border-purple-500/40" />
                          <button
                            type="button"
                            onClick={() => setNewStudentPhoto(null)}
                            className="absolute -top-1.5 -right-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-full p-0.5"
                            title="Remove photo"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-slate-950 border border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500 shrink-0">
                          <Camera className="w-5 h-5" />
                          <span className="text-[8px] mt-0.5">No Photo</span>
                        </div>
                      )}
                      <div className="space-y-1 flex-1">
                        <label className="px-3 py-1.5 rounded-lg bg-indigo-600/25 hover:bg-indigo-600/35 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold flex items-center gap-1.5 w-fit cursor-pointer transition">
                          <Camera className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Upload Photo / Capture</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="user"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = () => setNewStudentPhoto(reader.result);
                              reader.readAsDataURL(file);
                            }}
                            className="hidden"
                          />
                        </label>
                        <p className="text-[10px] text-slate-400 leading-tight">Can also be captured with office webcam after creation via table.</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Semester (Class)</label>
                      <select
                        value={newSemester}
                        onChange={(e) => setNewSemester(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                      >
                        {allSemesters.map(sem => (
                          <option key={sem} value={sem}>Semester {sem}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Initial Att. %</label>
                      <input
                        type="number"
                        min="20"
                        max="100"
                        value={newInitAtt}
                        onChange={(e) => setNewInitAtt(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition"
                >
                  {creatingUser ? 'Provisioning Account...' : `Create ${newRole.toUpperCase()}`}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Subject */}
      {showAddSubjectModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 border border-slate-700 shadow-2xl relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setShowAddSubjectModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-1">Add Academic Subject</h3>
            <p className="text-xs text-slate-400 mb-4">Register a new curriculum course with credits and faculty assignment.</p>

            <form onSubmit={handleCreateSubject} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Subject Code</label>
                <input
                  type="text"
                  required
                  value={subCode}
                  onChange={(e) => setSubCode(e.target.value)}
                  placeholder="e.g. CS305"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white uppercase font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Course Title</label>
                <input
                  type="text"
                  required
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  placeholder="e.g. Information Security & Cryptography"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Credits</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={subCredits}
                    onChange={(e) => setSubCredits(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Assigned Faculty ID</label>
                  <input
                    type="text"
                    value={subFaculty}
                    onChange={(e) => setSubFaculty(e.target.value)}
                    placeholder="e.g. faculty"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={creatingSubject}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
                >
                  {creatingSubject ? 'Adding...' : 'Add Subject to Curriculum'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddSubjectModal(false)}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Admin Camera Capture & Face Verification */}
      {showFaceCaptureModal && targetStudentForFace && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 border border-slate-700 shadow-2xl relative space-y-4">
            <button
              onClick={closeFaceCaptureModal}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Enroll Verified Student Photo</h3>
                  <p className="text-xs text-slate-400">
                    Capture official admission photo for <strong className="text-white">{targetStudentForFace.name}</strong> ({targetStudentForFace.roll_no})
                  </p>
                </div>
              </div>
            </div>

            {/* Camera View or Captured Preview */}
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center min-h-[300px]">
              {capturedFacePhoto ? (
                <div className="p-4 flex flex-col items-center gap-3">
                  <div className="relative">
                    <img
                      src={capturedFacePhoto}
                      alt="Captured Student Face"
                      className="w-52 h-52 rounded-2xl object-cover border-2 border-purple-500 shadow-xl"
                    />
                    <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-1.5 rounded-full border-2 border-slate-950 shadow-lg">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>
                  <span className="text-xs text-emerald-400 font-semibold">Photo Ready for AI Biometric Enrollment</span>
                </div>
              ) : (
                <div className="relative w-full h-[300px] bg-black flex items-center justify-center">
                  <video
                    ref={attachStreamToVideo}
                    autoPlay
                    playsInline
                    muted
                    onLoadedMetadata={(e) => {
                      e.currentTarget.play().catch(err => console.warn('Play error:', err));
                    }}
                    className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-300 ${adminCameraActive ? 'opacity-100' : 'opacity-0'}`}
                  />

                  {/* Oval Face Guide */}
                  {adminCameraActive && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-48 h-60 rounded-full border-2 border-dashed border-purple-400/80 shadow-2xl flex items-center justify-center">
                        <span className="text-[10px] text-purple-200/90 font-semibold bg-black/60 px-2.5 py-0.5 rounded-full mt-40">
                          Align Face Here
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Inactive state fallback */}
                  {!adminCameraActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center space-y-3 bg-slate-950">
                      <Camera className="w-12 h-12 text-slate-600 mx-auto" />
                      <p className="text-xs text-slate-400">Camera preview inactive</p>
                      <button
                        type="button"
                        onClick={startAdminCamera}
                        className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition"
                      >
                        Start Camera
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Error Message */}
            {cameraError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{cameraError}</span>
              </div>
            )}

            {/* Controls */}
            <div className="space-y-2 pt-1">
              <div className="flex gap-2">
                {adminCameraActive ? (
                  <button
                    type="button"
                    onClick={captureAdminPhoto}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25 transition active:scale-95"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Capture Frame</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startAdminCamera}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{capturedFacePhoto ? 'Retake Photo' : 'Open Camera'}</span>
                  </button>
                )}

                <label className="py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition">
                  <Download className="w-3.5 h-3.5 rotate-180 text-slate-400" />
                  <span>Upload File</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAdminFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {capturedFacePhoto && (
                <button
                  type="button"
                  onClick={handleSaveEnrolledFace}
                  disabled={enrollingFaceLoading}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition active:scale-95 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{enrollingFaceLoading ? 'Extracting & Encrypting Template...' : 'Save & Verify Official Biometrics'}</span>
                </button>
              )}
            </div>

            <canvas ref={adminCanvasRef} className="hidden" />
          </div>
        </div>
      )}
    </div>
    </>
  );
}
