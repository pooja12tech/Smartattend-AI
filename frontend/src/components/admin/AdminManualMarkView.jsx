import React, { useState } from 'react';
import {
  ArrowLeft, Search, QrCode, CheckCircle2, UserCheck, AlertTriangle,
  RefreshCw, Check, X
} from 'lucide-react';
import { api } from '../../api';

export default function AdminManualMarkView({
  overview,
  usersList = [],
  onBack,
  onSuccess
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [manualReason, setManualReason] = useState('Medical leave verified by dean office');
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const sessions = overview?.sessions || [];
  const activeSessions = sessions.filter(s => s.status === 'ACTIVE');

  // Filter students from real users list
  const students = usersList.filter(u => u.role === 'student');
  const filteredStudents = students.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (s.name || '').toLowerCase().includes(q) ||
      (s.roll_no || '').toLowerCase().includes(q) ||
      (s.section || '').toLowerCase().includes(q)
    );
  });

  const presetReasons = [
    'Medical leave certificate',
    'Lab duty override',
    'Sports event permission',
    'Official academic deputation',
    'Hardware camera malfunction'
  ];

  const handleMarkPresent = async () => {
    if (!selectedSessionId) {
      alert('Please select an active academic session to mark attendance for.');
      return;
    }
    if (!selectedStudent) return;

    setSubmitting(true);
    try {
      await api.facultyManualAttendance({
        session_id: selectedSessionId,
        roll_no: selectedStudent.roll_no,
        status: 'PRESENT',
        reason: manualReason
      });

      setToastMessage(`Marked ${selectedStudent.name} (${selectedStudent.roll_no}) as PRESENT`);
      setSelectedStudent(null);
      setTimeout(() => setToastMessage(null), 4000);
      if (onSuccess) onSuccess();
    } catch (err) {
      alert(`Manual attendance failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-[#1A4731] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center justify-between text-xs font-bold animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
          <button type="button" onClick={() => setToastMessage(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
            Mark Attendance
          </h1>
        </div>
      </div>

      {/* Target Session Selector */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs space-y-1.5">
        <label className="text-[11px] font-extrabold text-slate-700 block">
          Target Session / Lecture
        </label>
        {sessions.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No attendance sessions registered in database.</p>
        ) : (
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1A4731]/30"
          >
            <option value="">-- Select Active or Past Session --</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>
                {s.status === 'ACTIVE' ? '🟢 [LIVE] ' : '⚪ '}
                {s.subject || 'Session'} - CSE {s.section || '5A'} ({s.faculty_name || 'Faculty'})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Search Input with QR Icon */}
      <div className="relative flex items-center">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name or roll no..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-10 py-2.5 bg-white rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1A4731]/20 shadow-2xs"
        />
        <button
          type="button"
          onClick={() => alert('Camera QR scanning is available in the student/faculty live view.')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          title="Scan Student QR Code"
        >
          <QrCode className="w-4 h-4" />
        </button>
      </div>

      {/* Student List */}
      <div className="space-y-2">
        {filteredStudents.length === 0 ? (
          <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 p-6">
            <p className="text-xs font-bold text-slate-700">No students matched search</p>
          </div>
        ) : (
          filteredStudents.map((student) => (
            <div
              key={student.roll_no}
              className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-2xs flex items-center justify-between hover:border-slate-300 transition"
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

              <button
                type="button"
                onClick={() => {
                  setSelectedStudent(student);
                  if (!selectedSessionId && sessions.length > 0) {
                    setSelectedSessionId(sessions[0].id);
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-[#1A4731] hover:bg-[#1A4731]/90 text-white text-[11px] font-bold shadow-xs transition active:scale-95"
              >
                Mark Present
              </button>
            </div>
          ))
        )}
      </div>

      {/* Modal: Confirm Reason & Session */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">
                Manual Attendance Confirmation
              </h3>
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Student:</span>
                <span className="font-bold text-slate-800">{selectedStudent.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Roll No:</span>
                <span className="font-bold text-slate-800">{selectedStudent.roll_no}</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Mandatory Audit Justification
              </label>
              <input
                type="text"
                value={manualReason}
                onChange={(e) => setManualReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#1A4731]/30 font-medium"
              />

              {/* Chips */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {presetReasons.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setManualReason(chip)}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleMarkPresent}
                className="flex-1 py-2.5 rounded-xl bg-[#1A4731] hover:bg-[#1A4731]/90 text-white font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {submitting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Confirm Present</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
