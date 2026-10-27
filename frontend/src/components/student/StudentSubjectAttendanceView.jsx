import React from 'react';
import { ArrowLeft, BookOpen, AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react';

export default function StudentSubjectAttendanceView({
  dashboard,
  onBack
}) {
  const attendance = dashboard?.attendance || {};
  const currentPct = attendance.current_pct ?? 85.0;
  const subjects = dashboard?.subject_breakdown || [];

  return (
    <div className="space-y-5">
      {/* Top Header: < Subject Wise Attendance (Screen 15 Reference) */}
      <div className="sticky top-0 z-20 bg-[#F8FAF9]/95 backdrop-blur-md py-2.5 -mx-4 px-4 flex items-center justify-between border-b border-slate-200/60 select-none">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 min-h-[44px] min-w-[44px] text-[#111827] active:scale-[0.97] font-extrabold text-base focus:outline-none transition"
        >
          <ArrowLeft className="w-5 h-5 text-slate-700" />
          <span>Subject Wise Attendance</span>
        </button>
      </div>

      {/* Overall Attendance Summary Card (Screen 15 Reference) */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500">Overall</span>
          <span className="text-[11px] font-bold text-slate-400">Target: 75%</span>
        </div>

        <div className="text-3xl sm:text-4xl font-extrabold text-[#111827] tracking-tight">
          {currentPct}%
        </div>

        <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              currentPct >= 75 ? 'bg-[#10B981]' : currentPct >= 65 ? 'bg-amber-500' : 'bg-rose-500'
            }`}
            style={{ width: `${Math.min(100, currentPct)}%` }}
          />
        </div>
      </div>

      {/* Individual Subject Attendance Cards (Screen 15 Reference) */}
      <div className="space-y-3">
        {subjects.map((sub, idx) => {
          const isSafe = sub.pct >= 75.0;
          const bCalc = sub.bunk_calculator;

          return (
            <div
              key={idx}
              className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-[#111827]">
                    {sub.subject}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {sub.attended} attended of {sub.total} conducted lectures
                  </p>
                </div>
                <span className={`text-base font-extrabold ${isSafe ? 'text-[#111827]' : 'text-amber-700'}`}>
                  {sub.pct}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    sub.pct >= 75 ? 'bg-[#10B981]' : sub.pct >= 65 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, sub.pct)}%` }}
                />
              </div>

              {/* Bunk Simulator metrics pill */}
              {bCalc && (
                <div className={`p-2 rounded-xl text-[11px] flex items-center justify-between font-medium ${
                  isSafe ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                }`}>
                  <span>{isSafe ? `✅ Safe Skips: ${bCalc.safe_skips}` : `⚠️ Attend Next: ${bCalc.classes_needed}`}</span>
                  <span className="text-[11px] text-slate-500">{bCalc.message}</span>
                </div>
              )}
            </div>
          );
        })}

        {subjects.length === 0 && (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/90 text-slate-500 space-y-2">
            <BookOpen className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-xs font-bold text-slate-700">No enrolled subjects found</p>
            <p className="text-[11px] text-slate-400">Your registered subjects and attendance stats will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
