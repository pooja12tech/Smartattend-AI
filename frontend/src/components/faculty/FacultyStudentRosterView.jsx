import React, { useState } from 'react';
import {
  Users, Search, CheckCircle2, AlertTriangle, Clock, ArrowLeft,
  X, Check, ShieldCheck, UserCheck, Plus, AlertCircle, RefreshCw, Smartphone
} from 'lucide-react';
import Modal from '../ui/Modal';

export default function FacultyStudentRosterView({
  roster = [],
  subjectName = 'Lecture Class',
  activeSession,
  onApproveException,
  onManualMark,
  onBack,
  actionLoading = false
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('ALL'); // 'ALL' | 'PRESENT' | 'PENDING' | 'UNMARKED'
  const [reviewStudent, setReviewStudent] = useState(null);
  const [reviewRemarks, setReviewRemarks] = useState('');

  // Manual mark modal state
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [selectedStudentForManual, setSelectedStudentForManual] = useState(null);
  const [manualStatus, setManualStatus] = useState('PRESENT');
  const [manualReason, setManualReason] = useState('');
  const [manualError, setManualError] = useState('');

  // Stats calculation
  const presentStudents = roster.filter(s => s.status === 'PRESENT' || s.status === 'MANUAL_PRESENT');
  const pendingStudents = roster.filter(s => s.status === 'PENDING_APPROVAL');
  const unmarkedStudents = roster.filter(s => s.status !== 'PRESENT' && s.status !== 'MANUAL_PRESENT' && s.status !== 'PENDING_APPROVAL');

  const totalCount = roster.length;
  const presentCount = presentStudents.length;
  const pendingCount = pendingStudents.length;
  const unmarkedCount = unmarkedStudents.length;
  const attendancePct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  // Filter & Search logic
  const filteredRoster = roster.filter(s => {
    const matchesSearch =
      (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.roll_no || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (filterTab === 'PRESENT') return s.status === 'PRESENT' || s.status === 'MANUAL_PRESENT';
    if (filterTab === 'PENDING') return s.status === 'PENDING_APPROVAL';
    if (filterTab === 'UNMARKED') return s.status !== 'PRESENT' && s.status !== 'MANUAL_PRESENT' && s.status !== 'PENDING_APPROVAL';
    return true;
  });

  const getInitials = (name) => {
    if (!name) return 'ST';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getAvatarGradient = (rollNo) => {
    const gradients = [
      'from-emerald-600 to-teal-700',
      'from-blue-600 to-cyan-700',
      'from-emerald-600 to-emerald-700',
      'from-amber-600 to-orange-700',
      'from-rose-600 to-pink-700',
    ];
    const sum = (rollNo || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return gradients[sum % gradients.length];
  };

  // Open review dialog for a flagged student
  const handleOpenReview = (student) => {
    setReviewStudent(student);
    setReviewRemarks(student.reason ? `Verified: ${student.reason}` : 'Approved in classroom.');
  };

  // Submit review action (APPROVE or REJECT)
  const handleSubmitReview = async (action) => {
    if (!reviewStudent) return;
    await onApproveException(reviewStudent.roll_no, action, reviewRemarks);
    setReviewStudent(null);
    setReviewRemarks('');
  };

  // Open manual mark dialog
  const handleOpenManual = (student = null) => {
    setSelectedStudentForManual(student);
    setManualStatus('PRESENT');
    setManualReason(student ? 'In-Person Classroom Verification' : '');
    setManualError('');
    setManualModalOpen(true);
  };

  // Submit manual attendance
  const handleSubmitManual = async () => {
    if (!selectedStudentForManual) {
      setManualError('Please select a student.');
      return;
    }
    if (!manualReason.trim()) {
      setManualError('Mandatory justification reason is required for audit logs.');
      return;
    }
    setManualError('');
    await onManualMark(selectedStudentForManual.roll_no, selectedStudentForManual.name, manualStatus, manualReason.trim());
    setManualModalOpen(false);
    setSelectedStudentForManual(null);
    setManualReason('');
  };

  const reasonChips = [
    'Phone Battery Dead',
    'In-Person Classroom Verification',
    'Device Hardware Mismatch',
    'Network Connection Issue',
    'Official College Duty'
  ];

  return (
    <div className="space-y-3.5 pb-6">
      {/* Header Bar */}
      <div className="sticky top-0 z-20 bg-[#F8FAF9]/95 backdrop-blur-md py-2.5 -mx-4 px-4 flex items-center justify-between border-b border-slate-200/60 select-none">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 active:scale-[0.97] transition shadow-xs flex items-center justify-center cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h2 className="text-sm font-extrabold text-[#111827] tracking-tight">Student Roster</h2>
            <p className="text-[11px] text-slate-500 font-medium truncate max-w-[200px]">
              {subjectName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleOpenManual(null)}
            className="min-h-[44px] py-1.5 px-3 rounded-xl bg-[#1A4731] hover:bg-[#143826] active:scale-[0.97] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Manual Mark</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-xs flex items-center justify-between">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400">Total Enrolled</span>
          <p className="text-sm font-black text-[#111827]">
            {presentCount} / {totalCount} <span className="text-xs font-semibold text-slate-500">Present</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-300">
            {attendancePct}% Rate
          </span>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by student name or roll number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-[#111827] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1A4731]/20 focus:border-[#1A4731] shadow-xs"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Segmented Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setFilterTab('ALL')}
          className={`flex-1 min-w-[70px] py-1.5 px-2 rounded-lg text-[11px] font-bold text-center transition ${
            filterTab === 'ALL'
              ? 'bg-white text-[#111827] shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          All ({totalCount})
        </button>

        <button
          type="button"
          onClick={() => setFilterTab('PRESENT')}
          className={`flex-1 min-w-[75px] py-1.5 px-2 rounded-lg text-[11px] font-bold text-center transition ${
            filterTab === 'PRESENT'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Present ({presentCount})
        </button>

        <button
          type="button"
          onClick={() => setFilterTab('PENDING')}
          className={`flex-1 min-w-[85px] py-1.5 px-2 rounded-lg text-[11px] font-bold text-center transition ${
            filterTab === 'PENDING'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Review ({pendingCount})
        </button>

        <button
          type="button"
          onClick={() => setFilterTab('UNMARKED')}
          className={`flex-1 min-w-[80px] py-1.5 px-2 rounded-lg text-[11px] font-bold text-center transition ${
            filterTab === 'UNMARKED'
              ? 'bg-slate-700 text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Unmarked ({unmarkedCount})
        </button>
      </div>

      {/* Student List */}
      <div className="space-y-2">
        {filteredRoster.length > 0 ? (
          filteredRoster.map((s, idx) => {
            const isPresent = s.status === 'PRESENT' || s.status === 'MANUAL_PRESENT';
            const isPending = s.status === 'PENDING_APPROVAL';
            const isManual = s.is_manual_override || s.status === 'MANUAL_PRESENT';

            return (
              <div
                key={s.roll_no || idx}
                className={`bg-white rounded-xl p-3 border transition shadow-xs flex items-center justify-between gap-3 ${
                  isPending
                    ? 'border-amber-300 ring-1 ring-amber-200'
                    : isPresent
                    ? 'border-slate-200/90'
                    : 'border-slate-200/80'
                }`}
              >
                {/* Avatar & Student Info */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl bg-gradient-to-br ${getAvatarGradient(s.roll_no)} text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs`}
                  >
                    {getInitials(s.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-bold text-[#111827] truncate">
                        {s.name}
                      </h4>
                      {isManual && (
                        <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          Manual
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5 flex items-center gap-1.5 truncate">
                      <span>{s.roll_no}</span>
                      <span>&bull;</span>
                      <span>{s.department || 'CSE'}</span>
                      {s.distance_meters !== null && s.distance_meters !== undefined && (
                        <>
                          <span>&bull;</span>
                          <span className="text-emerald-700 font-semibold">{Math.round(s.distance_meters)}m</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Status / Action Button */}
                <div className="shrink-0">
                  {isPresent ? (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Present</span>
                    </span>
                  ) : isPending ? (
                    <button
                      type="button"
                      onClick={() => handleOpenReview(s)}
                      className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100 flex items-center gap-1 shadow-xs transition"
                    >
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                      <span>Review</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenManual(s)}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 transition"
                    >
                      Mark
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-xl p-8 text-center border border-slate-200/90 text-slate-500 space-y-1.5">
            <Users className="w-8 h-8 mx-auto text-slate-400 stroke-1" />
            <p className="text-xs font-bold text-slate-700">No students found</p>
            <p className="text-[11px] text-slate-400">
              {searchQuery ? `No match for "${searchQuery}"` : 'No students enrolled under this category.'}
            </p>
          </div>
        )}
      </div>

      {/* Review Exception Modal (Screen 9 & 10) */}
      <Modal
        isOpen={Boolean(reviewStudent)}
        onClose={() => setReviewStudent(null)}
        variant="sheet"
      >
        {reviewStudent && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-[#111827]">Attendance Exception Review</h3>
                  <p className="text-[11px] text-slate-500">Biometric or Device Verification Flag</p>
                </div>
              </div>
            </div>

            {/* Student Info */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Student Name</span>
                <span className="font-bold text-[#111827]">{reviewStudent.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Roll Number</span>
                <span className="font-mono font-bold text-slate-700">{reviewStudent.roll_no}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Flag Reason</span>
                <span className="font-bold text-amber-700 text-right max-w-[180px] truncate">
                  {reviewStudent.reason || 'Device / Liveness Mismatch'}
                </span>
              </div>
              {reviewStudent.distance_meters !== null && (
                <div className="flex justify-between">
                  <span className="text-slate-500">GPS Distance</span>
                  <span className="font-semibold text-slate-700">{Math.round(reviewStudent.distance_meters)} meters</span>
                </div>
              )}
            </div>

            {/* Remarks Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 block">
                Faculty Decision Remarks
              </label>
              <input
                type="text"
                value={reviewRemarks}
                onChange={(e) => setReviewRemarks(e.target.value)}
                placeholder="Reason for approval/rejection..."
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1A4731]/20 focus:border-[#1A4731]"
              />
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => handleSubmitReview('REJECT')}
                disabled={actionLoading}
                className="min-h-[44px] py-2.5 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition active:scale-[0.97] flex items-center justify-center gap-1.5"
              >
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                <span>Reject (Absent)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSubmitReview('APPROVE')}
                disabled={actionLoading}
                className="min-h-[44px] py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-900/20 transition active:scale-[0.97] flex items-center justify-center gap-1.5"
              >
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Approve (Present)</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Manual Attendance Modal */}
      <Modal
        isOpen={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        variant="sheet"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-[#111827]">Manual Attendance Override</h3>
                <p className="text-[11px] text-slate-500">Recorded in Immutable Audit Log</p>
              </div>
            </div>
          </div>

            {/* Student Picker if not pre-selected */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 block">
                Select Student
              </label>
              {selectedStudentForManual ? (
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-[#111827] block">{selectedStudentForManual.name}</span>
                    <span className="text-[11px] text-slate-500 font-mono">{selectedStudentForManual.roll_no}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedStudentForManual(null)}
                    className="text-[11px] font-bold text-[#1A4731] underline"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <select
                  onChange={(e) => {
                    const found = roster.find(s => s.roll_no === e.target.value);
                    if (found) setSelectedStudentForManual(found);
                  }}
                  defaultValue=""
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1A4731]/20 focus:border-[#1A4731]"
                >
                  <option value="" disabled>-- Select student from roster --</option>
                  {roster.map(s => (
                    <option key={s.roll_no} value={s.roll_no}>
                      {s.name} ({s.roll_no})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Status Selector */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 block">Attendance Status</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setManualStatus('PRESENT')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    manualStatus === 'PRESENT'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-1 ring-emerald-300'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Present</span>
                </button>
                <button
                  type="button"
                  onClick={() => setManualStatus('ABSENT')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    manualStatus === 'ABSENT'
                      ? 'bg-rose-50 border-rose-300 text-rose-800 ring-1 ring-rose-300'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-rose-600" />
                  <span>Absent</span>
                </button>
              </div>
            </div>

            {/* Mandatory Reason */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 block">
                Mandatory Audit Justification
              </label>
              <input
                type="text"
                value={manualReason}
                onChange={(e) => setManualReason(e.target.value)}
                placeholder="Reason for manual entry..."
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1A4731]/20 focus:border-[#1A4731]"
              />

              {/* Quick-fill reason chips */}
              <div className="flex flex-wrap gap-1 pt-0.5">
                {reasonChips.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setManualReason(chip)}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {manualError && (
              <p className="text-[11px] text-rose-600 font-semibold">{manualError}</p>
            )}

            {/* Submit Button */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setManualModalOpen(false)}
                className="min-h-[44px] py-2.5 px-3 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition active:scale-[0.97]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitManual}
                disabled={actionLoading}
                className="min-h-[44px] py-2.5 px-3 rounded-xl bg-[#1A4731] hover:bg-[#143826] text-white text-xs font-bold shadow-md shadow-emerald-950/20 transition active:scale-[0.97] flex items-center justify-center gap-1.5"
              >
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Record Attendance</span>
              </button>
            </div>
          </div>
      </Modal>
    </div>
  );
}
