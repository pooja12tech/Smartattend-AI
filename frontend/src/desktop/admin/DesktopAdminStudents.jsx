import React, { useState, useMemo } from 'react';
import {
  Users, Search, Smartphone, Camera, Lock, Unlock,
  RefreshCw, Trash2, CheckCircle2, AlertTriangle, UserPlus,
  ArrowLeft, Check
} from 'lucide-react';

export default function DesktopAdminStudents({
  usersList = [],
  loading = false,
  onResetDevice,
  onResetFace,
  onOpenFaceCapture,
  onDeleteStudent,
  onOpenAddStudent,
  onRefresh
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedSem, setSelectedSem] = useState('ALL');

  const students = useMemo(() => {
    return usersList.filter(u => u.role === 'student');
  }, [usersList]);

  const departments = useMemo(() => {
    const set = new Set(students.map(s => s.department).filter(Boolean));
    return Array.from(set);
  }, [students]);

  const filteredStudents = useMemo(() => {
    let list = students;
    if (selectedDept !== 'ALL') {
      list = list.filter(s => s.department === selectedDept);
    }
    if (selectedSem !== 'ALL') {
      list = list.filter(s => String(s.semester) === String(selectedSem));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.roll_no || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [students, selectedDept, selectedSem, searchQuery]);

  const totalCount = students.length;
  const lockedCount = students.filter(s => s.device_id && s.device_id !== 'UNBOUND').length;
  const faceEnrolledCount = students.filter(s => s.has_face_enrolled !== false).length;

  return (
    <div className="w-full px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/90">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Identity &amp; Biometrics
            </span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs text-slate-500 font-medium">Hardware Anti-Proxy Controls</span>
          </div>
          <h1 className="text-2xl font-black text-[#111827] tracking-tight">
            Student Directory &amp; Biometric Security
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Manage device hardware bindings, 1-click device unbinds, and official face biometric enrollments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onOpenAddStudent && (
            <button
              type="button"
              onClick={onOpenAddStudent}
              className="px-4 py-2 rounded-2xl bg-[#1A4731] hover:bg-[#143826] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Add Student</span>
            </button>
          )}

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
              title="Refresh Students"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-slate-500">Total Registered Students</span>
          <p className="text-2xl font-black text-[#111827]">{totalCount}</p>
          <span className="text-[11px] text-slate-400">Under university enrollment</span>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-slate-500">Hardware Devices Locked</span>
          <p className="text-2xl font-black text-emerald-800">{lockedCount}</p>
          <span className="text-[11px] text-slate-400">1 Device per student strictly bound</span>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-slate-500">Official Face Biometrics</span>
          <p className="text-2xl font-black text-[#1A4731]">{faceEnrolledCount}</p>
          <span className="text-[11px] text-slate-400">InsightFace templates verified</span>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 space-y-4">
        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name or roll number..."
              className="w-full bg-[#F8FAF9] border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-[#111827] placeholder:text-slate-400 focus:outline-none focus:border-[#1A4731]"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-[#F8FAF9] border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#1A4731]"
            >
              <option value="ALL">All Departments</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            <select
              value={selectedSem}
              onChange={(e) => setSelectedSem(e.target.value)}
              className="bg-[#F8FAF9] border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#1A4731]"
            >
              <option value="ALL">All Semesters</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                <option key={s} value={s}>Sem {s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-white/95 backdrop-blur-xs z-10 border-b border-slate-100">
              <tr className="text-slate-400 uppercase text-[11px] tracking-wider font-bold">
                <th className="py-3 px-3">Student</th>
                <th className="py-3 px-3">Roll No</th>
                <th className="py-3 px-3">Department &amp; Sem</th>
                <th className="py-3 px-3">Attendance %</th>
                <th className="py-3 px-3">Device Lock</th>
                <th className="py-3 px-3">Face ID Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-slate-200" />
                        <div className="h-4 bg-slate-200 rounded w-28" />
                      </div>
                    </td>
                    <td className="py-3 px-3"><div className="h-4 bg-slate-100 rounded w-16" /></td>
                    <td className="py-3 px-3"><div className="h-4 bg-slate-100 rounded w-28" /></td>
                    <td className="py-3 px-3"><div className="h-4 bg-slate-200 rounded w-20" /></td>
                    <td className="py-3 px-3"><div className="h-5 bg-slate-100 rounded-lg w-28" /></td>
                    <td className="py-3 px-3"><div className="h-5 bg-slate-100 rounded-lg w-20" /></td>
                    <td className="py-3 px-3 text-right"><div className="h-6 bg-slate-100 rounded-xl w-6 ml-auto" /></td>
                  </tr>
                ))
              ) : filteredStudents.length > 0 ? (
                filteredStudents.map((st, idx) => {
                  const pct = Math.round(st.overall_attendance_pct || st.attendance_pct || 80);
                  const isSafe = pct >= 75;
                  const hasDevice = Boolean(st.device_id && st.device_id !== 'UNBOUND');
                  const hasFace = Boolean(st.has_face_enrolled !== false);

                  return (
                    <tr key={st.roll_no || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 min-w-0">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-[#EBF4EE] text-[#1A4731] font-extrabold text-xs flex items-center justify-center shrink-0">
                            {(st.name || 'S').substring(0, 1)}
                          </div>
                          <span className="font-extrabold text-slate-800 truncate max-w-[180px]">{st.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-600 whitespace-nowrap">
                        {st.roll_no}
                      </td>
                      <td className="py-3 px-3 text-slate-500 truncate max-w-[180px]">
                        <span>{st.department || 'CSE'} &bull; Sem {st.semester || 6}</span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-14 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${isSafe ? 'bg-emerald-600' : 'bg-rose-500'}`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                          <span className={`font-mono font-bold ${isSafe ? 'text-emerald-700' : 'text-rose-600'}`}>
                            {pct}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {hasDevice ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                              {st.device_id.slice(0, 12)}...
                            </span>
                            {onResetDevice && (
                              <button
                                type="button"
                                onClick={() => onResetDevice(st.roll_no, st.name)}
                                className="px-2 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-bold transition cursor-pointer"
                                title="Unbind hardware device lock"
                              >
                                Reset Lock
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-medium">
                            Unbound
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {hasFace ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                              <Check className="w-3 h-3 text-emerald-600" />
                              Enrolled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              Missing
                            </span>
                          )}
                          {onOpenFaceCapture && (
                            <button
                              type="button"
                              onClick={() => onOpenFaceCapture(st)}
                              className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                              title="Capture / Update Official Photo"
                            >
                              <Camera className="w-3.5 h-3.5 text-[#1A4731]" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {onDeleteStudent && (
                          <button
                            type="button"
                            onClick={() => onDeleteStudent(st.roll_no, st.name, 'student')}
                            className="p-1.5 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                            title={`Delete student ${st.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400 space-y-1">
                    <Users className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="font-bold text-sm text-slate-600">No students match your filters</p>
                    <p className="text-xs">Try adjusting your department or semester filter</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
