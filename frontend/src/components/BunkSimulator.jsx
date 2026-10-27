import React, { useState, useEffect, useMemo } from 'react';
import {
  Calculator, Calendar, Sliders, CheckCircle2, AlertTriangle, TrendingUp, TrendingDown,
  Award, Sparkles, RotateCcw, Info, ShieldCheck, Flame, BookOpen, Zap, ChevronRight,
  Check, X, Clock, Compass, Layers, Target, ShieldAlert, ArrowRight, Share2, HelpCircle
} from 'lucide-react';
import { api } from '../api';

export default function BunkSimulator({ studentRollNo, dashboardData, onRefreshDashboard, focusTab, focusSubject }) {
  // Extract student stats from dashboardData
  const overallAttended = dashboardData?.attendance?.attended_lectures || 34;
  const overallTotal = dashboardData?.attendance?.total_lectures || 40;
  const overallPct = dashboardData?.attendance?.current_pct || 85.0;
  const subjectsList = dashboardData?.subject_breakdown || [
    { subject: 'CS301 - Operating Systems', subject_code: 'CS301', attended: 22, total: 28, pct: 78.5 },
    { subject: 'CS302 - Database Systems', subject_code: 'CS302', attended: 24, total: 30, pct: 80.0 },
    { subject: 'CS303 - Machine Learning', subject_code: 'CS303', attended: 18, total: 24, pct: 75.0 }
  ];

  // Simulator controls
  const [selectedSubject, setSelectedSubject] = useState('CS301'); // default to CS301 (Machine Learning / OS)
  const [targetThreshold, setTargetThreshold] = useState(75.0); // UGC threshold default
  const [plannedBunks, setPlannedBunks] = useState(0);
  const [plannedAttends, setPlannedAttends] = useState(0);
  const [activeTab, setActiveTab] = useState('CALENDAR'); // 'SLIDERS' | 'CALENDAR' | 'ROADMAP' | 'SUBJECTS'
  const [serverSimResult, setServerSimResult] = useState(null);
  const [loadingServerSim, setLoadingServerSim] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Sync external focus requests (e.g. from recovery alerts)
  useEffect(() => {
    if (focusTab) {
      setActiveTab(focusTab);
    }
  }, [focusTab]);

  useEffect(() => {
    if (focusSubject) {
      setSelectedSubject(focusSubject);
    }
  }, [focusSubject]);

  // Initialize interactive 14-Day Calendar Timetable
  const [calendarSchedule, setCalendarSchedule] = useState(() => {
    const days = [
      { id: 1, dateStr: 'Fri, Oct 24', fullDate: '2026-10-24', day: 'Friday', subject: 'CS301 & IT401', classes: 2, action: 'BUNK', reason: 'Hackathon Leave 🏆', defaultLeave: true },
      { id: 2, dateStr: 'Mon, Oct 27', fullDate: '2026-10-27', day: 'Monday', subject: 'CS301 & EC601', classes: 2, action: 'ATTEND', reason: 'Regular Lecture' },
      { id: 3, dateStr: 'Tue, Oct 28', fullDate: '2026-10-28', day: 'Tuesday', subject: 'CS301 Lab & Tut', classes: 3, action: 'ATTEND', reason: 'Lab Session' },
      { id: 4, dateStr: 'Wed, Oct 29', fullDate: '2026-10-29', day: 'Wednesday', subject: 'CS301 & CS302', classes: 2, action: 'ATTEND', reason: 'Regular Lecture' },
      { id: 5, dateStr: 'Thu, Oct 30', fullDate: '2026-10-30', day: 'Thursday', subject: 'CS303 Seminar', classes: 2, action: 'ATTEND', reason: 'Seminar' },
      { id: 6, dateStr: 'Fri, Oct 31', fullDate: '2026-10-31', day: 'Friday', subject: 'CS301 & Project', classes: 2, action: 'ATTEND', reason: 'Review Class' },
      { id: 7, dateStr: 'Mon, Nov 03', fullDate: '2026-11-03', day: 'Monday', subject: 'CS301 & CS302', classes: 2, action: 'ATTEND', reason: 'Regular Lecture' },
      { id: 8, dateStr: 'Tue, Nov 04', fullDate: '2026-11-04', day: 'Tuesday', subject: 'CS303 & IT401', classes: 2, action: 'ATTEND', reason: 'Regular Lecture' },
      { id: 9, dateStr: 'Wed, Nov 05', fullDate: '2026-11-05', day: 'Wednesday', subject: 'CS301 & Lab', classes: 3, action: 'ATTEND', reason: 'Lab Evaluation' },
      { id: 10, dateStr: 'Thu, Nov 06', fullDate: '2026-11-06', day: 'Thursday', subject: 'CS302 & EC601', classes: 2, action: 'ATTEND', reason: 'Regular Lecture' },
      { id: 11, dateStr: 'Fri, Nov 07', fullDate: '2026-11-07', day: 'Friday', subject: 'CS301 & CS303', classes: 2, action: 'ATTEND', reason: 'Regular Lecture' }
    ];
    return days;
  });

  // Active Subject baseline numbers
  const activeSubjectData = useMemo(() => {
    if (selectedSubject === 'OVERALL') {
      return {
        code: 'OVERALL',
        title: 'Overall Semester Aggregate',
        attended: overallAttended,
        total: overallTotal,
        pct: overallPct
      };
    }
    const found = subjectsList.find(s => s.subject_code === selectedSubject || s.subject?.startsWith(selectedSubject));
    if (found) {
      return {
        code: found.subject_code || selectedSubject,
        title: found.subject || `${selectedSubject} - Course`,
        attended: found.attended,
        total: found.total,
        pct: found.pct
      };
    }
    return {
      code: 'CS301',
      title: 'CS301 - Operating Systems / Machine Learning',
      attended: Math.round(overallAttended * 0.35),
      total: Math.round(overallTotal * 0.35),
      pct: 78.5
    };
  }, [selectedSubject, overallAttended, overallTotal, overallPct, subjectsList]);

  // Calendar toggle leave count
  const calendarBunks = useMemo(() => {
    return calendarSchedule
      .filter(item => item.action === 'BUNK')
      .reduce((acc, curr) => acc + curr.classes, 0);
  }, [calendarSchedule]);

  const calendarAttends = useMemo(() => {
    return calendarSchedule
      .filter(item => item.action === 'ATTEND')
      .reduce((acc, curr) => acc + curr.classes, 0);
  }, [calendarSchedule]);

  // Combined planned bunks based on active mode
  const effectiveBunks = activeTab === 'CALENDAR' ? calendarBunks : plannedBunks;
  const effectiveAttends = activeTab === 'CALENDAR' ? 0 : plannedAttends;

  // Instant local calculation for 0ms reactivity
  const localSim = useMemo(() => {
    const attended = activeSubjectData.attended;
    const total = activeSubjectData.total;
    const origPct = total > 0 ? Math.round((attended / total) * 1000) / 10 : 100.0;

    const projAttended = attended + effectiveAttends;
    const projTotal = total + effectiveBunks + effectiveAttends;
    const projPct = projTotal > 0 ? Math.round((projAttended / projTotal) * 1000) / 10 : 100.0;
    const delta = Math.round((projPct - origPct) * 10) / 10;

    const tRatio = targetThreshold / 100.0;
    let safeSkips = 0;
    let classesNeeded = 0;
    let status = 'SAFE';

    if (projPct >= targetThreshold) {
      status = 'SAFE';
      safeSkips = Math.max(0, Math.floor((projAttended - tRatio * projTotal) / tRatio));
    } else {
      status = 'DEFICIT';
      const denom = Math.max(0.01, 1.0 - tRatio);
      classesNeeded = Math.max(1, Math.ceil((tRatio * projTotal - projAttended) / denom));
    }

    // Baseline (before planned actions)
    let baselineSafeSkips = 0;
    let baselineClassesNeeded = 0;
    if (origPct >= targetThreshold) {
      baselineSafeSkips = Math.max(0, Math.floor((attended - tRatio * total) / tRatio));
    } else {
      const denom = Math.max(0.01, 1.0 - tRatio);
      baselineClassesNeeded = Math.max(1, Math.ceil((tRatio * total - attended) / denom));
    }

    // Generate Recovery Ladder
    const recoveryLadder = [];
    if (projPct < targetThreshold) {
      const needed = classesNeeded;
      const count = Math.min(needed, 8);
      for (let i = 1; i <= count; i++) {
        const aAfter = projAttended + i;
        const tAfter = projTotal + i;
        const pAfter = Math.round((aAfter / tAfter) * 1000) / 10;
        recoveryLadder.push({
          step: i,
          attendedAdd: i,
          pct: pAfter,
          reached: pAfter >= targetThreshold,
          label: `Attend +${i} consecutive lecture${i !== 1 ? 's' : ''}`
        });
      }
      if (needed > 8) {
        // Add final target checkpoint
        const aFinal = projAttended + needed;
        const tFinal = projTotal + needed;
        const pFinal = Math.round((aFinal / tFinal) * 1000) / 10;
        recoveryLadder.push({
          step: needed,
          attendedAdd: needed,
          pct: pFinal,
          reached: true,
          label: `Attend +${needed} consecutive lectures (Target Reached!)`
        });
      }
    }

    // Generate Cushion Ladder
    const cushionLadder = [];
    if (projPct >= targetThreshold) {
      const maxSteps = Math.min(safeSkips + 2, 8);
      for (let i = 1; i <= maxSteps; i++) {
        const tAfter = projTotal + i;
        const pAfter = Math.round((projAttended / tAfter) * 1000) / 10;
        const stillSafe = pAfter >= targetThreshold;
        cushionLadder.push({
          skipCount: i,
          pct: pAfter,
          stillSafe,
          bufferLeft: Math.max(0, safeSkips - i)
        });
      }
    }

    return {
      origPct,
      projPct,
      delta,
      status,
      safeSkips,
      classesNeeded,
      baselineSafeSkips,
      baselineClassesNeeded,
      projAttended,
      projTotal,
      recoveryLadder,
      cushionLadder
    };
  }, [activeSubjectData, effectiveBunks, effectiveAttends, targetThreshold]);

  // Synchronize with backend API for verified simulation & audit logs
  useEffect(() => {
    let active = true;
    const fetchServerSim = async () => {
      try {
        setLoadingServerSim(true);
        const futureEventsPayload = activeTab === 'CALENDAR'
          ? calendarSchedule.map(item => ({
              date: item.fullDate,
              day: item.day,
              title: item.reason,
              classes_count: item.classes,
              action: item.action
            }))
          : [];

        const res = await api.simulateAttendance({
          rollNo: studentRollNo,
          subjectCode: selectedSubject,
          plannedBunks: activeTab === 'CALENDAR' ? 0 : plannedBunks,
          plannedAttends: activeTab === 'CALENDAR' ? 0 : plannedAttends,
          targetThreshold,
          futureEvents: futureEventsPayload
        });

        if (active && res.simulation) {
          setServerSimResult(res.simulation);
        }
      } catch (err) {
        console.warn('Simulation API sync fallback to client calculation:', err);
      } finally {
        if (active) setLoadingServerSim(false);
      }
    };

    const timer = setTimeout(fetchServerSim, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [studentRollNo, selectedSubject, plannedBunks, plannedAttends, targetThreshold, calendarSchedule, activeTab]);

  // Quick Preset Actions
  const applyPreset = (preset) => {
    switch (preset) {
      case 'HACKATHON':
        setActiveTab('SLIDERS');
        setPlannedBunks(2);
        setPlannedAttends(0);
        break;
      case 'SICK_LEAVE':
        setActiveTab('SLIDERS');
        setPlannedBunks(3);
        setPlannedAttends(0);
        break;
      case 'EXTENDED_FEST':
        setActiveTab('SLIDERS');
        setPlannedBunks(4);
        setPlannedAttends(0);
        break;
      case 'RECOVERY_SPRINT':
        setActiveTab('SLIDERS');
        setPlannedBunks(0);
        setPlannedAttends(5);
        break;
      case 'TARGET_SAFE':
        setActiveTab('SLIDERS');
        if (localSim.status === 'DEFICIT') {
          setPlannedAttends(localSim.classesNeeded);
          setPlannedBunks(0);
        } else {
          setPlannedBunks(localSim.safeSkips);
          setPlannedAttends(0);
        }
        break;
      case 'RESET':
        setPlannedBunks(0);
        setPlannedAttends(0);
        setCalendarSchedule(prev => prev.map(d => ({ ...d, action: 'ATTEND', reason: 'Regular Lecture' })));
        break;
      default:
        break;
    }
  };

  // Toggle calendar item
  const toggleCalendarDay = (id) => {
    setCalendarSchedule(prev => prev.map(item => {
      if (item.id === id) {
        const nextAction = item.action === 'ATTEND' ? 'BUNK' : 'ATTEND';
        const nextReason = nextAction === 'BUNK' ? 'Hackathon / Leave' : 'Regular Lecture';
        return { ...item, action: nextAction, reason: nextReason };
      }
      return item;
    }));
  };

  // Set specific reason
  const setCalendarReason = (id, reason) => {
    setCalendarSchedule(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, reason };
      }
      return item;
    }));
  };

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-7 border border-[#E5E7EB] shadow-xs relative overflow-hidden transition-all duration-300">
      {/* Background Ambient Glow */}
      <div className={`absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-20 -mr-20 -mt-20 transition-all duration-500 ${
        localSim.status === 'SAFE' ? 'bg-emerald-200' : 'bg-rose-200'
      }`} />
      <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-10 -ml-20 -mb-20 bg-emerald-200" />

      {/* Header Bar */}
      <div className="relative z-10 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-xs transition-colors ${
              localSim.status === 'SAFE'
                ? 'bg-[#1A4731] text-white shadow-emerald-900/10'
                : 'bg-rose-600 text-white shadow-rose-900/10'
            }`}>
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-[#111827] tracking-tight flex items-center gap-2">
                  The "Bunk Calculator" &amp; Predictive Safety Simulator
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1 shadow-xs">
                  <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> Student Favorite 🔥
                </span>
              </div>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Stress-free interactive attendance planner: simulate hackathons, visualize safety cushions, and map recovery roadmaps.
              </p>
            </div>
          </div>

          {/* Preset Buttons & Quick Reset */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => applyPreset('RESET')}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-[#111827] border border-slate-200 flex items-center gap-1.5 transition active:scale-95 shadow-xs"
              title="Reset Simulator to current real baseline"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#6B7280]" />
              <span>Reset</span>
            </button>
            <div className="px-3 py-1.5 rounded-xl bg-[#EBF4EE] border border-emerald-200 flex items-center gap-1.5 text-xs font-mono text-[#1A4731] font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-[#10B981]" />
              <span>ACID 75% Engine</span>
            </div>
          </div>
        </div>

        {/* Dynamic Highlight Card */}
        <div className={`p-4 sm:p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden ${
          localSim.status === 'SAFE'
            ? 'bg-emerald-50/70 border-emerald-200 shadow-xs'
            : 'bg-rose-50/70 border-rose-200 shadow-xs'
        }`}>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border flex items-center gap-1.5 ${
                  localSim.status === 'SAFE'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : 'bg-rose-100 text-rose-800 border-rose-200'
                }`}>
                  {localSim.status === 'SAFE' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
                  {localSim.status === 'SAFE' ? 'SAFE STANDING (NO DETENTION RISK)' : 'CRITICAL DEFICIT (DETENTION WARNING)'}
                </span>
                <span className="text-xs text-[#6B7280] font-mono">
                  Target Threshold: {targetThreshold.toFixed(1)}% UGC Limit
                </span>
              </div>

              {/* The Signature Dynamic Phrase */}
              <p className="text-sm sm:text-base font-medium text-[#111827] leading-relaxed">
                In <span className="text-[#1A4731] underline decoration-emerald-500/50 font-bold">{activeSubjectData.title}</span>,
                your current attendance is <span className="text-[#111827] font-mono font-bold">{activeSubjectData.pct}%</span>.
                {' '}
                {localSim.baselineSafeSkips > 0 ? (
                  <span>
                    You can safely miss <span className="text-[#1A4731] font-black text-lg underline decoration-emerald-500">{localSim.baselineSafeSkips} more class{localSim.baselineSafeSkips !== 1 ? 'es' : ''}</span> without dropping below the {targetThreshold}% UGC limit.
                  </span>
                ) : (
                  <span>
                    You are in the danger zone! You must attend the next <span className="text-rose-700 font-black text-lg underline decoration-rose-500">{localSim.baselineClassesNeeded} consecutive lecture{localSim.baselineClassesNeeded !== 1 ? 's' : ''}</span> to climb back to safety.
                  </span>
                )}
              </p>

              {/* What-If Impact Feedback */}
              {(effectiveBunks > 0 || effectiveAttends > 0) && (
                <p className="text-xs text-[#4B5563] font-medium flex items-center gap-2 pt-1">
                  <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
                  <span>
                    <strong>What-If Simulation Active:</strong> {effectiveBunks > 0 ? `Missing ${effectiveBunks} planned class${effectiveBunks !== 1 ? 'es' : ''}` : ''}{effectiveBunks > 0 && effectiveAttends > 0 ? ' & ' : ''}{effectiveAttends > 0 ? `attending ${effectiveAttends} classes` : ''} shifts your attendance to <strong className={localSim.projPct >= targetThreshold ? 'text-[#1A4731]' : 'text-rose-600'}>{localSim.projPct}%</strong> ({localSim.delta >= 0 ? `+${localSim.delta}%` : `${localSim.delta}%`}).
                    {' '}
                    {localSim.status === 'SAFE' ? `You will still have ${localSim.safeSkips} safe buffer bunk${localSim.safeSkips !== 1 ? 's' : ''} remaining.` : `You will need ${localSim.classesNeeded} consecutive attends to recover.`}
                  </span>
                </p>
              )}
            </div>

            {/* Quick Stats Pill */}
            <div className="shrink-0 flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-center px-3 border-r border-slate-200">
                <span className="text-[11px] text-[#6B7280] uppercase font-bold block">Original</span>
                <span className="text-xl font-mono font-black text-[#111827]">{activeSubjectData.pct}%</span>
              </div>
              <div className="text-center px-2">
                <span className="text-[11px] text-[#6B7280] uppercase font-bold block">Projected</span>
                <span className={`text-2xl font-mono font-black ${localSim.projPct >= targetThreshold ? 'text-[#1A4731]' : 'text-rose-600'}`}>
                  {localSim.projPct}%
                </span>
              </div>
              <div className="text-center pl-2">
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${localSim.delta >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                  {localSim.delta >= 0 ? `+${localSim.delta}%` : `${localSim.delta}%`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Subject & Regulatory Threshold Selector Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Subject Dropdown */}
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#111827] flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-[#10B981]" /> Choose Subject for Simulation
              </span>
              <span className="text-[11px] text-[#6B7280] font-mono">
                {activeSubjectData.attended} / {activeSubjectData.total} Lectures
              </span>
            </div>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full bg-[#F8FAF9] border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#111827] font-medium focus:ring-2 focus:ring-[#1A4731] focus:outline-none cursor-pointer"
            >
              <option value="OVERALL">📊 All Subjects Combined (Overall Semester Aggregate - {overallPct}%)</option>
              {subjectsList.map((sub, idx) => (
                <option key={idx} value={sub.subject_code || sub.subject}>
                  📘 {sub.subject} ({sub.pct}%)
                </option>
              ))}
            </select>
          </div>

          {/* Threshold Target Selector */}
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#111827] flex items-center gap-1.5">
                <Target className="w-4 h-4 text-[#10B981]" /> Target Threshold Limit
              </span>
              <span className="font-mono text-xs font-bold text-[#1A4731]">{targetThreshold.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTargetThreshold(75.0)}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition border ${
                  targetThreshold === 75.0
                    ? 'bg-[#1A4731] text-white border-[#1A4731] shadow-xs'
                    : 'bg-white text-[#6B7280] border-slate-200 hover:text-[#111827] hover:bg-slate-50'
                }`}
              >
                75% UGC Limit
              </button>
              <button
                onClick={() => setTargetThreshold(80.0)}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition border ${
                  targetThreshold === 80.0
                    ? 'bg-[#1A4731] text-white border-[#1A4731] shadow-xs'
                    : 'bg-white text-[#6B7280] border-slate-200 hover:text-[#111827] hover:bg-slate-50'
                }`}
              >
                80% Honors
              </button>
              <button
                onClick={() => setTargetThreshold(85.0)}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition border ${
                  targetThreshold === 85.0
                    ? 'bg-[#1A4731] text-white border-[#1A4731] shadow-xs'
                    : 'bg-white text-[#6B7280] border-slate-200 hover:text-[#111827] hover:bg-slate-50'
                }`}
              >
                85% Scholarship
              </button>
            </div>
          </div>
        </div>

        {/* Feature Mode Tabs */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab('CALENDAR')}
            className={`flex-1 min-w-[140px] py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
              activeTab === 'CALENDAR'
                ? 'bg-[#1A4731] text-white shadow-xs'
                : 'text-[#6B7280] hover:text-[#111827] hover:bg-white'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>"What-If" Calendar</span>
            {calendarBunks > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[11px] bg-rose-500 text-white font-mono">
                {calendarBunks} bunks
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('SLIDERS')}
            className={`flex-1 min-w-[140px] py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
              activeTab === 'SLIDERS'
                ? 'bg-[#1A4731] text-white shadow-xs'
                : 'text-[#6B7280] hover:text-[#111827] hover:bg-white'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Interactive Sliders</span>
            {(plannedBunks > 0 || plannedAttends > 0) && (
              <span className="px-1.5 py-0.5 rounded-full text-[11px] bg-emerald-600 text-white font-mono">
                {plannedBunks}b / {plannedAttends}a
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('ROADMAP')}
            className={`flex-1 min-w-[150px] py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
              activeTab === 'ROADMAP'
                ? 'bg-[#1A4731] text-white shadow-xs'
                : 'text-[#6B7280] hover:text-[#111827] hover:bg-white'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>{localSim.status === 'SAFE' ? 'Safety Cushion Ladder' : 'Recovery Roadmap'}</span>
          </button>

          <button
            onClick={() => setActiveTab('SUBJECTS')}
            className={`flex-1 min-w-[140px] py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
              activeTab === 'SUBJECTS'
                ? 'bg-[#1A4731] text-white shadow-xs'
                : 'text-[#6B7280] hover:text-[#111827] hover:bg-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Curriculum Matrix</span>
          </button>
        </div>

        {/* TAB 1: "WHAT-IF" CALENDAR TIMETABLE SIMULATOR */}
        {activeTab === 'CALENDAR' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-[#EBF4EE] border border-emerald-200 text-xs">
              <div className="flex items-center gap-2 text-[#123323]">
                <Calendar className="w-4 h-4 text-[#10B981]" />
                <span>
                  <strong>Upcoming 14-Day Schedule:</strong> Click any day to simulate taking leave (e.g. for a Friday hackathon or fest).
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => applyPreset('HACKATHON')}
                  className="px-2.5 py-1 rounded-lg bg-[#1A4731] text-white hover:bg-[#123323] transition text-[11px] font-bold shadow-xs"
                >
                  🚀 Test Friday Hackathon Preset
                </button>
                <button
                  onClick={() => setCalendarSchedule(prev => prev.map(d => ({ ...d, action: 'ATTEND', reason: 'Regular Lecture' })))}
                  className="px-2.5 py-1 rounded-lg bg-white text-[#6B7280] hover:bg-slate-50 border border-slate-200 transition text-[11px] font-medium shadow-xs"
                >
                  Clear Leaves
                </button>
              </div>
            </div>

            {/* Interactive Day Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {calendarSchedule.map((item) => {
                const isLeave = item.action === 'BUNK';
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleCalendarDay(item.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden select-none active:scale-[0.98] ${
                      isLeave
                        ? 'bg-rose-50/80 border-rose-300 hover:border-rose-400 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-emerald-300 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-[#111827]">{item.dateStr}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                        isLeave
                          ? 'bg-rose-100 text-rose-800 border-rose-200'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      }`}>
                        {isLeave ? '🌴 Taking Leave' : '✅ Attending'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[11px] text-[#4B5563] truncate font-medium">{item.subject}</p>
                      <div className="flex items-center justify-between text-[11px] text-[#6B7280]">
                        <span>{item.classes} Lecture{item.classes !== 1 ? 's' : ''}</span>
                        <span className="font-mono text-[#1A4731] font-semibold">{item.day}</span>
                      </div>
                    </div>

                    {/* Leave Reason Picker */}
                    {isLeave && (
                      <div className="mt-2.5 pt-2 border-t border-rose-200" onClick={(e) => e.stopPropagation()}>
                        <label className="text-[11px] text-rose-800 uppercase font-bold block mb-1">Reason Tag:</label>
                        <select
                          value={item.reason}
                          onChange={(e) => setCalendarReason(item.id, e.target.value)}
                          className="w-full bg-white border border-rose-300 rounded-lg text-[11px] text-rose-900 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-rose-500"
                        >
                          <option value="Hackathon Leave 🏆">Hackathon Leave 🏆</option>
                          <option value="Personal Leave 🏖️">Personal Leave 🏖️</option>
                          <option value="Sick / Medical 🏥">Sick / Medical 🏥</option>
                          <option value="Study / Exam Prep 📚">Study / Exam Prep 📚</option>
                          <option value="College Fest ⚡">College Fest ⚡</option>
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Calendar Simulation Summary Box */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <p className="text-xs font-bold text-[#111827] flex items-center justify-center sm:justify-start gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Calendar Simulation Outcome</span>
                </p>
                <p className="text-xs text-[#6B7280]">
                  Total Planned Leaves across calendar: <strong className="text-rose-600">{calendarBunks} lecture{calendarBunks !== 1 ? 's' : ''} missed</strong>.
                  {' '}
                  New aggregate projected attendance: <strong className={localSim.projPct >= targetThreshold ? 'text-[#1A4731]' : 'text-rose-600'}>{localSim.projPct}%</strong>.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
                  localSim.status === 'SAFE'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : 'bg-rose-100 text-rose-800 border-rose-200'
                }`}>
                  {localSim.status === 'SAFE' ? `Safe: +${localSim.safeSkips} Buffer Skips Left` : `Warning: Need ${localSim.classesNeeded} Attends`}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: INTERACTIVE WHAT-IF SLIDERS */}
        {activeTab === 'SLIDERS' && (
          <div className="space-y-5 animate-in fade-in duration-300">
            {/* Quick Presets Bar */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#111827] uppercase tracking-wider block">
                Popular Student What-If Presets:
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => applyPreset('HACKATHON')}
                  className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-[#111827] border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-xs"
                >
                  🚀 Friday Hackathon (-2 Lectures)
                </button>
                <button
                  onClick={() => applyPreset('SICK_LEAVE')}
                  className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-[#111827] border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-xs"
                >
                  🤒 Medical Leave (-3 Lectures)
                </button>
                <button
                  onClick={() => applyPreset('EXTENDED_FEST')}
                  className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-[#111827] border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-xs"
                >
                  🌴 Long Weekend Fest (-4 Lectures)
                </button>
                <button
                  onClick={() => applyPreset('RECOVERY_SPRINT')}
                  className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-[#111827] border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-xs"
                >
                  ⚡ Recovery Sprint (+5 Attends)
                </button>
                <button
                  onClick={() => applyPreset('TARGET_SAFE')}
                  className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-[#111827] border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-xs"
                >
                  🎯 Exact Safe Target
                </button>
              </div>
            </div>

            {/* Sliders Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Slider 1: Missed Lectures (Bunks) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-rose-50/40 border border-rose-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      Simulate Missed Lectures (Bunk / Leave)
                    </span>
                    <p className="text-[11px] text-[#6B7280]">Classes you plan to take off</p>
                  </div>
                  <span className="text-2xl font-mono font-black text-rose-700">
                    {plannedBunks}
                  </span>
                </div>

                <div className="space-y-2">
                  <input
                    type="range"
                    min="0"
                    max="15"
                    step="1"
                    value={plannedBunks}
                    onChange={(e) => setPlannedBunks(parseInt(e.target.value) || 0)}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                  />
                  <div className="flex justify-between text-[11px] text-[#6B7280] font-mono">
                    <span>0 (None)</span>
                    <span>5</span>
                    <span>10</span>
                    <span>15 Max</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setPlannedBunks(Math.max(0, plannedBunks - 1))}
                    className="flex-1 py-1.5 bg-white hover:bg-slate-50 text-[#111827] rounded-lg text-xs font-bold border border-slate-200 shadow-xs"
                  >
                    -1 Class
                  </button>
                  <button
                    onClick={() => setPlannedBunks(Math.min(15, plannedBunks + 1))}
                    className="flex-1 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg text-xs font-bold border border-rose-300"
                  >
                    +1 Bunk
                  </button>
                </div>
              </div>

              {/* Slider 2: Attended Lectures (Recovery Sprint) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/40 border border-emerald-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
                      Simulate Attended Lectures
                    </span>
                    <p className="text-[11px] text-[#6B7280]">Future classes you commit to attending</p>
                  </div>
                  <span className="text-2xl font-mono font-black text-[#1A4731]">
                    +{plannedAttends}
                  </span>
                </div>

                <div className="space-y-2">
                  <input
                    type="range"
                    min="0"
                    max="15"
                    step="1"
                    value={plannedAttends}
                    onChange={(e) => setPlannedAttends(parseInt(e.target.value) || 0)}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                  <div className="flex justify-between text-[11px] text-[#6B7280] font-mono">
                    <span>0</span>
                    <span>5</span>
                    <span>10</span>
                    <span>15 Max</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setPlannedAttends(Math.max(0, plannedAttends - 1))}
                    className="flex-1 py-1.5 bg-white hover:bg-slate-50 text-[#111827] rounded-lg text-xs font-bold border border-slate-200 shadow-xs"
                  >
                    -1 Class
                  </button>
                  <button
                    onClick={() => setPlannedAttends(Math.min(15, plannedAttends + 1))}
                    className="flex-1 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-300"
                  >
                    +1 Attend
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: RECOVERY ROADMAP & CUSHION LADDER */}
        {activeTab === 'ROADMAP' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {localSim.status === 'DEFICIT' ? (
              /* RECOVERY ROADMAP WHEN IN DANGER ZONE */
              <div className="p-5 rounded-2xl bg-rose-50/50 border border-rose-200 shadow-xs space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-rose-950 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                      <span>Academic Detention Recovery Roadmap</span>
                    </h3>
                    <p className="text-xs text-rose-900 mt-1">
                      Target recovery goal: Climb back above the <strong>{targetThreshold}% UGC threshold</strong>.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-black bg-rose-600 text-white font-mono shadow-xs">
                    Need {localSim.classesNeeded} Lectures
                  </span>
                </div>

                {/* The Signature Requirement Statement */}
                <div className="p-3.5 rounded-xl bg-white border border-rose-200 text-xs text-[#111827] shadow-xs">
                  <p className="font-bold text-rose-900 text-sm">
                    🎯 Mandatory Recovery Requirement:
                  </p>
                  <p className="mt-0.5 leading-relaxed text-[#4B5563]">
                    You must attend the next <strong className="text-rose-950 text-base underline decoration-rose-400">{localSim.classesNeeded} consecutive lectures</strong> to climb back to <strong className="text-[#1A4731]">{targetThreshold}%+</strong> attendance and unlock your exam hall ticket.
                  </p>
                </div>

                {/* Step-by-Step Progress Ladder */}
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">
                    Sequential Lecture Milestones:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {localSim.recoveryLadder.map((step, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border flex items-center justify-between text-xs transition ${
                          step.reached
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-xs'
                            : 'bg-white border-slate-200 text-[#111827]'
                        }`}
                      >
                        <div>
                          <p className="font-bold flex items-center gap-1.5">
                            {step.reached ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <ChevronRight className="w-3.5 h-3.5 text-[#10B981]" />}
                            <span>Lecture +{step.attendedAdd}</span>
                          </p>
                          <p className="text-[11px] text-[#6B7280] mt-0.5">
                            {step.reached ? '🎉 UGC Minimum Cleared!' : 'Recovering deficit'}
                          </p>
                        </div>
                        <span className={`text-sm font-mono font-black ${step.reached ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {step.pct}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* CUSHION RUNWAY WHEN IN SAFE ZONE */
              <div className="p-5 rounded-2xl bg-emerald-50/40 border border-emerald-200 shadow-xs space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span>Safe Cushion Degradation Ladder</span>
                    </h3>
                    <p className="text-xs text-emerald-900 mt-1">
                      Visual degradation ladder showing how future bunks affect your standing before hitting the {targetThreshold}% limit:
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-black bg-[#1A4731] text-white font-mono shadow-xs">
                    +{localSim.safeSkips} Safe Skips
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-emerald-200 text-xs text-[#111827] shadow-xs">
                  <p className="font-bold text-[#1A4731] text-sm">
                    🛡️ Safe Buffer Confirmation:
                  </p>
                  <p className="mt-0.5 leading-relaxed text-[#4B5563]">
                    You can safely skip up to <strong className="text-[#111827] text-base underline decoration-emerald-500">{localSim.safeSkips} lecture{localSim.safeSkips !== 1 ? 's' : ''}</strong> without dropping below the university regulatory threshold.
                  </p>
                </div>

                {/* Degradation Matrix */}
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">
                    Degradation with Subsequent Skips:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {localSim.cushionLadder.map((step, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                          step.stillSafe
                            ? step.bufferLeft === 0
                              ? 'bg-amber-50 border-amber-300 text-amber-950'
                              : 'bg-white border-slate-200 text-[#111827]'
                            : 'bg-rose-50 border-rose-300 text-rose-950'
                        }`}
                      >
                        <div>
                          <p className="font-bold">Skip {step.skipCount} Class{step.skipCount !== 1 ? 'es' : ''}</p>
                          <p className="text-[11px] text-[#6B7280] mt-0.5">
                            {step.stillSafe
                              ? step.bufferLeft === 0
                                ? '⚠️ Final Safe Class'
                                : `${step.bufferLeft} safe skips left`
                              : '🛑 Detention Zone Breach'}
                          </p>
                        </div>
                        <span className={`text-sm font-mono font-black ${
                          step.stillSafe ? (step.bufferLeft === 0 ? 'text-amber-700' : 'text-emerald-700') : 'text-rose-700'
                        }`}>
                          {step.pct}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SUBJECT CURRICULUM MATRIX */}
        {activeTab === 'SUBJECTS' && (
          <div className="space-y-3 animate-in fade-in duration-300">
            <p className="text-xs text-[#6B7280]">
              Curriculum breakdown with independent thresholds. Click <strong>"Simulate"</strong> on any subject to load it directly into the simulator:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {subjectsList.map((sub, idx) => {
                const subPct = sub.pct;
                const isSubSafe = subPct >= targetThreshold;
                const tRatio = targetThreshold / 100.0;
                const subSafeSkips = isSubSafe
                  ? Math.max(0, Math.floor((sub.attended - tRatio * sub.total) / tRatio))
                  : 0;
                const subNeeded = !isSubSafe
                  ? Math.max(1, Math.ceil((tRatio * sub.total - sub.attended) / Math.max(0.01, 1 - tRatio)))
                  : 0;

                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border transition-all ${
                      selectedSubject === (sub.subject_code || sub.subject)
                        ? 'bg-emerald-50/50 border-[#1A4731] ring-1 ring-[#1A4731] shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-[#111827]">{sub.subject}</h4>
                        <p className="text-[11px] text-[#6B7280] mt-0.5">
                          {sub.attended} Attended / {sub.total} Conducted
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs font-mono font-black ${
                        isSubSafe ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {subPct}%
                      </span>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden my-2.5">
                      <div
                        className={`h-full rounded-full ${isSubSafe ? 'bg-[#10B981]' : 'bg-rose-500'}`}
                        style={{ width: `${Math.min(100, subPct)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className={`text-[11px] font-semibold ${isSubSafe ? 'text-[#1A4731]' : 'text-rose-700'}`}>
                        {isSubSafe ? `✅ ${subSafeSkips} Safe Skips` : `⚠️ Must Attend ${subNeeded}`}
                      </span>

                      <button
                        onClick={() => {
                          setSelectedSubject(sub.subject_code || sub.subject);
                          setActiveTab('SLIDERS');
                        }}
                        className="px-2.5 py-1 bg-[#1A4731] hover:bg-[#123323] text-white rounded-lg text-[11px] font-bold transition shadow-xs"
                      >
                        Simulate Subject &rarr;
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
