import React from 'react';
import {
  CheckCircle2, Clock, Users, ArrowRight, Award, BarChart3,
  Calendar, MapPin, FileText, ChevronRight
} from 'lucide-react';

export default function FacultySessionSummaryView({
  summary,
  onBackToHome,
  onViewRoster
}) {
  if (!summary) return null;

  const {
    session,
    totalEnrolled = 0,
    presentCount = 0,
    absentCount = 0,
    pendingCount = 0,
    attendancePct = 0,
    durationText = '60 mins',
    absenteesCreated = 0
  } = summary;

  const subjectName = session?.subject_name || 'Lecture Session';
  const sessionCode = session?.session_code || '';
  const startedAtFormatted = session?.started_at
    ? new Date(session.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  const endedAtFormatted = session?.ended_at
    ? new Date(session.ended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-4 pb-8 animate-in fade-in duration-200">
      {/* Celebration Header */}
      <div className="bg-gradient-to-b from-emerald-50 via-white to-white rounded-2xl p-6 border border-emerald-200/80 shadow-sm text-center space-y-3">
        <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 border-2 border-emerald-300 flex items-center justify-center mx-auto shadow-sm">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div>
          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider bg-emerald-100/80 px-2.5 py-0.5 rounded-full">
            Session Completed
          </span>
          <h2 className="text-lg font-black text-[#111827] mt-1.5">
            Attendance Closed & Finalized
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            All records committed to immutable database & audit ledger.
          </p>
        </div>

        {/* Big Percentage Card */}
        <div className="bg-white rounded-xl p-4 border border-emerald-100 shadow-xs max-w-xs mx-auto">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block">
            Final Attendance Rate
          </span>
          <span className="text-3xl font-black text-emerald-700 mt-1 block">
            {attendancePct}%
          </span>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {presentCount} of {totalEnrolled} Enrolled Students Present
          </p>
        </div>
      </div>

      {/* Session Metadata Card */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-xs space-y-2.5 text-xs">
        <h4 className="font-bold text-slate-700 uppercase text-[11px] tracking-wider">
          Class Session Details
        </h4>

        <div className="flex justify-between py-1 border-b border-slate-100">
          <span className="text-slate-500">Subject</span>
          <span className="font-bold text-[#111827] text-right max-w-[200px] truncate">
            {subjectName}
          </span>
        </div>

        {sessionCode && (
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500">Session Code</span>
            <span className="font-mono font-bold text-slate-700">{sessionCode}</span>
          </div>
        )}

        <div className="flex justify-between py-1 border-b border-slate-100">
          <span className="text-slate-500">Timing</span>
          <span className="font-semibold text-slate-700">
            {startedAtFormatted} &ndash; {endedAtFormatted} ({durationText})
          </span>
        </div>

        <div className="flex justify-between py-1">
          <span className="text-slate-500">Geofence Verified</span>
          <span className="font-bold text-emerald-700">150m Campus Radius</span>
        </div>
      </div>

      {/* 4-Metric Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Enrolled Students
          </span>
          <span className="text-xl font-black text-[#111827] mt-1 block">
            {totalEnrolled}
          </span>
          <span className="text-[11px] text-slate-400">Class strength</span>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-emerald-200 shadow-xs bg-emerald-50/30">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
            Present
          </span>
          <span className="text-xl font-black text-emerald-700 mt-1 block">
            {presentCount}
          </span>
          <span className="text-[11px] text-emerald-600 font-semibold">Verified in class</span>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-rose-200 shadow-xs bg-rose-50/30">
          <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">
            Absent
          </span>
          <span className="text-xl font-black text-rose-700 mt-1 block">
            {absentCount}
          </span>
          <span className="text-[11px] text-rose-600 font-semibold">
            {absenteesCreated > 0 ? `${absenteesCreated} auto-finalized` : 'Recorded absent'}
          </span>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Under Review
          </span>
          <span className="text-xl font-black text-slate-700 mt-1 block">
            {pendingCount}
          </span>
          <span className="text-[11px] text-slate-400">Flagged exceptions</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2.5 pt-2">
        {onViewRoster && (
          <button
            type="button"
            onClick={onViewRoster}
            className="w-full min-h-[44px] py-3 px-4 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition active:scale-[0.97] cursor-pointer"
          >
            <Users className="w-4 h-4 text-[#1A4731]" />
            <span>Review Finalized Class Roster</span>
            <ChevronRight className="w-4 h-4 text-slate-400 ml-auto" />
          </button>
        )}

        <button
          type="button"
          onClick={onBackToHome}
          className="w-full min-h-[44px] py-3.5 px-4 rounded-xl bg-[#1A4731] hover:bg-[#143826] text-white text-xs font-bold shadow-md shadow-emerald-950/20 transition active:scale-[0.97] flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Back to Faculty Dashboard</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
