import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Users, ShieldAlert, Award, Smartphone, RefreshCw, UserPlus, Download,
  CheckCircle2, AlertTriangle, TrendingUp, Search, Plus, X,
  BookOpen, History, Camera, Lock, Unlock, FileText, Check, Trash2, GraduationCap, Building2,
  Calendar, LogOut
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

import { useMediaQuery } from '../hooks/useMediaQuery';
import DesktopAdminLayout from '../desktop/admin/DesktopAdminLayout';
import Modal from './ui/Modal';
import { toast } from './ui/Toast';
import SmartAttendLoader from './ui/SmartAttendLoader';
import { navigateToPath, replacePath, parsePath } from '../router';

export default function AdminPortal({ user, onLogout }) {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const todayFormattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
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
  const [userToDelete, setUserToDelete] = useState(null);

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
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const adminVideoRef = useRef(null);
  const adminCanvasRef = useRef(null);
  const adminStreamRef = useRef(null);

  // Mobile App Navigation State (Clean Path Synced)
  const getInitialAdminMobileState = () => {
    const { role, tab } = parsePath();
    if (role === 'admin' && tab) {
      const clean = tab.toLowerCase().replace(/-/g, '_');
      if (['dashboard', 'overview', 'home'].includes(clean)) return { tab: 'home', screen: 'dashboard' };
      if (['live', 'live_sessions', 'sessions'].includes(clean)) return { tab: 'attendance', screen: 'live_sessions' };
      if (['pending_reviews', 'reviews'].includes(clean)) return { tab: 'attendance', screen: 'pending_reviews' };
      if (['manual_mark'].includes(clean)) return { tab: 'attendance', screen: 'manual_mark' };
      if (['students'].includes(clean)) return { tab: 'users', screen: 'students' };
      if (['faculty', 'teachers'].includes(clean)) return { tab: 'users', screen: 'faculty' };
      if (['departments', 'subjects'].includes(clean)) return { tab: 'academics', screen: 'departments' };
      if (['timetable'].includes(clean)) return { tab: 'academics', screen: 'timetable' };
      if (['reports'].includes(clean)) return { tab: 'more', screen: 'reports' };
      if (['settings', 'audit'].includes(clean)) return { tab: 'more', screen: 'settings' };
    }
    return { tab: 'home', screen: 'dashboard' };
  };

  const initialMobileState = getInitialAdminMobileState();
  const [mobileTab, setMobileTab] = useState(initialMobileState.tab);
  const [mobileScreen, setMobileScreen] = useState(initialMobileState.screen);
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

  // Synchronize mobile screen and tab with browser popstate, while safely closing open modals/sheets
  useEffect(() => {
    const handlePopState = () => {
      // 1. If any modal is open, close it first
      if (showFaceCaptureModalRef.current) {
        if (adminStreamRef.current) {
          adminStreamRef.current.getTracks().forEach((track) => track.stop());
          adminStreamRef.current = null;
        }
        setAdminCameraActive(false);
        setShowFaceCaptureModal(false);
        setTargetStudentForFace(null);
        setCapturedFacePhoto(null);
        return;
      }

      if (showAddModalRef.current) {
        setShowAddModal(false);
        return;
      }

      if (showAddSubjectModalRef.current) {
        setShowAddSubjectModal(false);
        return;
      }

      if (showLogoutConfirmRef.current) {
        setShowLogoutConfirm(false);
        return;
      }

      // 2. Nested detail views: close student details or session student list
      if (selectedStudentForDetailsRef.current) {
        setSelectedStudentForDetails(null);
        setMobileSelectedStudentRoll(null);
        return;
      }

      if (selectedSessionForDetailsRef.current) {
        setSelectedSessionForDetails(null);
        return;
      }

      // 3. Normal URL navigation: synchronize mobile screen and tab with the current path
      const state = getInitialAdminMobileState();
      setMobileTab(state.tab);
      setMobileScreen(state.screen);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
    const targetPath = targetScreen === 'dashboard' ? 'overview'
      : targetScreen === 'live_sessions' ? 'live'
      : targetScreen === 'manual_mark' ? 'manual-mark'
      : targetScreen === 'pending_reviews' ? 'reviews'
      : targetScreen;
    navigateToPath(`/admin/${targetPath}`);
    setMobileTab(tabId);
    setMobileScreen(targetScreen);
  };

  const handleOpenLiveSessions = () => {
    navigateToPath('/admin/live');
    setMobileTab('attendance');
    setMobileScreen('live_sessions');
  };

  const handleOpenPendingReviews = () => {
    navigateToPath('/admin/reviews');
    setMobileTab('attendance');
    setMobileScreen('pending_reviews');
  };

  const handleOpenManualMark = () => {
    navigateToPath('/admin/manual-mark');
    setMobileTab('attendance');
    setMobileScreen('manual_mark');
  };

  const handleOpenStudents = (studentRoll = null) => {
    navigateToPath('/admin/students');
    setMobileTab('users');
    setMobileSelectedStudentRoll(studentRoll);
    if (studentRoll) {
      const match = usersList.find(u => u.roll_no === studentRoll);
      if (match) setSelectedStudentForDetails(match);
    }
    setMobileScreen('students');
  };

  const handleOpenFaculty = () => {
    navigateToPath('/admin/faculty');
    setMobileTab('users');
    setMobileScreen('faculty');
  };

  const handleOpenDepartments = () => {
    navigateToPath('/admin/departments');
    setMobileTab('academics');
    setMobileScreen('departments');
  };

  const handleOpenTimetable = () => {
    navigateToPath('/admin/timetable');
    setMobileTab('academics');
    setMobileScreen('timetable');
  };

  const handleOpenReports = () => {
    navigateToPath('/admin/reports');
    setMobileTab('more');
    setMobileScreen('reports');
  };

  const handleOpenSettings = () => {
    navigateToPath('/admin/settings');
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
    const startTime = Date.now();
    try {
      const data = await api.getAdminOverview();
      setOverview(data);
      const elapsed = Date.now() - startTime;
      if (elapsed < 800) {
        await new Promise((resolve) => setTimeout(resolve, 800 - elapsed));
      }
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





  // 1-Click Hardware Device Reset with Mandatory Reason
  const handleResetDevice = async (rollNo) => {
    const reason = window.prompt(`Enter mandatory reason for resetting hardware device lock for ${rollNo}:`, 'Student purchased replacement phone / hardware damage');
    if (!reason) return;

    setResettingRoll(rollNo);
    try {
      await api.adminResetDevice(rollNo, reason);
      const msg = `Hardware device lock reset for student ${rollNo}. Event logged in Audit Trail.`;
      toast.success(msg);
      setActionSuccess(msg);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchUsers();
      fetchOverview();
      fetchAuditLogs();
    } catch (err) {
      toast.error('Failed to reset device lock: ' + err.message);
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
      const msg = `Biometric template reset for student ${rollNo}. Student must re-enroll face template.`;
      toast.success(msg);
      setActionSuccess(msg);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchUsers();
      fetchOverview();
      fetchAuditLogs();
    } catch (err) {
      toast.error('Failed to reset face template: ' + err.message);
    } finally {
      setResettingFaceRoll(null);
    }
  };

  // Handle Biometric / Attendance Review Approvals & Rejections
  const handleApproveReview = async (review) => {
    try {
      if (review.session_id && review.roll_no) {
        await api.facultyApprove({
          session_id: review.session_id,
          roll_no: review.roll_no,
          action: 'APPROVE',
          remarks: 'Approved by System Administrator from Overview'
        });
      } else if (review.roll_no) {
        await api.adminResetDevice(review.roll_no, 'Hardware device unbind approved by Administrator');
      }
      const msg = `Review approved for ${review.student_name || review.roll_no}`;
      toast.success(msg);
      setActionSuccess(msg);
      setTimeout(() => setActionSuccess(null), 3000);
      fetchPendingReviews();
      fetchOverview();
      fetchUsers();
    } catch (err) {
      toast.error(`Approval failed: ${err.message || 'Server error'}`);
    }
  };

  const handleRejectReview = async (review) => {
    try {
      if (review.session_id && review.roll_no) {
        await api.facultyApprove({
          session_id: review.session_id,
          roll_no: review.roll_no,
          action: 'REJECT',
          remarks: 'Rejected by System Administrator from Overview'
        });
      }
      const msg = `Review rejected for ${review.student_name || review.roll_no}`;
      toast.success(msg);
      setActionSuccess(msg);
      setTimeout(() => setActionSuccess(null), 3000);
      fetchPendingReviews();
      fetchOverview();
    } catch (err) {
      toast.error(`Rejection failed: ${err.message || 'Server error'}`);
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
  const handleDeleteUser = (rollOrId, name, role) => {
    setUserToDelete({ rollOrId, name, role });
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    const { rollOrId, name, role } = userToDelete;
    setDeletingUserRoll(rollOrId);
    try {
      await api.adminDeleteUser(rollOrId);
      const msg = `${role.toUpperCase()} account "${name}" (${rollOrId}) deleted successfully.`;
      toast.success(msg);
      setActionSuccess(msg);
      setTimeout(() => setActionSuccess(null), 4000);
      setUserToDelete(null);
      fetchUsers();
      fetchOverview();
      fetchAuditLogs();
    } catch (err) {
      toast.error('Failed to delete user: ' + err.message);
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
      const msg = `Subject ${subCode.toUpperCase()} successfully created and added to curriculum.`;
      toast.success(msg);
      setActionSuccess(msg);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchSubjects();
      fetchAuditLogs();
      setSubCode('');
      setSubName('');
    } catch (err) {
      toast.error('Failed to create subject: ' + err.message);
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
      const msg = `New ${newRole.toUpperCase()} account created for ${newName} (${newRoll}).`;
      toast.success(msg);
      setActionSuccess(msg);
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
      toast.error('Error creating user: ' + err.message);
    } finally {
      setCreatingUser(false);
    }
  };

  // 1-Click CSV Export for Defaulters
  const handleExportDefaultersCSV = () => {
    if (!overview?.high_risk_defaulters?.length) {
      toast.warning('No defaulters to export.');
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
    return <SmartAttendLoader variant="fullscreen" />;
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
      {!isDesktop ? (
        <div className="min-h-dvh bg-[#F8FAF9] text-[#111827] px-3.5 pt-3 pb-24">
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
            onLogout={handleOpenLogoutConfirm}
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
                handleMobileTabChange('home', 'dashboard');
              }
            }}
            onSelectStudent={(roll) => handleOpenStudents(roll)}
          />
        )}

        {mobileScreen === 'pending_reviews' && (
          <AdminPendingReviewView
            onBack={() => handleMobileTabChange('home', 'dashboard')}
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
            onBack={() => handleMobileTabChange('home', 'dashboard')}
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
                handleMobileTabChange('home', 'dashboard');
              }
            }}
            onRefreshUsers={fetchUsers}
            onOpenAddStudentModal={() => openAddModalForRole('student')}
          />
        )}

        {mobileScreen === 'faculty' && (
          <AdminFacultyView
            usersList={usersList}
            onBack={() => handleMobileTabChange('home', 'dashboard')}
            onRefreshUsers={fetchUsers}
            onOpenAddFacultyModal={() => openAddModalForRole('faculty')}
          />
        )}

        {mobileScreen === 'departments' && (
          <AdminDepartmentsView
            overview={overview}
            usersList={usersList}
            subjectsList={subjectsList}
            onBack={() => handleMobileTabChange('home', 'dashboard')}
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
            onBack={() => handleMobileTabChange('home', 'dashboard')}
            onOpenFullManagement={() => {
              setActiveTab('timetable');
            }}
          />
        )}

        {mobileScreen === 'reports' && (
          <AdminReportsView
            overview={overview}
            onBack={() => handleMobileTabChange('home', 'dashboard')}
          />
        )}

        {mobileScreen === 'settings' && (
          <AdminSettingsView
            onBack={() => handleMobileTabChange('home', 'dashboard')}
            onOpenAuditLogs={() => fetchAuditLogs()}
            onLogout={handleOpenLogoutConfirm}
          />
        )}

        {/* Curved Mobile Bottom Navigation */}
        <AdminBottomNav
          activeTab={mobileTab}
          onTabChange={handleMobileTabChange}
          pendingCount={pendingReviewsList.length}
          activeSessionsCount={(overview?.sessions || []).filter(s => s.status === 'ACTIVE').length}
        />
      </div>
    ) : (
      <DesktopAdminLayout
            user={user}
            todayFormattedDate={todayFormattedDate}
            backendOnline={Boolean(overview)}
            overview={overview}
            usersList={usersList}
            subjectsList={subjectsList}
            auditLogs={auditLogs}
            pendingReviews={pendingReviewsList}
            loading={loadingUsers}
            onResetDevice={handleResetDevice}
            onResetFace={handleResetFace}
            onOpenFaceCapture={openFaceCaptureModal}
            onDeleteUser={handleDeleteUser}
            onOpenAddStudent={() => openAddModalForRole('student')}
            onOpenAddFaculty={() => openAddModalForRole('faculty')}
            onOpenAddSubject={() => setShowAddSubjectModal(true)}
            onApproveReview={handleApproveReview}
            onRejectReview={handleRejectReview}
            onRefreshAll={() => {
              fetchOverview();
              fetchUsers();
              fetchSubjects();
              fetchAuditLogs();
              fetchPendingReviews();
            }}
            onLogout={onLogout}
        />
      )}

      {/* Modal: Add User (Student or Teacher) */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={`Add New ${newRole === 'student' ? 'Student' : newRole === 'faculty' ? 'Teacher / Faculty' : 'Administrator'}`}
        subtitle="Provision a verified account directly into the institutional database."
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs text-left">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Account Role</label>
            <select
              value={newRole}
              onChange={(e) => {
                const role = e.target.value;
                setNewRole(role);
                if (role === 'student') setNewPassword('studentpassword');
                else if (role === 'faculty') setNewPassword('facultypassword');
                else setNewPassword('adminpassword');
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 text-xs focus:ring-2 focus:ring-[#10B981] focus:outline-none transition"
            >
              <option value="student">👨‍🎓 Student</option>
              <option value="faculty">👨‍🏫 Teacher / Faculty</option>
              <option value="admin">👨‍💼 Administrator</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              {newRole === 'student' ? 'Student Roll Number / Username' : newRole === 'faculty' ? 'Faculty ID / Username' : 'Admin ID'}
            </label>
            <input
              type="text"
              required
              value={newRoll}
              onChange={(e) => setNewRoll(e.target.value)}
              placeholder={newRole === 'student' ? 'e.g. STU05' : 'e.g. FAC02'}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-mono text-xs focus:ring-2 focus:ring-[#10B981] focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Full Name</label>
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={newRole === 'student' ? 'e.g. Siddharth Joshi' : 'e.g. Prof. Priya Nair'}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 text-xs focus:ring-2 focus:ring-[#10B981] focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Email Address</label>
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder={newRole === 'student' ? 'e.g. siddharth@smartattend.edu' : 'e.g. priya@smartattend.edu'}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 text-xs focus:ring-2 focus:ring-[#10B981] focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Password</label>
            <input
              type="text"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-mono text-xs focus:ring-2 focus:ring-[#10B981] focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Academic Department</label>
            <select
              value={newDept}
              onChange={(e) => setNewDept(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 text-xs focus:ring-2 focus:ring-[#10B981] focus:outline-none transition"
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
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-700 font-semibold text-xs flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Verified Admission Photo (Optional)</span>
                  </label>
                  {newStudentPhoto && (
                    <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Photo Attached
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {newStudentPhoto ? (
                    <div className="relative shrink-0">
                      <img src={newStudentPhoto} alt="New Student" className="w-14 h-14 rounded-xl object-cover border border-emerald-500/40" />
                      <button
                        type="button"
                        onClick={() => setNewStudentPhoto(null)}
                        className="absolute -top-1.5 -right-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-full p-0.5 cursor-pointer"
                        title="Remove photo"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-white border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 shrink-0">
                      <Camera className="w-5 h-5 text-slate-400" />
                      <span className="text-[11px] mt-0.5 font-medium">No Photo</span>
                    </div>
                  )}
                  <div className="space-y-1 flex-1">
                    <label className="px-3 py-1.5 rounded-xl bg-[#EBF4EE] hover:bg-emerald-100/80 text-[#1A4731] border border-[#1A4731]/15 text-xs font-bold flex items-center gap-1.5 w-fit cursor-pointer transition">
                      <Camera className="w-3.5 h-3.5 text-[#1A4731]" />
                      <span>Upload Photo</span>
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
                    <p className="text-[11px] text-slate-500 leading-tight">Can also be captured with office webcam via the Student Directory.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Semester (Class)</label>
                  <select
                    value={newSemester}
                    onChange={(e) => setNewSemester(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 text-xs focus:ring-2 focus:ring-[#10B981] focus:outline-none transition"
                  >
                    {allSemesters.map(sem => (
                      <option key={sem} value={sem}>Semester {sem}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Initial Att. %</label>
                  <input
                    type="number"
                    min="20"
                    max="100"
                    value={newInitAtt}
                    onChange={(e) => setNewInitAtt(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-mono text-xs focus:ring-2 focus:ring-[#10B981] focus:outline-none transition"
                  />
                </div>
              </div>
            </>
          )}

          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              disabled={creatingUser}
              className="flex-1 py-2.5 rounded-xl bg-[#1A4731] hover:bg-[#123323] text-white font-bold text-xs transition cursor-pointer shadow-xs disabled:opacity-50"
            >
              {creatingUser ? 'Provisioning Account...' : `Create ${newRole.toUpperCase()}`}
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Create Subject */}
      <Modal
        isOpen={showAddSubjectModal}
        onClose={() => setShowAddSubjectModal(false)}
        title="Add Academic Subject"
        subtitle="Register a new curriculum course with credits and faculty assignment."
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateSubject} className="space-y-3.5 text-xs text-left">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Subject Code</label>
            <input
              type="text"
              required
              value={subCode}
              onChange={(e) => setSubCode(e.target.value)}
              placeholder="e.g. CS305"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 uppercase font-mono text-xs focus:ring-2 focus:ring-[#10B981] focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Course Title</label>
            <input
              type="text"
              required
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              placeholder="e.g. Information Security & Cryptography"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 text-xs focus:ring-2 focus:ring-[#10B981] focus:outline-none transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Credits</label>
              <input
                type="number"
                min="1"
                max="6"
                value={subCredits}
                onChange={(e) => setSubCredits(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-mono text-xs focus:ring-2 focus:ring-[#10B981] focus:outline-none transition"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Assigned Faculty ID</label>
              <input
                type="text"
                value={subFaculty}
                onChange={(e) => setSubFaculty(e.target.value)}
                placeholder="e.g. FAC01"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 text-xs focus:ring-2 focus:ring-[#10B981] focus:outline-none transition"
              />
            </div>
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              disabled={creatingSubject}
              className="flex-1 py-2.5 rounded-xl bg-[#1A4731] hover:bg-[#123323] text-white font-bold text-xs transition cursor-pointer shadow-xs disabled:opacity-50"
            >
              {creatingSubject ? 'Adding...' : 'Add Subject to Curriculum'}
            </button>
            <button
              type="button"
              onClick={() => setShowAddSubjectModal(false)}
              className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Admin Camera Capture & Face Verification */}
      <Modal
        isOpen={Boolean(showFaceCaptureModal && targetStudentForFace)}
        onClose={closeFaceCaptureModal}
        title="Enroll Verified Student Photo"
        subtitle={targetStudentForFace ? `Capture official admission photo for ${targetStudentForFace.name} (${targetStudentForFace.roll_no})` : ''}
        maxWidth="max-w-lg"
      >
        <div className="space-y-4 text-left">
          {/* Camera View or Captured Preview */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 flex items-center justify-center min-h-[300px]">
            {capturedFacePhoto ? (
              <div className="p-4 flex flex-col items-center gap-3">
                <div className="relative">
                  <img
                    src={capturedFacePhoto}
                    alt="Captured Student Face"
                    className="w-52 h-52 rounded-2xl object-cover border-2 border-emerald-500 shadow-xl"
                  />
                  <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-1.5 rounded-full border-2 border-white shadow-lg">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <span className="text-xs text-emerald-700 font-bold">Photo Ready for AI Biometric Enrollment</span>
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
                    <div className="w-48 h-60 rounded-full border-2 border-dashed border-emerald-400/80 shadow-2xl flex items-center justify-center">
                      <span className="text-[11px] text-emerald-200/90 font-semibold bg-black/60 px-2.5 py-0.5 rounded-full mt-40">
                        Align Face Here
                      </span>
                    </div>
                  </div>
                )}

                {/* Inactive state fallback */}
                {!adminCameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center space-y-3 bg-slate-950">
                    <Camera className="w-12 h-12 text-slate-500 mx-auto" />
                    <p className="text-xs text-slate-400">Camera preview inactive</p>
                    <button
                      type="button"
                      onClick={startAdminCamera}
                      className="px-4 py-2 rounded-xl bg-[#1A4731] hover:bg-[#123323] text-white font-bold text-xs transition cursor-pointer"
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
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
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
                  className="flex-1 py-2.5 rounded-xl bg-[#1A4731] hover:bg-[#123323] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition active:scale-95 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Capture Frame</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startAdminCamera}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{capturedFacePhoto ? 'Retake Photo' : 'Open Camera'}</span>
                </button>
              )}

              <label className="py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition">
                <Download className="w-3.5 h-3.5 rotate-180 text-slate-500" />
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
                className="w-full py-3 rounded-xl bg-[#1A4731] hover:bg-[#123323] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{enrollingFaceLoading ? 'Extracting & Encrypting Template...' : 'Save & Verify Official Biometrics'}</span>
              </button>
            )}
          </div>

          <canvas ref={adminCanvasRef} className="hidden" />
        </div>
      </Modal>

      {/* Delete User Confirmation Bottom Sheet */}
      <Modal
        isOpen={Boolean(userToDelete)}
        onClose={() => setUserToDelete(null)}
        title="Delete User Account"
        subtitle="This action permanently removes the user and is recorded in the audit trail."
        variant="sheet"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Are you sure you want to permanently delete {userToDelete?.role} account{' '}
            <strong className="text-slate-900">{userToDelete?.name}</strong> ({userToDelete?.rollOrId})?
          </p>
          <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setUserToDelete(null)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDeleteUser}
              disabled={Boolean(deletingUserRoll)}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {deletingUserRoll ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              <span>Confirm Delete</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Logout Confirmation Modal */}
      <Modal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        title="Log Out of Admin Console?"
        subtitle="Are you sure you want to end your active administrative session?"
        maxWidth="max-w-sm"
      >
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={() => setShowLogoutConfirm(false)}
            className="w-full py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              setShowLogoutConfirm(false);
              onLogout?.();
            }}
            className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition shadow-xs cursor-pointer"
          >
            Log Out
          </button>
        </div>
      </Modal>
    </>
  );
}
