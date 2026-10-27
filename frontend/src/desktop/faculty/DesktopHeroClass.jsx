import React from 'react';
import {
  Play, Square, Users, Clock, MapPin, CheckCircle2,
  AlertCircle, Radio, Maximize2, RefreshCw, Sparkles, BookOpen,
  ShieldCheck, UserCheck, Check, Layers
} from 'lucide-react';

export default function DesktopHeroClass({
  activeSession,
  isSessionActive,
  highlightedSlot,
  todayClasses = [],
  onSelectSlot,
  liveData,
  roster = [],
  starting = false,
  ending = false,
  onStartSession,
  onEndSession,
  onOpenProjector
}) {
  // Real stats
  const presentCount = liveData?.counters?.present_count ??
    roster.filter(s => s.status === 'PRESENT' || s.status === 'MANUAL_PRESENT').length;
  const pendingCount = liveData?.counters?.pending_count ??
    roster.filter(s => s.status === 'PENDING_APPROVAL').length;
  const totalEnrolled = roster.length > 0
    ? roster.length
    : (highlightedSlot?.enrolled_count || 50);

  const attendancePct = totalEnrolled > 0
    ? Math.round((presentCount / totalEnrolled) * 100)
    : 0;

  const subjectCode = activeSession?.subject_code || highlightedSlot?.subject_code || 'IT401';
  const subjectName = activeSession?.subject_name || highlightedSlot?.subject_name || 'Web Technologies';

  const roomText = activeSession
    ? (activeSession.room_no || 'LAB-304')
    : (highlightedSlot?.room_no || 'LAB-304');

  const sectionText = activeSession
    ? (activeSession.section || 'Sec A')
    : (highlightedSlot?.section || 'Sec A');

  const timeText = activeSession
    ? 'Lecture In Progress'
    : (highlightedSlot?.time || '09:00 - 10:00 AM');

  // Recently verified students from roster
  const recentVerified = roster
    .filter(s => s.status === 'PRESENT' || s.status === 'MANUAL_PRESENT')
    .slice(-4)
    .reverse();

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-7 relative overflow-hidden transition-all duration-200 space-y-6">
      {/* Top accent bar */}
      <div
        className={`absolute top-0 left-0 right-0 h-1.5 ${
          isSessionActive
            ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-[#1A4731]'
            : 'bg-gradient-to-r from-[#1A4731] via-emerald-600 to-emerald-200'
        }`}
      />

      {/* Header Row: Slot Status + Session Pill */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#EBF4EE] text-[#1A4731] flex items-center justify-center font-bold">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
              {isSessionActive ? 'Active Live Lecture' : 'Selected Timetable Slot'}
            </span>
            <span className="text-xs font-bold text-slate-700">
              {isSessionActive ? 'Real-Time Verification Active' : 'Assigned for Today'}
            </span>
          </div>
        </div>

        {isSessionActive ? (
          <span className="px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-extrabold flex items-center gap-2 shadow-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live Recording in Progress</span>
          </span>
        ) : (
          <span className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Ready to Launch</span>
          </span>
        )}
      </div>

      {/* Main Subject Information */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-xs font-black text-[#1A4731] bg-[#EBF4EE] px-2.5 py-1 rounded-xl border border-emerald-200/60">
            {subjectCode}
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-[#111827] tracking-tight">
            {subjectName}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600 font-medium">
          <span className="flex items-center gap-1.5 bg-[#F8FAF9] border border-slate-200/90 px-3 py-1.5 rounded-xl">
            <MapPin className="w-4 h-4 text-[#1A4731]" />
            <span className="font-bold text-slate-800">{roomText}</span> &bull; {sectionText}
          </span>
          <span className="flex items-center gap-1.5 bg-[#F8FAF9] border border-slate-200/90 px-3 py-1.5 rounded-xl">
            <Clock className="w-4 h-4 text-[#1A4731]" />
            <span>{timeText}</span>
          </span>
          <span className="flex items-center gap-1.5 bg-[#F8FAF9] border border-slate-200/90 px-3 py-1.5 rounded-xl">
            <Users className="w-4 h-4 text-[#1A4731]" />
            <span>{totalEnrolled} Enrolled Students</span>
          </span>
        </div>
      </div>

      {/* Live Stats Triplet Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Metric 1: Present Students */}
        <div className="bg-[#F8FAF9] rounded-2xl p-4 border border-slate-200/90 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Present Students</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-[#111827]">
              {presentCount}
            </span>
            <span className="text-xs text-slate-400 font-bold">
              / {totalEnrolled}
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, attendancePct)}%` }}
            />
          </div>
        </div>

        {/* Metric 2: Attendance Quorum Rate */}
        <div className="bg-[#F8FAF9] rounded-2xl p-4 border border-slate-200/90 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Attendance Rate</span>
            <Sparkles className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-3xl font-black text-[#111827]">
            {attendancePct}%
          </p>
          <span className="text-[11px] text-slate-500 font-semibold block">
            {attendancePct >= 75 ? 'Safe campus threshold met' : 'Under 75% target threshold'}
          </span>
        </div>

        {/* Metric 3: Anti-Proxy Status */}
        <div className="bg-[#F8FAF9] rounded-2xl p-4 border border-slate-200/90 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Pending Proxy Flags</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-3xl font-black text-[#111827]">
            {pendingCount}
          </p>
          <span className="text-[11px] text-slate-500 font-semibold block">
            {pendingCount === 0 ? 'Zero flagged discrepancies' : 'Requires verification'}
          </span>
        </div>
      </div>

      {/* Live Recent Scans Mini Stream when session is active */}
      {isSessionActive && recentVerified.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 space-y-2">
          <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
            Live Scans Stream:
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {recentVerified.map((st, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white border border-emerald-200 text-xs font-bold text-slate-800 shadow-2xs"
              >
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                <span>{st.student_name || st.name}</span>
                <span className="font-mono text-slate-400 font-normal text-[11px]">({st.roll_no})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Primary Action Row */}
      <div className="pt-1 flex flex-wrap items-center gap-3">
        {isSessionActive ? (
          <>
            {onOpenProjector && (
              <button
                type="button"
                onClick={onOpenProjector}
                className="flex-1 min-h-[48px] px-6 py-3 rounded-2xl bg-[#1A4731] hover:bg-[#123323] active:scale-98 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
              >
                <Maximize2 className="w-4 h-4" />
                <span>Open Projector Wall (High-Contrast Screen)</span>
              </button>
            )}

            <button
              type="button"
              disabled={ending}
              onClick={onEndSession}
              className="min-h-[48px] px-6 py-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-extrabold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
            >
              {ending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
              <span>End &amp; Finalize Attendance</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={starting}
            onClick={() => onStartSession(highlightedSlot || null)}
            className="w-full min-h-[50px] px-6 py-3.5 rounded-2xl bg-[#1A4731] hover:bg-[#143826] active:scale-98 text-white font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-md shadow-[#1A4731]/20 transition disabled:opacity-50 cursor-pointer"
          >
            {starting ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Initializing Cryptographic Attendance Session...</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                <span>Start Attendance Session ({subjectName} - {subjectCode})</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
