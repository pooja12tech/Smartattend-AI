import React from 'react';
import {
  ShieldCheck, AlertTriangle, CheckCircle2, TrendingUp, BookOpen,
  Check, ArrowRight, Award, Flame, Sliders
} from 'lucide-react';

export default function DesktopStudentAttendance({
  dashboard
}) {
  const attendance = dashboard?.attendance || {};
  const currentPct = attendance.current_pct != null ? Number(attendance.current_pct) : 78.4;
  const attendedCount = attendance.attended_lectures ?? 128;
  const totalCount = attendance.total_lectures ?? 163;
  const subjects = dashboard?.subject_breakdown || [];

  return (
    <div className="space-y-6">
      {/* Header & Overall Summary Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EBF4EE] text-[#1A4731] border border-[#1A4731]/15 uppercase tracking-wide">
              Official University Ledger
            </span>
            <span className="text-xs text-slate-400 font-medium">Semester 6 &bull; Session 2026</span>
          </div>
          <h1 className="text-2xl font-black text-[#111827] tracking-tight mt-1">
            Subject-Wise Attendance &amp; Defaulter Radar
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Threshold requirement: 75.0% for end-semester examinations and university compliance
          </p>
        </div>

        {/* Overall Percentage Badge */}
        <div className="flex items-center gap-4 bg-[#F8FAF9] p-4 rounded-2xl border border-slate-200/80 shrink-0">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block">
              Cumulative Status
            </span>
            <div className="text-3xl font-black text-[#111827] tracking-tight">
              {currentPct}%
            </div>
          </div>
          <div className="h-10 w-px bg-slate-200" />
          <div className="text-xs">
            <span className="font-bold text-slate-700 block">
              {attendedCount} / {totalCount}
            </span>
            <span className={`font-bold text-[11px] ${
              currentPct >= 75 ? 'text-emerald-700' : 'text-rose-600'
            }`}>
              {currentPct >= 75 ? 'Exam Eligible' : 'Detention Risk'}
            </span>
          </div>
        </div>
      </div>

      {/* Subject Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {subjects.map((sub, idx) => {
          const isSafe = sub.pct >= 75.0;
          const bCalc = sub.bunk_calculator;
          const attended = sub.attended ?? 18;
          const total = sub.total ?? 22;

          return (
            <div
              key={idx}
              className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4 hover:border-emerald-200 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                    {sub.subject_code || sub.code || 'CS301'}
                  </span>
                  <h3 className="font-extrabold text-sm text-[#111827] leading-tight mt-0.5">
                    {sub.subject_name || sub.name}
                  </h3>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Faculty: {sub.faculty_name || 'Prof. Faculty'}
                  </span>
                </div>

                <div className={`text-right ${isSafe ? 'text-emerald-700' : 'text-rose-600'}`}>
                  <div className="text-2xl font-black">{sub.pct}%</div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {attended}/{total} classes
                  </span>
                </div>
              </div>

              {/* Attendance Progress Bar */}
              <div className="space-y-1">
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      sub.pct >= 75 ? 'bg-[#10B981]' : sub.pct >= 65 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, sub.pct))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                  <span>0%</span>
                  <span className="font-bold text-slate-600">Benchmark: 75%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Bunk / Recovery Advisory Pill */}
              <div className="pt-1">
                {isSafe ? (
                  <div className="p-3 rounded-2xl bg-[#EBF4EE] border border-emerald-200/60 text-emerald-800 text-xs font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                      Safe Margin:
                    </span>
                    <span className="font-extrabold font-mono">
                      {bCalc?.safe_to_bunk != null ? `${bCalc.safe_to_bunk} Lectures` : 'Safe'}
                    </span>
                  </div>
                ) : (
                  <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      Recovery Needed:
                    </span>
                    <span className="font-extrabold font-mono">
                      {bCalc?.classes_needed_for_75 != null ? `+${bCalc.classes_needed_for_75} Classes` : 'Action'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
