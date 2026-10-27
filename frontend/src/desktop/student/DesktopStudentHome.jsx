import React, { useState, useMemo } from 'react';
import {
  BookOpen, Clock, MapPin, User, ShieldCheck, CheckCircle2,
  AlertTriangle, Flame, ArrowRight, Smartphone, Check, Sliders, Calendar
} from 'lucide-react';

export default function DesktopStudentHome({
  dashboard,
  user,
  todayClasses = [],
  activeSession = null,
  onOpenActiveSession,
  onStartScan, // on desktop this triggers DesktopMobileOnlyModal
  onOpenClassesTab,
  onOpenSubjectAttendance,
  onOpenHistory
}) {
  const student = dashboard?.student || user || {};
  const firstName = student.name ? student.name.split(' ')[0] : 'Student';
  const attendance = dashboard?.attendance || {};
  const currentPct = attendance.current_pct != null ? Number(attendance.current_pct) : 6.1;
  const attendedCount = attendance.attended_lectures ?? 10;
  const totalCount = attendance.total_lectures ?? 164;
  const streak = dashboard?.streak ?? attendance.streak ?? 8;
  const isEligible = currentPct >= 75.0;
  const subjects = dashboard?.subject_breakdown || [];
  const recentLogs = dashboard?.recent_logs || [];

  // Bunk Simulator State for the Desktop Interactive Widget
  const [selectedSubjectCode, setSelectedSubjectCode] = useState(
    subjects[0]?.subject_code || (subjects[0]?.code || 'CS301')
  );
  const [bunkOffset, setBunkOffset] = useState(0); // -2 to +2 lectures

  const currentSubjectObj = useMemo(() => {
    return subjects.find(s => (s.subject_code || s.code) === selectedSubjectCode) || subjects[0] || null;
  }, [subjects, selectedSubjectCode]);

  // Compute simulated percentage
  const simulatedStats = useMemo(() => {
    if (!currentSubjectObj) return { pct: currentPct, safeBunks: 0 };
    const baseAttended = currentSubjectObj.attended ?? 10;
    const baseTotal = currentSubjectObj.total ?? 161;
    let newAttended = baseAttended;
    let newTotal = baseTotal;

    if (bunkOffset > 0) {
      newAttended += bunkOffset;
      newTotal += bunkOffset;
    } else if (bunkOffset < 0) {
      newTotal += Math.abs(bunkOffset);
    }

    const calculatedPct = newTotal > 0 ? ((newAttended / newTotal) * 100).toFixed(1) : '0.0';
    return {
      pct: Number(calculatedPct),
      attended: newAttended,
      total: newTotal
    };
  }, [currentSubjectObj, bunkOffset, currentPct]);

  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const formattedDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="space-y-6 w-full">
      {/* 1. HERO BANNER: ACTIVE LECTURE OR WELCOME BANNER */}
      {activeSession ? (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#1A4731] via-[#1F543B] to-[#143826] text-white p-6 sm:p-7 shadow-lg border border-emerald-900/40">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Live Attendance Active
                </span>
                <span className="text-xs text-emerald-200/90 font-mono">
                  Rolling Window: 20s
                </span>
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  {activeSession.subject_name || activeSession.subject_code || 'Operating Systems'}
                </h1>
                <p className="text-sm text-emerald-100/90 font-medium mt-1 flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-emerald-300" />
                    {activeSession.room || 'Room LAB-302'}
                  </span>
                  <span>&bull;</span>
                  <span className="flex items-center gap-1.5">
                    <User className="w-4 h-4 text-emerald-300" />
                    {activeSession.faculty_name || 'Prof. Rajesh Sharma'}
                  </span>
                  <span>&bull;</span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-emerald-300" />
                    {activeSession.start_time} - {activeSession.end_time || '10:00 AM'}
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-emerald-200/90 font-medium">
                <Smartphone className="w-4 h-4 text-emerald-300" />
                <span>Attendance must be scanned using your registered phone PWA.</span>
              </div>
            </div>

            {/* Right Action: Mark Attendance CTA or Verified Recorded Badge */}
            <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3 shrink-0">
              {activeSession.already_marked ? (
                <div className="px-5 py-3 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 flex items-center gap-3 shadow-md backdrop-blur-xs">
                  <div className="w-8 h-8 rounded-full bg-emerald-400/30 flex items-center justify-center text-emerald-300">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-emerald-300">Attendance Recorded</p>
                    <p className="text-[11px] text-emerald-100/90 font-medium">Status: {activeSession.attendance_status || 'Verified Present'}</p>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  id="hero-scan-cta"
                  onClick={onStartScan}
                  className="px-6 py-3.5 rounded-2xl bg-[#10B981] hover:bg-[#059669] active:scale-95 text-white font-extrabold text-sm shadow-xl shadow-black/20 flex items-center justify-center gap-2.5 transition cursor-pointer"
                >
                  <Smartphone className="w-5 h-5 stroke-[2.4]" />
                  <span>Mark Attendance (Phone Required)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EBF4EE] text-[#1A4731] border border-[#1A4731]/15 uppercase tracking-wide">
                Academic Dashboard
              </span>
              <span className="text-xs text-slate-400 font-medium font-mono">
                {formattedDate} &bull; {dayName}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#111827] tracking-tight">
              Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {firstName}! 👋
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Student ID: <span className="font-mono font-bold text-slate-700">{student.roll_no || 'STU01'}</span> &bull; {student.department || 'Computer Science & Engineering'} &bull; Semester {student.semester || 6}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onStartScan}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-[#1A4731] to-[#143826] hover:from-[#143826] hover:to-[#0E271B] active:scale-95 text-white font-bold text-xs shadow-sm shadow-[#1A4731]/30 flex items-center gap-2 transition cursor-pointer"
            >
              <Smartphone className="w-4 h-4" />
              <span>Mark Attendance</span>
            </button>
            <button
              type="button"
              onClick={onOpenClassesTab}
              className="px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
            >
              View Timetable
            </button>
          </div>
        </div>
      )}

      {/* 2. REAL & IMPACTFUL KPI STAT CARDS (3 Clean Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Overall Attendance */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Overall Attendance</span>
            <span className="text-[11px] font-bold text-slate-400">Target: 75%</span>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="text-4xl font-black text-[#111827] tracking-tight">
              {currentPct}%
            </div>
            <span className="text-xs text-slate-500 font-medium font-mono">
              {attendedCount} / {totalCount} classes
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                currentPct >= 75 ? 'bg-[#10B981]' : currentPct >= 65 ? 'bg-amber-500' : 'bg-rose-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, currentPct))}%` }}
            />
          </div>

          <div className="pt-1 flex items-center justify-between text-xs">
            <span className={`font-bold flex items-center gap-1.5 ${
              currentPct >= 75 ? 'text-emerald-700' : 'text-rose-600'
            }`}>
              {currentPct >= 75 ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Above Benchmark (75%)
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  Action needed: Defaulter detention risk
                </>
              )}
            </span>
            <button
              type="button"
              onClick={onOpenSubjectAttendance}
              className="text-slate-400 hover:text-[#1A4731] font-bold flex items-center gap-0.5"
            >
              Details <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Card 2: Attendance Streak */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Attendance Streak</span>
            <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center">
              <Flame className="w-4 h-4 fill-amber-500" />
            </span>
          </div>

          <div>
            <div className="text-4xl font-black text-[#111827] tracking-tight flex items-baseline gap-2">
              <span>{streak}</span>
              <span className="text-sm font-bold text-slate-500">Lectures</span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Consecutive classes attended without unexcused absence
            </p>
          </div>

          <div className="pt-1">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-50 px-3 py-1 rounded-xl border border-amber-200">
              🔥 On Fire! Keep attending
            </span>
          </div>
        </div>

        {/* Card 3: Exam Eligibility Status */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Exam Eligibility</span>
            <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              isEligible ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
            }`}>
              <ShieldCheck className="w-5 h-5" />
            </span>
          </div>

          <div>
            <div className={`text-2xl font-black tracking-tight ${
              isEligible ? 'text-emerald-700' : 'text-rose-600'
            }`}>
              {isEligible ? 'Eligible for Exams' : 'Attendance Deficit'}
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              {isEligible
                ? 'Cleared for mid-term & end-term exams'
                : 'Deficit detention alert (< 75% required)'}
            </p>
          </div>

          <div className="pt-1">
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-xl border ${
              isEligible
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              {isEligible ? '✅ Benchmark Cleared' : '⚠️ Action Needed: Warning (<75%)'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. MAIN DASHBOARD CONTENT: 8 COLS (LEFT) + 4 COLS (RIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
        {/* LEFT COLUMN: TODAY'S SCHEDULE + COURSE PERFORMANCE (8 COLS) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Today's Schedule Section */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-[#111827] tracking-tight">
                  Today's Classes &bull; {dayName}
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Auto-synced from university central timetable
                </p>
              </div>

              <button
                type="button"
                onClick={onOpenClassesTab}
                className="text-xs font-bold text-[#1A4731] hover:text-[#143826] hover:underline flex items-center gap-1"
              >
                View Full Timetable <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Class Cards List */}
            {todayClasses.length > 0 ? (
              <div className="space-y-3">
                {todayClasses.map((cls, idx) => {
                  const isCurrent = cls.is_current_slot;
                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isCurrent
                          ? 'bg-[#EBF4EE]/80 border-emerald-300 ring-1 ring-emerald-300 shadow-sm'
                          : 'bg-white hover:bg-slate-50/80 border-slate-200/90'
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                          isCurrent
                            ? 'bg-[#1A4731] text-white shadow-sm'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                        }`}>
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-extrabold text-sm text-[#111827]">
                              {cls.subject_name || cls.subject_code}
                            </h3>
                            {isCurrent && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500 text-white uppercase tracking-wider animate-pulse">
                                Ongoing
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mt-1 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              {cls.start_time} - {cls.end_time}
                            </span>
                            <span>&bull;</span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              {cls.room || 'Room TBA'}
                            </span>
                            <span>&bull;</span>
                            <span className="flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              {cls.faculty_name || 'Prof. Faculty'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Action */}
                      <div className="sm:self-center shrink-0">
                        {isCurrent ? (
                          <button
                            type="button"
                            onClick={onStartScan}
                            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#1A4731] hover:bg-[#143826] active:scale-95 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 transition cursor-pointer"
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                            <span>Mark Attendance</span>
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-slate-400 px-3 py-1.5 rounded-xl bg-slate-100/80 block text-center">
                            Upcoming
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center space-y-2">
                <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-sm font-bold text-slate-700">No lectures scheduled for today</p>
                <p className="text-xs text-slate-500">Enjoy your free day or prepare for upcoming classes</p>
              </div>
            )}
          </div>

          {/* Subject-Wise Performance Breakdown */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-[#111827] tracking-tight">
                  Course Attendance Performance
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Semester 6 &bull; Defaulter radar and safe margin calculator
                </p>
              </div>

              <button
                type="button"
                onClick={onOpenSubjectAttendance}
                className="text-xs font-bold text-[#1A4731] hover:underline"
              >
                Deep Dive Analysis
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {subjects.map((sub, idx) => {
                const isSafe = sub.pct >= 75.0;
                const bCalc = sub.bunk_calculator;
                const attended = sub.attended ?? 10;
                const total = sub.total ?? 161;

                return (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl border border-slate-200/90 hover:border-emerald-300 transition-all bg-white hover:shadow-xs space-y-3.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-mono font-bold text-slate-400 uppercase">
                          {sub.subject_code || sub.code || 'CS301'}
                        </span>
                        <h4 className="font-extrabold text-sm text-[#111827] leading-tight">
                          {sub.subject_name || sub.name}
                        </h4>
                      </div>
                      <div className={`text-right ${isSafe ? 'text-emerald-700' : 'text-rose-600'}`}>
                        <span className="text-xl font-black">{sub.pct}%</span>
                        <span className="block text-[11px] font-mono text-slate-400">
                          {attended}/{total} classes
                        </span>
                      </div>
                    </div>

                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          sub.pct >= 75 ? 'bg-[#10B981]' : sub.pct >= 65 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, sub.pct))}%` }}
                      />
                    </div>

                    <div className="text-xs font-semibold">
                      {isSafe ? (
                        <span className="text-emerald-800 bg-[#EBF4EE] px-2.5 py-1 rounded-xl border border-emerald-200/60 inline-flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                          {bCalc?.safe_to_bunk != null
                            ? `Safe Skips: ${bCalc.safe_to_bunk} classes`
                            : 'Attendance Safe'}
                        </span>
                      ) : (
                        <span className="text-rose-700 bg-rose-50 px-2.5 py-1 rounded-xl border border-rose-200 inline-flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                          {bCalc?.classes_needed_for_75 != null
                            ? `Must attend next ${bCalc.classes_needed_for_75} classes`
                            : 'Below 75% threshold'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: BUNK CALCULATOR + RECENT ACTIVITY (4 COLS) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Widget 1: Interactive Bunk Simulator */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#1A4731] flex items-center justify-center">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-[#111827]">
                    Smart Bunk Simulator
                  </h3>
                  <p className="text-[11px] text-slate-500">Interactive What-If Matrix</p>
                </div>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                Live Tool
              </span>
            </div>

            {/* Subject Dropdown */}
            <div className="space-y-1.5 text-xs">
              <label className="text-[11px] font-bold text-slate-600">Select Subject:</label>
              <select
                value={selectedSubjectCode}
                onChange={(e) => {
                  setSelectedSubjectCode(e.target.value);
                  setBunkOffset(0);
                }}
                className="w-full bg-[#F8FAF9] border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#1A4731]"
              >
                {subjects.map((sub, i) => (
                  <option key={i} value={sub.subject_code || sub.code}>
                    {sub.subject_code || sub.code} - {sub.subject_name || sub.name} ({sub.pct}%)
                  </option>
                ))}
              </select>
            </div>

            {/* Simulation Scenario Buttons */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-600 block">Scenario Slider:</span>
              <div className="grid grid-cols-5 gap-1.5 text-xs font-bold">
                {[-2, -1, 0, 1, 2].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setBunkOffset(val)}
                    className={`py-2 rounded-xl transition-all cursor-pointer ${
                      bunkOffset === val
                        ? val < 0
                          ? 'bg-rose-500 text-white'
                          : val > 0
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[#1A4731] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {val > 0 ? `+${val}` : val}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 font-medium px-1">
                <span>Miss 2</span>
                <span>Current</span>
                <span>Attend 2</span>
              </div>
            </div>

            {/* Simulated Result Box */}
            <div className="p-4 rounded-2xl bg-[#F8FAF9] border border-slate-200/90 text-center space-y-1.5">
              <span className="text-xs text-slate-500 font-medium block">
                Projected Attendance:
              </span>
              <div className="text-3xl font-black text-[#111827]">
                {simulatedStats.pct}%
              </div>
              <p className={`text-xs font-bold ${
                simulatedStats.pct >= 75 ? 'text-emerald-700' : 'text-rose-600'
              }`}>
                {simulatedStats.pct >= 75
                  ? 'Safe from detention risk'
                  : '⚠️ Drops below 75% minimum threshold'}
              </p>
            </div>
          </div>

          {/* Widget 2: Recent Attendance Activity Log */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-[#111827]">
                Recent Attendance Log
              </h3>
              <button
                type="button"
                onClick={onOpenHistory}
                className="text-xs font-bold text-[#1A4731] hover:underline"
              >
                View All
              </button>
            </div>

            {recentLogs.length > 0 ? (
              <div className="space-y-3 divide-y divide-slate-100">
                {recentLogs.slice(0, 5).map((log, i) => (
                  <div key={i} className="pt-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-[#111827] block">
                        {log.subject_name || log.subject_code || 'Lecture'}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '09:02 AM'} &bull; {log.room || 'LAB-302'}
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#EBF4EE] text-emerald-800 border border-emerald-200">
                      Present (Phone)
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-6">No recent attendance records</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
