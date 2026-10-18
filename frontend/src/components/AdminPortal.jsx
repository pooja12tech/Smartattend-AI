import React, { useState, useEffect } from 'react';
import {
  Users, ShieldAlert, Award, Smartphone, RefreshCw, UserPlus, Download,
  CheckCircle2, AlertTriangle, TrendingUp, Search, Plus, X,
  BookOpen, History, Camera, Lock, Unlock, FileText, Check
} from 'lucide-react';
import { api } from '../api';

export default function AdminPortal({ user }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'devices', 'subjects', 'audit'
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionSuccess, setActionSuccess] = useState(null);

  // Device & Face Reset State
  const [resettingRoll, setResettingRoll] = useState(null);
  const [resettingFaceRoll, setResettingFaceRoll] = useState(null);
  const [studentList, setStudentList] = useState([
    { roll_no: 'STU01', name: 'Aarav Sharma', email: 'aarav@smartattend.edu', bound_device_id: 'DEV-AARAV-PHONE-01', has_face: true },
    { roll_no: 'STU02', name: 'Priya Patel', email: 'priya@smartattend.edu', bound_device_id: 'DEV-PRIYA-PHONE-02', has_face: true },
    { roll_no: 'STU03', name: 'Rohan Verma', email: 'rohan@smartattend.edu', bound_device_id: 'DEV-ROHAN-PHONE-03', has_face: true }
  ]);

  // Subjects State
  const [subjectsList, setSubjectsList] = useState([]);
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [subCode, setSubCode] = useState('');
  const [subName, setSubName] = useState('');
  const [subCredits, setSubCredits] = useState(4);
  const [subFaculty, setSubFaculty] = useState('Prof. Alan Turing');
  const [creatingSubject, setCreatingSubject] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Add User Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRole, setNewRole] = useState('student');
  const [newRoll, setNewRoll] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('stu123');
  const [newDept, setNewDept] = useState('Computer Science & Engineering');
  const [newInitAtt, setNewInitAtt] = useState(82.0);
  const [creatingUser, setCreatingUser] = useState(false);

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
    fetchSubjects();
    fetchAuditLogs();
  }, []);

  // 1-Click Hardware Device Reset with Mandatory Reason
  const handleResetDevice = async (rollNo) => {
    const reason = window.prompt(`Enter mandatory reason for resetting hardware device lock for ${rollNo}:`, 'Student purchased replacement phone / hardware damage');
    if (!reason) return;

    setResettingRoll(rollNo);
    try {
      await api.adminResetDevice(rollNo, reason);
      setStudentList(prev => prev.map(s => s.roll_no === rollNo ? { ...s, bound_device_id: 'UNBOUND' } : s));
      setActionSuccess(`Hardware device lock reset for student ${rollNo}. Event logged in Audit Trail.`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchOverview();
      fetchAuditLogs();
    } catch (err) {
      alert('Failed to reset device: ' + err.message);
    } finally {
      setResettingRoll(null);
    }
  };

  // 1-Click Biometric Face Template Reset with Mandatory Reason
  const handleResetFace = async (rollNo) => {
    const reason = window.prompt(`Enter mandatory reason for resetting biometric face template for ${rollNo}:`, 'Student requested biometric re-enrollment / updated appearance');
    if (!reason) return;

    setResettingFaceRoll(rollNo);
    try {
      await api.adminResetFace(rollNo, reason);
      setStudentList(prev => prev.map(s => s.roll_no === rollNo ? { ...s, has_face: false } : s));
      setActionSuccess(`Biometric template reset for student ${rollNo}. Student can now re-enroll with consent.`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchAuditLogs();
    } catch (err) {
      alert('Failed to reset face: ' + err.message);
    } finally {
      setResettingFaceRoll(null);
    }
  };

  // Create Subject Handler
  const handleCreateSubject = async (e) => {
    e.preventDefault();
    setCreatingSubject(true);
    try {
      await api.adminCreateSubject({
        code: subCode.trim().toUpperCase(),
        name: subName.trim(),
        department: 'Computer Science & Engineering',
        semester: 6,
        credits: parseInt(subCredits) || 4,
        faculty_id: 'FAC01',
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

  // Add user handler
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
        semester: 6,
        initial_attendance_pct: parseFloat(newInitAtt) || 80.0
      });

      if (newRole === 'student') {
        setStudentList(prev => [...prev, {
          roll_no: newRoll,
          name: newName,
          email: newEmail,
          bound_device_id: 'UNBOUND',
          has_face: false
        }]);
      }

      setShowAddModal(false);
      setActionSuccess(`New ${newRole} account created for ${newName} (${newRoll}).`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchOverview();
      fetchAuditLogs();

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
    const rows = overview.high_risk_defaulters.map(d =>
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
        <p className="text-sm font-medium">Loading SmartAttend Admin Console...</p>
      </div>
    );
  }

  const counts = overview?.counts || {};
  const defaulters = overview?.high_risk_defaulters || [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-6">

      {/* Top Banner */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              ADMINISTRATOR CONSOLE
            </span>
            <span className="text-xs text-slate-400">Institutional Governance & Anti-Proxy Security</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white mt-1">SmartAttend System & Retention Management</h1>
          <p className="text-xs text-slate-400">
            Monitor college-wide attendance health, manage course curriculum, and review tamper-proof audit trails.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-500/25 flex items-center gap-2 transition active:scale-95"
          >
            <UserPlus className="w-4 h-4" /> Add User
          </button>
          <button
            type="button"
            onClick={() => setShowAddSubjectModal(true)}
            className="px-4 py-2.5 rounded-xl font-bold text-xs text-purple-300 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 flex items-center gap-2 transition active:scale-95"
          >
            <BookOpen className="w-4 h-4" /> Add Subject
          </button>
          <button
            type="button"
            onClick={handleExportDefaultersCSV}
            className="px-4 py-2.5 rounded-xl font-bold text-xs text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700 flex items-center gap-2 transition active:scale-95"
          >
            <Download className="w-4 h-4 text-purple-400" /> Export CSV
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Portal Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${activeTab === 'overview' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Overview & Defaulters</span>
        </button>

        <button
          onClick={() => setActiveTab('devices')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${activeTab === 'devices' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`}
        >
          <Smartphone className="w-4 h-4" />
          <span>Device & Face Binding</span>
        </button>

        <button
          onClick={() => { setActiveTab('subjects'); fetchSubjects(); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${activeTab === 'subjects' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Curriculum & Subjects</span>
        </button>

        <button
          onClick={() => { setActiveTab('audit'); fetchAuditLogs(); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${activeTab === 'audit' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`}
        >
          <History className="w-4 h-4" />
          <span>Audit Trail Logs</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW & DEFAULTERS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Institution Overview KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card rounded-2xl p-5 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Enrolled Students</span>
                <Users className="w-4 h-4 text-indigo-400" />
              </div>
              <p className="text-3xl font-black text-white mt-2">{counts.students || 3}</p>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Active Faculty</span>
                <Users className="w-4 h-4 text-purple-400" />
              </div>
              <p className="text-3xl font-black text-white mt-2">{counts.faculty || 1}</p>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>System Average Attendance</span>
                <TrendingUp className="w-4 h-4 text-teal-400" />
              </div>
              <p className="text-3xl font-black text-teal-300 mt-2">
                {overview?.system_average_attendance_pct || 75.5}%
              </p>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Blocked Proxy Attempts</span>
                <ShieldAlert className="w-4 h-4 text-rose-400" />
              </div>
              <p className="text-3xl font-black text-rose-400 mt-2">{counts.total_alerts || 4}</p>
            </div>
          </div>

          {/* AI Defaulter Watchlist Table (Random Forest High Risk Radar) */}
          <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  Machine Learning Defaulter Watchlist (Random Forest Radar)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Students identified by AI as high risk of dropping below 75% attendance before semester end.
                </p>
              </div>
              <button
                onClick={handleExportDefaultersCSV}
                className="text-xs text-purple-400 hover:text-purple-300 font-semibold underline flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" /> Download Report
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                    <th className="py-2.5 px-3">Roll No</th>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">Dept</th>
                    <th className="py-2.5 px-3">Attendance %</th>
                    <th className="py-2.5 px-3">AI Defaulter Risk %</th>
                    <th className="py-2.5 px-3">Risk Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {defaulters.map((d) => (
                    <tr key={d.roll_no} className="hover:bg-slate-900/40">
                      <td className="py-3 px-3 font-mono font-bold text-slate-200">{d.roll_no}</td>
                      <td className="py-3 px-3 font-semibold text-white">{d.name}</td>
                      <td className="py-3 px-3 text-slate-400">{d.department}</td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-200">{d.attendance_pct}%</td>
                      <td className="py-3 px-3 font-mono font-black text-rose-400">{d.risk_pct}%</td>
                      <td className="py-3 px-3">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          {d.risk_level}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DEVICE & FACE BINDING */}
      {activeTab === 'devices' && (
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-indigo-400" />
                Student Hardware Device Binding & Biometric Lock Manager
              </h3>
              <p className="text-[11px] text-slate-400">
                1-phone-per-student rule enforcement. Reset phone bindings or biometric references with mandatory audit logging.
              </p>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student or device..."
                className="bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                  <th className="py-2.5 px-3">Roll No</th>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3">Bound Hardware Device ID</th>
                  <th className="py-2.5 px-3">Biometric Face</th>
                  <th className="py-2.5 px-3 text-right">Administrative Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {studentList.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.roll_no.toLowerCase().includes(searchQuery.toLowerCase())).map((stu) => (
                  <tr key={stu.roll_no} className="hover:bg-slate-900/40">
                    <td className="py-3 px-3 font-mono font-bold text-slate-200">{stu.roll_no}</td>
                    <td className="py-3 px-3 font-semibold text-white">{stu.name}</td>
                    <td className="py-3 px-3 font-mono">
                      {stu.bound_device_id === 'UNBOUND' ? (
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-bold">UNBOUND</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold">{stu.bound_device_id}</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {stu.has_face !== false ? (
                        <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[10px] font-bold">ENROLLED</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">PENDING</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => handleResetDevice(stu.roll_no)}
                        disabled={resettingRoll === stu.roll_no || stu.bound_device_id === 'UNBOUND'}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[11px] font-bold transition active:scale-95 disabled:opacity-40"
                      >
                        {resettingRoll === stu.roll_no ? 'Resetting...' : 'Reset Device'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResetFace(stu.roll_no)}
                        disabled={resettingFaceRoll === stu.roll_no}
                        className="px-2.5 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-[11px] font-bold transition active:scale-95 disabled:opacity-40"
                      >
                        {resettingFaceRoll === stu.roll_no ? 'Resetting...' : 'Reset Face'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CURRICULUM & SUBJECTS */}
      {activeTab === 'subjects' && (
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-purple-400" />
                Institutional Curriculum & Course Catalog
              </h3>
              <p className="text-[11px] text-slate-400">
                Manage academic subjects, credit points, assigned professors, and minimum attendance thresholds.
              </p>
            </div>
            <button
              onClick={() => setShowAddSubjectModal(true)}
              className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-lg shadow-purple-600/25"
            >
              <Plus className="w-4 h-4" /> Add Subject
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                  <th className="py-2.5 px-3">Subject Code</th>
                  <th className="py-2.5 px-3">Course Title</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Assigned Faculty</th>
                  <th className="py-2.5 px-3">Credits</th>
                  <th className="py-2.5 px-3">Min. Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {subjectsList.map((sub) => (
                  <tr key={sub.code} className="hover:bg-slate-900/40">
                    <td className="py-3 px-3 font-mono font-bold text-purple-400">{sub.code}</td>
                    <td className="py-3 px-3 font-bold text-white">{sub.name}</td>
                    <td className="py-3 px-3 text-slate-400">{sub.department}</td>
                    <td className="py-3 px-3 text-slate-300 font-medium">{sub.faculty_name || 'Prof. Alan Turing'}</td>
                    <td className="py-3 px-3 font-mono text-slate-300">{sub.credits}</td>
                    <td className="py-3 px-3 font-mono font-bold text-emerald-400">{sub.min_attendance_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: IMMUTABLE AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <History className="w-4 h-4 text-purple-400" />
                Immutable System Audit Trail
              </h3>
              <p className="text-[11px] text-slate-400">
                Chronological forensic log recording actor ID, target, old/new state, and mandatory justification reasons.
              </p>
            </div>
            <button
              onClick={fetchAuditLogs}
              disabled={loadingAudit}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAudit ? 'animate-spin text-purple-400' : ''}`} />
              <span>Refresh Log</span>
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
                  <th className="py-2.5 px-3">Mandatory Reason / Justification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/40">
                    <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                      {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() + ' ' + new Date(log.timestamp).toLocaleDateString() : '-'}
                    </td>
                    <td className="py-3 px-3 text-slate-300 font-bold">{log.actor_id} ({log.actor_role})</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-indigo-300">{log.target_id}</td>
                    <td className="py-3 px-3 font-sans text-slate-300 font-medium">{log.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Create User */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 border border-slate-700 shadow-2xl relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-1">Create New Account</h3>
            <p className="text-xs text-slate-400 mb-4">Provision a new student, faculty, or administrator user.</p>

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => {
                    setNewRole(e.target.value);
                    setNewPassword(e.target.value === 'faculty' ? 'fac123' : e.target.value === 'admin' ? 'admin123' : 'stu123');
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="student">Student</option>
                  <option value="faculty">Faculty</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {newRole === 'student' ? 'Roll Number' : newRole === 'faculty' ? 'Faculty ID' : 'Admin ID'}
                </label>
                <input
                  type="text"
                  required
                  value={newRoll}
                  onChange={(e) => setNewRoll(e.target.value)}
                  placeholder={newRole === 'student' ? 'e.g. STU05' : 'e.g. FAC02'}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Siddharth Joshi"
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
                  placeholder="e.g. siddharth@smartattend.edu"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              {newRole === 'student' && (
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Initial Attendance %</label>
                  <input
                    type="number"
                    min="20"
                    max="100"
                    value={newInitAtt}
                    onChange={(e) => setNewInitAtt(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
                >
                  {creatingUser ? 'Creating...' : 'Create Account'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs"
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
                  <label className="block text-slate-300 font-medium mb-1">Assigned Faculty</label>
                  <input
                    type="text"
                    value={subFaculty}
                    onChange={(e) => setSubFaculty(e.target.value)}
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

    </div>
  );
}
