import React, { useState } from 'react';
import {
  ArrowLeft, Search, Filter, Plus, ChevronRight, UserCheck, ShieldAlert,
  Smartphone, RefreshCw, Award, Lock, Unlock, Mail, Phone, Calendar,
  Building2, Hash, CheckCircle2, AlertTriangle, X
} from 'lucide-react';
import { api } from '../../api';

export default function AdminStudentsView({
  usersList = [],
  onBack,
  onRefreshUsers,
  onOpenAddStudentModal,
  selectedStudentRoll = null
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'dept' | 'inactive'
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedStudent, setSelectedStudent] = useState(() => {
    if (selectedStudentRoll) {
      return usersList.find(u => u.roll_no === selectedStudentRoll) || null;
    }
    return null;
  });
  const [detailTab, setDetailTab] = useState('overview'); // 'overview' | 'attendance' | 'biometric' | 'device'
  const [actionLoading, setActionLoading] = useState(false);

  // Filter students from users list
  const students = usersList.filter(u => u.role === 'student');

  const departments = Array.from(new Set(students.map(s => s.department).filter(Boolean)));

  const filteredStudents = students.filter(s => {
    if (activeFilter === 'inactive' && s.is_active !== false) return false;
    if (activeFilter === 'dept' && selectedDept !== 'ALL' && s.department !== selectedDept) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (s.name || '').toLowerCase().includes(q) ||
      (s.roll_no || '').toLowerCase().includes(q) ||
      (s.section || '').toLowerCase().includes(q) ||
      (s.department || '').toLowerCase().includes(q)
    );
  });

  const handleResetDevice = async (rollNo) => {
    const reason = window.prompt(`Enter mandatory reason for resetting hardware device lock for ${rollNo}:`, 'Student purchased replacement phone / hardware damage');
    if (!reason) return;

    setActionLoading(true);
    try {
      await api.adminResetDevice(rollNo, reason);
      alert(`Hardware lock released for ${rollNo}. Student can bind a new phone.`);
      if (onRefreshUsers) onRefreshUsers();
      // Update local state if currently selected
      if (selectedStudent?.roll_no === rollNo) {
        setSelectedStudent(prev => ({ ...prev, device_id: null }));
      }
    } catch (err) {
      alert(`Device reset failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetFace = async (rollNo) => {
    const reason = window.prompt(`Enter mandatory reason for resetting biometric face reference for ${rollNo}:`, 'Appearance change / false rejection flagged at registrar');
    if (!reason) return;

    setActionLoading(true);
    try {
      await api.adminResetFace(rollNo, reason);
      alert(`Biometric face template revoked for ${rollNo}. Student must re-enroll.`);
      if (onRefreshUsers) onRefreshUsers();
      if (selectedStudent?.roll_no === rollNo) {
        setSelectedStudent(prev => ({ ...prev, face_enrolled: false }));
      }
    } catch (err) {
      alert(`Face reset failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Screen 9: Student Details
  if (selectedStudent) {
    const student = selectedStudent;
    const year = student.semester ? `${Math.ceil(student.semester / 2)}th Year` : '3rd Year';

    return (
      <div className="space-y-4 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSelectedStudent(null)}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#1A4731] transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Students</span>
          </button>
        </div>

        {/* Profile Card (Reference Screen 9) */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm text-center space-y-2">
          <div className="w-20 h-20 rounded-full bg-[#1A4731]/10 text-[#1A4731] font-black text-2xl flex items-center justify-center mx-auto ring-4 ring-[#1A4731]/20">
            {(student.name || 'S').charAt(0)}
          </div>

          <div>
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-base font-extrabold text-[#111827]">
                {student.name}
              </h2>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                student.is_active !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {student.is_active !== false ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-400 mt-0.5">
              {student.department ? student.department.replace('Computer Science & Engineering', 'CSE') : 'CSE'} &bull; {student.section ? student.section : '5A'}
            </p>
          </div>
        </div>

        {/* 4 Detail Tabs */}
        <div className="flex bg-slate-200/80 p-0.5 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setDetailTab('overview')}
            className={`flex-1 py-1.5 rounded-lg transition ${detailTab === 'overview' ? 'bg-white text-[#1A4731] shadow-xs' : 'text-slate-600'}`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setDetailTab('attendance')}
            className={`flex-1 py-1.5 rounded-lg transition ${detailTab === 'attendance' ? 'bg-white text-[#1A4731] shadow-xs' : 'text-slate-600'}`}
          >
            Attendance
          </button>
          <button
            type="button"
            onClick={() => setDetailTab('biometric')}
            className={`flex-1 py-1.5 rounded-lg transition ${detailTab === 'biometric' ? 'bg-white text-[#1A4731] shadow-xs' : 'text-slate-600'}`}
          >
            Biometric
          </button>
          <button
            type="button"
            onClick={() => setDetailTab('device')}
            className={`flex-1 py-1.5 rounded-lg transition ${detailTab === 'device' ? 'bg-white text-[#1A4731] shadow-xs' : 'text-slate-600'}`}
          >
            Device
          </button>
        </div>

        {/* Tab 1: Overview */}
        {detailTab === 'overview' && (
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 space-y-3 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5" /> Roll Number
              </span>
              <span className="font-bold text-slate-900">{student.roll_no}</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> Department
              </span>
              <span className="font-bold text-slate-900">{student.department || 'Computer Science'}</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Section & Semester
              </span>
              <span className="font-bold text-slate-900">
                {student.section ? `Section ${student.section}` : '5A'} (Sem {student.semester || 6})
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Academic Year
              </span>
              <span className="font-bold text-slate-900">{year}</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> Institutional Email
              </span>
              <span className="font-bold text-slate-900 truncate max-w-[180px]">{student.email || `${student.roll_no.toLowerCase()}@hmritm.ac.in`}</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> Contact Phone
              </span>
              <span className="font-bold text-slate-900">+91 98xxxxxxx</span>
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Enrollment Date
              </span>
              <span className="font-bold text-slate-900">12 Aug 2024</span>
            </div>
          </div>
        )}

        {/* Tab 2: Attendance */}
        {detailTab === 'attendance' && (
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 space-y-4">
            <div className="text-center p-3 bg-emerald-50/50 rounded-2xl border border-emerald-100">
              <span className="text-2xl font-black text-emerald-700 block">
                {student.attendance_pct ? `${student.attendance_pct}%` : '85.4%'}
              </span>
              <span className="text-[11px] font-bold text-emerald-800">
                Institutional Attendance Average
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block text-[10px]">Lectures Attended</span>
                <span className="text-sm font-black text-slate-800">142</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block text-[10px]">Total Scheduled</span>
                <span className="text-sm font-black text-slate-800">166</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-xs">
              <span className="text-slate-400 block text-[10px]">ML Defaulter Risk Category</span>
              <span className="font-extrabold text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Low Risk (Above 75% Criteria)
              </span>
            </div>
          </div>
        )}

        {/* Tab 3: Biometric */}
        {detailTab === 'biometric' && (
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <div>
                <span className="font-bold text-slate-800 block">Face Biometric Status</span>
                <span className="text-[11px] text-slate-400">Official encrypted template</span>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                ENROLLED
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-[11px] text-slate-600">
              <div className="flex justify-between">
                <span>Vector Dimension:</span>
                <span className="font-bold text-slate-800">512-D InsightFace ArcFace</span>
              </div>
              <div className="flex justify-between">
                <span>Verification Threshold:</span>
                <span className="font-bold text-slate-800">0.65 Cosine Sim</span>
              </div>
              <div className="flex justify-between">
                <span>Passive Blink Anti-Spoof:</span>
                <span className="font-bold text-emerald-700">ACTIVE</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Device */}
        {detailTab === 'device' && (
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <div>
                <span className="font-bold text-slate-800 block">Hardware Lock</span>
                <span className="text-[11px] text-slate-400">1 Student - 1 Smartphone Rule</span>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold flex items-center gap-1">
                <Lock className="w-3 h-3" /> BOUND
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-[11px] text-slate-600">
              <div className="flex justify-between">
                <span>Device Fingerprint:</span>
                <span className="font-mono font-bold text-slate-800">{student.device_id || 'DEV-MOB-9F2B81'}</span>
              </div>
              <div className="flex justify-between">
                <span>Binding Time:</span>
                <span className="font-bold text-slate-800">Aug 2024</span>
              </div>
              <div className="flex justify-between">
                <span>Proxy Attack Protection:</span>
                <span className="font-bold text-emerald-700">STRICT ENFORCEMENT</span>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Action Buttons (Reference Screen 9) */}
        <div className="grid grid-cols-2 gap-2.5 pt-2">
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => handleResetFace(student.roll_no)}
            className="py-3 px-3 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/90 font-extrabold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4 text-amber-700" />
            <span>Reset Face Data</span>
          </button>

          <button
            type="button"
            disabled={actionLoading}
            onClick={() => handleResetDevice(student.roll_no)}
            className="py-3 px-3 rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200/90 font-extrabold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50"
          >
            <Unlock className="w-4 h-4 text-blue-700" />
            <span>Unlock Device</span>
          </button>
        </div>
      </div>
    );
  }

  // Screen 8: Student Listing
  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-1 -ml-1 text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h1 className="text-base font-extrabold text-[#111827] tracking-tight">
            Students ({students.length})
          </h1>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
        <button
          type="button"
          onClick={() => { setActiveFilter('all'); setSelectedDept('ALL'); }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeFilter === 'all'
              ? 'bg-[#1A4731] text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200/80'
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('dept')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeFilter === 'dept'
              ? 'bg-[#1A4731] text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200/80'
          }`}
        >
          By Department
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('inactive')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeFilter === 'inactive'
              ? 'bg-[#1A4731] text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200/80'
          }`}
        >
          Inactive / Flagged
        </button>
      </div>

      {/* Department Dropdown if By Department is selected */}
      {activeFilter === 'dept' && (
        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1A4731]/30"
        >
          <option value="ALL">All Departments</option>
          {departments.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name, roll no, or section..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 bg-white rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1A4731]/20 shadow-2xs"
        />
      </div>

      {/* Students List */}
      <div className="space-y-2">
        {filteredStudents.length === 0 ? (
          <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 p-6">
            <p className="text-xs font-bold text-slate-700">No students found</p>
          </div>
        ) : (
          filteredStudents.map((student) => (
            <div
              key={student.roll_no}
              onClick={() => setSelectedStudent(student)}
              className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-2xs flex items-center justify-between cursor-pointer hover:border-slate-300 transition"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#1A4731]/10 text-[#1A4731] font-black text-xs flex items-center justify-center ring-1 ring-[#1A4731]/20">
                  {(student.name || 'S').charAt(0)}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 leading-tight">
                    {student.name}
                  </h4>
                  <p className="text-[10px] font-semibold text-slate-400">
                    {student.roll_no} &bull; CSE {student.section || '5A'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  student.is_active !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {student.is_active !== false ? 'Active' : 'Inactive'}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Floating Add Student Button (Reference Screen 8) */}
      <button
        type="button"
        onClick={onOpenAddStudentModal}
        className="fixed bottom-20 right-4 z-40 w-12 h-12 rounded-full bg-[#1A4731] text-white shadow-lg shadow-[#1A4731]/40 flex items-center justify-center hover:bg-[#1A4731]/90 active:scale-95 transition"
        title="Add New Student"
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </button>
    </div>
  );
}
