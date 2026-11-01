import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingDown, TrendingUp, AlertTriangle, Users, Calendar, BookOpen,
  Filter, RefreshCw, Send, CheckCircle2, ChevronRight, Info, Search,
  Award, ArrowUpRight, ArrowDownRight, Clock, ShieldAlert, Sparkles,
  HelpCircle, X, ChevronDown, Check
} from 'lucide-react';
import { api } from '../../api';
import { toast } from '../ui/Toast';

export default function FacultyInsightsView({ user, onGoHome }) {
  // Filters State
  const [section, setSection] = useState('ALL');
  const [subject, setSubject] = useState('ALL');
  const [semester, setSemester] = useState(0);
  const [dateRange, setDateRange] = useState('30d');
  const [threshold, setThreshold] = useState(75);
  const [customThresholdInput, setCustomThresholdInput] = useState('75');

  // Data State
  const [loading, setLoading] = useState(true);
  const [overviewData, setOverviewData] = useState(null);
  const [filterOptions, setFilterOptions] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Student Table & Drilldown State
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedRiskFilter, setSelectedRiskFilter] = useState('ALL');
  const [activeTabCard, setActiveTabCard] = useState(null);

  // Modals State
  const [selectedStudentForAction, setSelectedStudentForAction] = useState(null);
  const [actionTitle, setActionTitle] = useState('Official Attendance Notice');
  const [actionMessage, setActionMessage] = useState('');
  const [actionSeverity, setActionSeverity] = useState('WARNING');
  const [sendingAction, setSendingAction] = useState(false);
  const [showFormulaModal, setShowFormulaModal] = useState(false);

  // Load Filter Options Once
  useEffect(() => {
    let mounted = true;
    async function loadFilters() {
      try {
        const filters = await api.getFacultyInsightsFilters();
        if (mounted && filters && filters.success) {
          setFilterOptions(filters);
          if (filters.default_threshold) {
            setThreshold(filters.default_threshold);
            setCustomThresholdInput(String(filters.default_threshold));
          }
        }
      } catch (err) {
        console.warn('Could not load dynamic insight filter options:', err);
      }
    }
    loadFilters();
    return () => { mounted = false; };
  }, []);

  // Fetch Insights Data whenever filters change
  const fetchInsights = async () => {
    try {
      setRefreshing(true);
      const data = await api.getFacultyInsightsOverview({
        section,
        subject,
        semester,
        threshold,
        date_range: dateRange
      });
      if (data && data.success) {
        setOverviewData(data);
      }
    } catch (err) {
      toast.error('Failed to load attendance intelligence: ' + (err.message || 'Server error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [section, subject, semester, dateRange, threshold]);

  // Handle Threshold Change
  const handleThresholdApply = (newVal) => {
    const parsed = parseFloat(newVal);
    if (!isNaN(parsed) && parsed >= 50 && parsed <= 95) {
      setThreshold(parsed);
      setCustomThresholdInput(String(parsed));
    } else {
      setCustomThresholdInput(String(threshold));
      toast.error('Please enter a threshold percentage between 50% and 95%.');
    }
  };

  // Filtered Students List
  const displayedStudents = useMemo(() => {
    if (!overviewData || !overviewData.students) return [];
    let list = overviewData.students;

    if (selectedRiskFilter !== 'ALL') {
      if (selectedRiskFilter === 'AT_RISK') {
        list = list.filter(s => s.risk_tier === 'CRITICAL' || s.risk_tier === 'WARNING');
      } else {
        list = list.filter(s => s.risk_tier === selectedRiskFilter);
      }
    }

    if (studentSearch.trim()) {
      const q = studentSearch.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.roll_no.toLowerCase().includes(q) ||
        (s.department && s.department.toLowerCase().includes(q))
      );
    }
    return list;
  }, [overviewData, selectedRiskFilter, studentSearch]);

  // Handle Card Click for instant drilldown
  const handleCardClick = (cardId) => {
    setActiveTabCard(activeTabCard === cardId ? null : cardId);
    if (cardId === 'at_risk_students' || cardId === 'students_needing_attention') {
      setSelectedRiskFilter('AT_RISK');
      const el = document.getElementById('student-roster-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (cardId === 'positive_trends') {
      setSelectedRiskFilter('SAFE');
      const el = document.getElementById('student-roster-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Dispatch Official Intervention Notice
  const handleSendIntervention = async () => {
    if (!selectedStudentForAction || !actionMessage.trim()) {
      toast.error('Please enter a notification message.');
      return;
    }
    setSendingAction(true);
    try {
      const res = await api.notifyStudentIntervention({
        roll_no: selectedStudentForAction.roll_no,
        title: actionTitle,
        message: actionMessage,
        severity: actionSeverity,
        subject_code: subject !== 'ALL' ? subject : null
      });
      toast.success(res.message || 'Notification dispatched successfully.');
      setSelectedStudentForAction(null);
      setActionMessage('');
    } catch (err) {
      toast.error('Failed to dispatch notice: ' + (err.message || 'Unknown error'));
    } finally {
      setSendingAction(false);
    }
  };

  // Open Action Modal
  const openActionModal = (student) => {
    setSelectedStudentForAction(student);
    setActionTitle(`Attendance Notice: ${student.name}`);
    setActionSeverity(student.risk_tier === 'CRITICAL' ? 'CRITICAL' : 'WARNING');
    setActionMessage(
      `Dear ${student.name}, your current attendance is ${student.current_pct.toFixed(1)}%, which is below the required ${student.threshold_pct.toFixed(0)}% institutional minimum. ` +
      (student.classes_needed > 0
        ? `You must attend at least ${student.classes_needed} consecutive upcoming classes to recover eligibility.`
        : 'Please ensure regular attendance in all upcoming lecture sessions.')
    );
  };

  if (loading && !overviewData) {
    return (
      <div className="w-full min-h-[400px] flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-500">
          Analyzing attendance records &amp; computing trends...
        </p>
      </div>
    );
  }

  const metadata = overviewData?.metadata || {};
  const cards = overviewData?.cards || [];
  const subjectTrends = overviewData?.subject_trends || {};
  const dayPatterns = overviewData?.day_patterns || {};
  const shortageSummary = overviewData?.shortage_summary || {};
  const interventions = overviewData?.interventions || [];

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. TOP HEADER & EXPLAINABILITY BAR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200/90">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-900 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/90 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
              <span>Attendance Intelligence Engine</span>
            </span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs text-slate-500 font-medium">
              Statutory Quorum Monitoring
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#111827] tracking-tight">
            AI Attendance Insights
          </h1>
          <p className="text-xs text-slate-500 font-medium max-w-2xl">
            Automated attendance shortage risk detection, weekly momentum trajectory, weekday distribution analysis, and actionable interventions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowFormulaModal(true)}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            title="Explain mathematical formulas"
          >
            <HelpCircle className="w-3.5 h-3.5 text-emerald-800" />
            <span>How It Works</span>
          </button>
          <button
            type="button"
            onClick={fetchInsights}
            disabled={refreshing}
            className="px-3.5 py-2 rounded-xl bg-[#1A4731] hover:bg-[#143826] active:scale-95 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Analytics</span>
          </button>
        </div>
      </div>

      {/* 2. COMPREHENSIVE FILTER TOOLBAR */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs font-bold text-slate-700">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#1A4731]" />
            <span>Interactive Filters &amp; Threshold Governance</span>
          </div>
          <div className="text-[11px] font-semibold text-slate-400">
            {metadata.total_sessions_analyzed || 0} sessions &bull; {metadata.total_records_analyzed || 0} student records evaluated
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Section Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Section
            </label>
            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-700 text-slate-800"
            >
              {(filterOptions?.sections || ['ALL', 'A', 'B']).map(sec => (
                <option key={sec} value={sec}>{sec === 'ALL' ? 'All Sections' : `Section ${sec}`}</option>
              ))}
            </select>
          </div>

          {/* Subject Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Subject
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-700 text-slate-800 truncate"
            >
              {(filterOptions?.subjects || [{ code: 'ALL', name: 'All Subjects' }]).map(sub => (
                <option key={sub.code} value={sub.code}>
                  {sub.code === 'ALL' ? 'All Subjects' : `${sub.code} - ${sub.name}`}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Date Window
            </label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-700 text-slate-800"
            >
              {(filterOptions?.date_ranges || [
                { id: '7d', label: 'Last 7 Days' },
                { id: '14d', label: 'Last 14 Days' },
                { id: '30d', label: 'Last 30 Days' },
                { id: '90d', label: 'Last 90 Days' },
                { id: 'all', label: 'Full Semester' }
              ]).map(dr => (
                <option key={dr.id} value={dr.id}>{dr.label}</option>
              ))}
            </select>
          </div>

          {/* Semester Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Semester
            </label>
            <select
              value={semester}
              onChange={(e) => setSemester(parseInt(e.target.value, 10))}
              className="w-full text-xs font-semibold px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-700 text-slate-800"
            >
              {(filterOptions?.semesters || [0, 4, 6]).map(sem => (
                <option key={sem} value={sem}>{sem === 0 ? 'All Semesters' : `Semester ${sem}`}</option>
              ))}
            </select>
          </div>

          {/* Configurable Threshold Governance */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
              <span>Required Min %</span>
              <span className="text-emerald-800 font-extrabold">{threshold}%</span>
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="50"
                max="95"
                step="1"
                value={customThresholdInput}
                onChange={(e) => setCustomThresholdInput(e.target.value)}
                onBlur={() => handleThresholdApply(customThresholdInput)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleThresholdApply(customThresholdInput); }}
                className="w-full text-xs font-bold px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-700 text-slate-800"
                placeholder="75"
              />
              <button
                type="button"
                onClick={() => handleThresholdApply(customThresholdInput)}
                className="px-2.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition"
                title="Apply threshold"
              >
                Set
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. SIX CORE INSIGHT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {cards.map((c) => {
          const isCritical = c.status === 'CRITICAL';
          const isWarning = c.status === 'WARNING';
          const isSuccess = c.status === 'SUCCESS';
          const isSelected = activeTabCard === c.id;

          return (
            <div
              key={c.id}
              onClick={() => handleCardClick(c.id)}
              className={`bg-white rounded-2xl p-4 border transition-all cursor-pointer relative overflow-hidden select-none shadow-xs hover:shadow-md ${
                isSelected
                  ? 'border-emerald-700 ring-2 ring-emerald-700/20'
                  : 'border-slate-200/90 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
                <span className="truncate">{c.title}</span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    isCritical ? 'bg-rose-500 animate-pulse' :
                    isWarning ? 'bg-amber-500' :
                    isSuccess ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                />
              </div>

              <div className="text-2xl font-black text-[#111827] tracking-tight">
                {c.value}
              </div>

              <p className={`text-[11px] font-bold mt-1 truncate ${
                isCritical ? 'text-rose-600' :
                isWarning ? 'text-amber-700' :
                isSuccess ? 'text-emerald-700' : 'text-slate-500'
              }`}>
                {c.subtitle}
              </p>

              <p className="text-[11px] text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                {c.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* 4. VISUALIZATION ROW: WEEKLY TRENDS & DAY-WISE PATTERNS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Columns: Weekly Trend Line & Subject Momentum */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-extrabold text-[#111827] flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-[#1A4731]" />
                <span>Subject Attendance Trajectory</span>
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Week-over-week attendance velocity with trend detection (&ge; 3% minimum meaningful shift)
              </p>
            </div>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full self-start">
              {subjectTrends.subjects_analyzed || 0} Subjects Monitored
            </span>
          </div>

          {/* Subject Cards with Deltas */}
          <div className="space-y-3">
            {(subjectTrends.subjects || []).length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No session records found within the selected filters.
              </div>
            ) : (
              (subjectTrends.subjects || []).map((sub) => {
                const isDeclining = sub.trend_status.includes('DECLINE') || sub.trend_status.includes('DROP');
                const isGrowing = sub.trend_status.includes('INCREASE') || sub.trend_status.includes('BOOST');

                return (
                  <div
                    key={sub.subject_name}
                    className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2 hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-700 shrink-0" />
                        <span className="text-xs font-bold text-[#111827] truncate">
                          {sub.subject_name}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="text-xs font-black text-[#111827]">
                            {sub.overall_pct.toFixed(1)}%
                          </span>
                          <span className="text-[11px] text-slate-400 block font-medium">
                            {sub.sessions_count} sessions
                          </span>
                        </div>

                        <span
                          className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            isDeclining
                              ? 'bg-rose-100 text-rose-800'
                              : isGrowing
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {isDeclining ? <ArrowDownRight className="w-3 h-3" /> : isGrowing ? <ArrowUpRight className="w-3 h-3" /> : null}
                          <span>{sub.delta_pct > 0 ? `+${sub.delta_pct}%` : `${sub.delta_pct}%`}</span>
                        </span>
                      </div>
                    </div>

                    {/* Progress Track vs Threshold */}
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden relative">
                      <div
                        className={`h-full transition-all duration-500 ${
                          sub.overall_pct < threshold ? 'bg-amber-500' : 'bg-emerald-600'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(5, sub.overall_pct))}%` }}
                      />
                    </div>

                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                      {sub.trend_explanation}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right 5 Columns: Day-Wise Distribution & Risk Donut */}
        <div className="lg:col-span-5 space-y-6">
          {/* Day-Wise Attendance Distribution */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-extrabold text-[#111827] flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#1A4731]" />
                  <span>Weekday Attendance Pattern</span>
                </h2>
                <p className="text-[11px] text-slate-500 font-medium">
                  Average student turnout for scheduled class days
                </p>
              </div>
            </div>

            {/* Weekday Visual Bars */}
            <div className="space-y-2.5">
              {(dayPatterns.days || []).length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No weekday attendance data recorded.
                </div>
              ) : (
                (dayPatterns.days || []).map((day) => {
                  const isLowest = dayPatterns.lowest_day && dayPatterns.lowest_day.day_name === day.day_name;
                  return (
                    <div key={day.day_name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700 flex items-center gap-1.5">
                          <span>{day.day_name}</span>
                          {isLowest && (
                            <span className="text-[10px] font-extrabold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                              Lowest
                            </span>
                          )}
                        </span>
                        <span className="font-extrabold text-[#111827]">
                          {day.average_attendance_pct.toFixed(1)}%
                          <span className="text-[11px] text-slate-400 font-medium ml-1">
                            ({day.sessions_conducted} classes)
                          </span>
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isLowest ? 'bg-amber-500' : 'bg-[#1A4731]'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(5, day.average_attendance_pct))}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Explainable Day Observation */}
            {dayPatterns.insight_text && (
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-[11px] text-emerald-900 leading-relaxed font-medium">
                {dayPatterns.insight_text}
              </div>
            )}
          </div>

          {/* Shortage Risk Distribution Tier Card */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Section Attendance Risk Breakdown
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {(shortageSummary.risk_distribution || []).map((item) => (
                <div
                  key={item.name}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-0.5"
                >
                  <span className="text-[11px] font-bold text-slate-500 block truncate">
                    {item.name}
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-black text-[#111827]">{item.count}</span>
                    <span className="text-[11px] text-slate-400 font-medium">students</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 5. DETAILED STUDENT ATTENDANCE & INTERVENTION ROSTER TABLE */}
      <div id="student-roster-section" className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Table Header & Controls */}
        <div className="p-4 sm:p-6 border-b border-slate-100 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-[#111827] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#1A4731]" />
                <span>Student Attendance &amp; Shortage Intelligence</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Consecutive classes needed, safe skips, and personalized intervention dispatch
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search roll no or student name..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full text-xs font-semibold pl-8 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-700 text-slate-800"
              />
            </div>
          </div>

          {/* Quick Risk Category Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {[
              { id: 'ALL', label: 'All Students' },
              { id: 'AT_RISK', label: 'At-Risk (< Threshold)' },
              { id: 'CRITICAL', label: 'Critical Deficit' },
              { id: 'WARNING', label: 'Warning Zone' },
              { id: 'BORDERLINE', label: 'Borderline' },
              { id: 'SAFE', label: 'Safe Standing' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedRiskFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  selectedRiskFilter === tab.id
                    ? 'bg-[#1A4731] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200/80 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-3">Attendance %</th>
                <th className="py-3 px-3">Classes</th>
                <th className="py-3 px-3">Classes Needed</th>
                <th className="py-3 px-3">Safe Cuts</th>
                <th className="py-3 px-3">Trajectory</th>
                <th className="py-3 px-3">Recommended Action</th>
                <th className="py-3 px-4 text-right">Intervention</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium">
              {displayedStudents.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-400">
                    No students found matching the selected filter criteria.
                  </td>
                </tr>
              ) : (
                displayedStudents.map((st) => {
                  const isCrit = st.risk_tier === 'CRITICAL';
                  const isWarn = st.risk_tier === 'WARNING';
                  const isBorder = st.risk_tier === 'BORDERLINE';

                  return (
                    <tr key={st.roll_no} className="hover:bg-slate-50/80 transition">
                      {/* Name & Roll No */}
                      <td className="py-3 px-4">
                        <div className="font-extrabold text-[#111827]">{st.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {st.roll_no} &bull; Sec {st.section}
                        </div>
                      </td>

                      {/* Attendance Percentage Badge */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md font-extrabold text-xs ${
                              isCrit
                                ? 'bg-rose-100 text-rose-800'
                                : isWarn
                                ? 'bg-amber-100 text-amber-800'
                                : isBorder
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {st.current_pct.toFixed(1)}%
                          </span>
                        </div>
                      </td>

                      {/* Attended / Conducted */}
                      <td className="py-3 px-3">
                        <span className="font-bold text-[#111827]">{st.attended_classes}</span>
                        <span className="text-slate-400 font-semibold"> / {st.conducted_classes}</span>
                      </td>

                      {/* Classes Needed */}
                      <td className="py-3 px-3">
                        {st.classes_needed === 0 ? (
                          <span className="text-slate-400 text-[11px] font-semibold">Eligible (0)</span>
                        ) : st.classes_needed === null ? (
                          <span className="text-rose-600 text-[11px] font-bold">Impossible</span>
                        ) : (
                          <span className="text-rose-600 font-extrabold">
                            +{st.classes_needed} classes
                          </span>
                        )}
                      </td>

                      {/* Safe Cuts */}
                      <td className="py-3 px-3">
                        {st.safe_cuts_available > 0 ? (
                          <span className="text-emerald-700 font-bold">
                            {st.safe_cuts_available} safe
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">0</span>
                        )}
                      </td>

                      {/* Trajectory */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                            st.recent_trend === 'IMPROVING'
                              ? 'text-emerald-700'
                              : st.recent_trend === 'DECLINING'
                              ? 'text-rose-600'
                              : 'text-slate-500'
                          }`}
                        >
                          {st.recent_trend === 'IMPROVING' && <ArrowUpRight className="w-3 h-3" />}
                          {st.recent_trend === 'DECLINING' && <ArrowDownRight className="w-3 h-3" />}
                          <span>{st.recent_trend}</span>
                        </span>
                      </td>

                      {/* Recommendation Summary */}
                      <td className="py-3 px-3 max-w-xs text-slate-600 text-[11px] line-clamp-2">
                        {st.recommendation}
                      </td>

                      {/* Action Dispatch Button */}
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openActionModal(st)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-[#1A4731] hover:text-white text-slate-700 font-bold text-xs transition cursor-pointer"
                        >
                          Take Action
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. INTERVENTION ACTION DISPATCH MODAL */}
      {selectedStudentForAction && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-[#111827] w-full max-w-md rounded-3xl p-6 border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-[#1A4731]" />
                <h3 className="text-base font-extrabold text-[#111827]">
                  Dispatch Attendance Intervention
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentForAction(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <div className="font-extrabold text-[#111827]">
                {selectedStudentForAction.name} ({selectedStudentForAction.roll_no})
              </div>
              <div className="text-slate-500 font-medium">
                Attendance: {selectedStudentForAction.current_pct.toFixed(1)}% &bull; Shortage Deficit: {selectedStudentForAction.classes_needed || 0} classes required
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Alert Severity
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['INFO', 'WARNING', 'CRITICAL'].map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setActionSeverity(sev)}
                      className={`py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                        actionSeverity === sev
                          ? sev === 'CRITICAL'
                            ? 'bg-rose-600 text-white border-rose-600'
                            : sev === 'WARNING'
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Notice Title
                </label>
                <input
                  type="text"
                  value={actionTitle}
                  onChange={(e) => setActionTitle(e.target.value)}
                  className="w-full text-xs font-bold px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Message Body
                </label>
                <textarea
                  rows="4"
                  value={actionMessage}
                  onChange={(e) => setActionMessage(e.target.value)}
                  className="w-full text-xs font-medium px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedStudentForAction(null)}
                className="w-full py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendIntervention}
                disabled={sendingAction}
                className="w-full py-2.5 rounded-xl bg-[#1A4731] hover:bg-[#143826] text-white font-bold text-xs transition shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {sendingAction ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Send Notice</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MATHEMATICAL EXPLAINABILITY & TRANSPARENCY MODAL */}
      {showFormulaModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-[#111827] w-full max-w-lg rounded-3xl p-6 border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-[#1A4731]" />
                <h3 className="text-base font-extrabold text-[#111827]">
                  Attendance Intelligence Mathematical Formulas
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFormulaModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="font-extrabold text-[#111827]">1. Classes Needed to Reach Threshold T:</div>
                <p className="font-mono text-[11px] bg-white p-2 rounded-lg border border-slate-200 text-emerald-900 font-bold">
                  x = ceil((T &times; Conducted - Attended) / (1 - T))
                </p>
                <p className="text-[11px] text-slate-500">
                  Calculates the exact minimum consecutive future classes a student must attend without skipping to raise their attendance back above threshold T.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="font-extrabold text-[#111827]">2. Safe Skips Permitted:</div>
                <p className="font-mono text-[11px] bg-white p-2 rounded-lg border border-slate-200 text-emerald-900 font-bold">
                  y = floor(Attended / T - Conducted)
                </p>
                <p className="text-[11px] text-slate-500">
                  Calculates the maximum lectures a student in good standing can miss while still satisfying statutory attendance compliance.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="font-extrabold text-[#111827]">3. Meaningful Decline vs. Random Noise:</div>
                <p className="text-[11px] text-slate-500">
                  Random single-lecture variations are not flagged. A subject or student is only marked as declining if there is a minimum &ge; 3.0 percentage-point drop across at least 2 distinct weeks with recurring lecture sessions.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowFormulaModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#1A4731] hover:bg-[#143826] text-white font-bold text-xs transition cursor-pointer"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
