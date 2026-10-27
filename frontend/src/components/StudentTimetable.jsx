import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Clock, MapPin, User, BookOpen, Sparkles, CheckCircle2,
  AlertTriangle, RefreshCw, Layers, CalendarDays, ArrowRight,
  ShieldCheck, QrCode, CalendarX, Info, ExternalLink, ChevronRight,
  GraduationCap, Building2, Check
} from 'lucide-react';
import { api } from '../api';
import SmartAttendLoader from './ui/SmartAttendLoader';

const ORDERED_DAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY'
];

const DAY_LABELS = {
  MONDAY: 'Mon',
  TUESDAY: 'Tue',
  WEDNESDAY: 'Wed',
  THURSDAY: 'Thu',
  FRIDAY: 'Fri',
  SATURDAY: 'Sat',
  SUNDAY: 'Sun'
};

export default function StudentTimetable({ user, onOpenScanner, recentLogs = [] }) {
  const [timetable, setTimetable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'daily'
  const [selectedDay, setSelectedDay] = useState(() => {
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    return days[new Date().getDay()];
  });
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // Compute live current day and current time
  const currentDay = useMemo(() => {
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    return days[new Date().getDay()];
  }, []);

  const [currentTimeStr, setCurrentTimeStr] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });

  // Keep live time updated every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTimeStr(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Fetch student personalized timetable from backend
  const fetchTimetable = async () => {
    setLoading(true);
    setError(null);
    try {
      // Calls GET /api/timetable/my which backend restricts strictly to student's department, semester, section
      const res = await api.getMyTimetable();
      const entries = res.timetable || [];
      // Guarantee published entries only (enforced backend & frontend)
      const publishedOnly = entries.filter(e => e.is_published !== false);
      setTimetable(publishedOnly);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to fetch student timetable:', err);
      setError(err.message || 'Failed to load official student timetable from backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimetable();
  }, []);

  // Organize slots by day
  const slotsByDay = useMemo(() => {
    const map = {};
    ORDERED_DAYS.forEach(d => { map[d] = []; });
    timetable.forEach(entry => {
      const day = (entry.day_of_week || '').toUpperCase();
      if (map[day]) {
        map[day].push(entry);
      }
    });
    // Sort each day chronologically by start_time
    ORDERED_DAYS.forEach(d => {
      map[d].sort((a, b) => a.start_time.localeCompare(b.start_time));
    });
    return map;
  }, [timetable]);

  // Today's classes
  const todayClasses = useMemo(() => {
    return slotsByDay[currentDay] || [];
  }, [slotsByDay, currentDay]);

  // Check if a slot was already attended today via recent verification logs
  const isSlotAttendedToday = (slot) => {
    if (!recentLogs || recentLogs.length === 0) return false;
    const slotCode = (slot.subject_code || '').toUpperCase();
    const slotName = (slot.subject_name || '').toUpperCase();

    return recentLogs.some(log => {
      if (log.status !== 'PRESENT' && log.status !== 'MANUAL_PRESENT') return false;
      const logSession = (log.session_id || '').toUpperCase();
      // Match session ID containing subject code or name
      const matchesCode = slotCode && logSession.includes(slotCode);
      const matchesName = slotName && logSession.includes(slotName);
      return matchesCode || matchesName;
    });
  };

  // Determine slot status helper
  const getSlotStatus = (slot) => {
    if (slot.day_of_week !== currentDay) {
      return { status: 'SCHEDULED', label: 'SCHEDULED', badgeColor: 'bg-slate-800 text-slate-400 border-slate-700' };
    }
    if (slot.start_time <= currentTimeStr && currentTimeStr <= slot.end_time) {
      return { status: 'LIVE', label: 'LIVE NOW', badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse' };
    }
    if (currentTimeStr < slot.start_time) {
      return { status: 'UPCOMING', label: 'UPCOMING TODAY', badgeColor: 'bg-brand-500/20 text-brand-300 border-brand-500/40' };
    }
    return { status: 'COMPLETED', label: 'COMPLETED', badgeColor: 'bg-slate-800 text-slate-500 border-slate-700' };
  };

  // Next scheduled lecture calculation
  const nextScheduledLecture = useMemo(() => {
    // 1. Check today first: active or upcoming slot
    const activeOrUpcomingToday = todayClasses.find(s => s.end_time >= currentTimeStr);
    if (activeOrUpcomingToday) {
      return {
        slot: activeOrUpcomingToday,
        isToday: true,
        isLiveNow: (activeOrUpcomingToday.start_time <= currentTimeStr && currentTimeStr <= activeOrUpcomingToday.end_time)
      };
    }

    // 2. If no more lectures today, search subsequent days of the week in cyclic order
    const currentIdx = ORDERED_DAYS.indexOf(currentDay);
    for (let i = 1; i < ORDERED_DAYS.length; i++) {
      const nextDay = ORDERED_DAYS[(currentIdx + i) % ORDERED_DAYS.length];
      const classesOnDay = slotsByDay[nextDay] || [];
      if (classesOnDay.length > 0) {
        return {
          slot: classesOnDay[0],
          isToday: false,
          isLiveNow: false,
          targetDay: nextDay
        };
      }
    }

    return null;
  }, [todayClasses, slotsByDay, currentDay, currentTimeStr]);

  const studentDept = user.department || 'Computer Science & Engineering';
  const studentSem = user.semester || 6;
  const studentSec = user.section || 'A';

  return (
    <div className="space-y-6">

      {/* Top Header & View Switcher */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EBF4EE] text-[#1A4731] border border-emerald-200 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#1A4731]" />
              STUDENT TIMETABLE
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              Official Class Schedule (Published Only)
            </span>
            {lastRefreshed && (
              <span className="text-[11px] text-slate-500">
                Synced at {lastRefreshed}
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#111827] mt-1.5 flex items-center gap-2">
            My Timetable &amp; Lecture Schedule
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cohort: <span className="font-semibold text-slate-700">{studentDept}</span> &bull; Semester <span className="font-semibold text-slate-700">{studentSem}</span> &bull; Section <span className="font-semibold text-[#1A4731] font-mono">{studentSec}</span>
          </p>
        </div>

        {/* View Mode Toggle + Refresh Button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-[#1A4731] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Weekly Matrix Grid"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Weekly Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('daily')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'daily'
                  ? 'bg-[#1A4731] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Day-by-Day Schedule"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Daily View</span>
            </button>
          </div>

          <button
            type="button"
            onClick={fetchTimetable}
            disabled={loading}
            className="p-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition flex items-center gap-1.5 text-xs font-semibold disabled:opacity-50 cursor-pointer shadow-2xs"
            title="Refresh Timetable from Server"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#1A4731]' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && timetable.length === 0 && (
        <SmartAttendLoader
          variant="card"
          portalName="Student Portal"
          subtitle={`Retrieving authenticated timetable for ${studentDept} Sem ${studentSem}...`}
          size="sm"
        />
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-rose-50 rounded-2xl p-6 border border-rose-200 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-rose-800">Unable to Load Timetable</h3>
              <p className="text-xs text-rose-700 mt-1">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchTimetable}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* Empty State: No published timetable slots found */}
      {!loading && !error && timetable.length === 0 && (
        <div className="bg-white rounded-2xl p-12 border border-slate-200 shadow-xs text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-slate-100 border border-slate-200 text-slate-400">
            <CalendarX className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-lg font-bold text-[#111827]">No Official Timetable Published Yet</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              No official timetable slots have been published for <strong className="text-slate-700">{studentDept}</strong>, Semester <strong className="text-slate-700">{studentSem}</strong>, Section <strong className="text-slate-700">{studentSec}</strong>. Please contact your academic advisor or department timetable administrator.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchTimetable}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold inline-flex items-center gap-2 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Check for Updates</span>
          </button>
        </div>
      )}

      {/* Main Content when timetable exists */}
      {!loading && !error && timetable.length > 0 && (
        <>
          {/* Spotlight Hero Card: Today's Classes & Next Lecture */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Next Scheduled Lecture Banner (2 cols on large) */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#1A4731]">
                      {nextScheduledLecture?.isLiveNow
                        ? 'Lecture Currently in Session'
                        : nextScheduledLecture?.isToday
                        ? 'Next Lecture Today'
                        : nextScheduledLecture
                        ? `Upcoming on ${nextScheduledLecture.targetDay}`
                        : 'No Upcoming Lectures'}
                    </span>
                  </div>

                  {nextScheduledLecture?.isLiveNow && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase bg-emerald-50 text-emerald-800 border border-emerald-300 animate-pulse">
                      ● Active Slot
                    </span>
                  )}
                </div>

                {nextScheduledLecture ? (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold font-mono bg-[#EBF4EE] text-[#1A4731] border border-emerald-200">
                          {nextScheduledLecture.slot.subject_code}
                        </span>
                        <h2 className="text-lg sm:text-xl font-black text-[#111827] mt-1">
                          {nextScheduledLecture.slot.subject_name}
                        </h2>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-base sm:text-lg font-black font-mono text-[#1A4731] flex items-center justify-end gap-1.5">
                          <Clock className="w-4 h-4 text-[#1A4731]" />
                          <span>{nextScheduledLecture.slot.start_time} - {nextScheduledLecture.slot.end_time}</span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {nextScheduledLecture.isToday ? 'Today' : nextScheduledLecture.targetDay}
                        </span>
                      </div>
                    </div>

                    {/* Metadata chips */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700 pt-1">
                      <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                        <User className="w-3.5 h-3.5 text-[#1A4731]" />
                        <span>Prof. <strong className="text-[#111827]">{nextScheduledLecture.slot.faculty_name}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                        <MapPin className="w-3.5 h-3.5 text-rose-500" />
                        <span>Room <strong className="text-[#111827] font-mono">{nextScheduledLecture.slot.room_no}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                        <GraduationCap className="w-3.5 h-3.5 text-[#1A4731]" />
                        <span>Sec <strong className="text-[#111827] font-mono">{nextScheduledLecture.slot.section}</strong></span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 mt-4">
                    All scheduled lectures for this week are completed. Check back on Monday!
                  </p>
                )}
              </div>

              {/* Action row */}
              {nextScheduledLecture && (
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-[#1A4731]" />
                    <span>5-Gate Anti-Proxy verification required to mark attendance</span>
                  </div>

                  {isSlotAttendedToday(nextScheduledLecture.slot) ? (
                    <div className="px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Attendance Verified (Present)</span>
                    </div>
                  ) : nextScheduledLecture.isLiveNow ? (
                    <button
                      type="button"
                      onClick={() => onOpenScanner && onOpenScanner(nextScheduledLecture.slot)}
                      className="px-5 py-2.5 rounded-xl bg-[#1A4731] hover:bg-[#143826] text-white text-xs font-bold transition shadow-xs flex items-center gap-2 active:scale-95 cursor-pointer animate-pulse"
                    >
                      <QrCode className="w-4 h-4" />
                      <span>Check In / Scan Classroom QR</span>
                    </button>
                  ) : nextScheduledLecture.isToday ? (
                    <button
                      type="button"
                      onClick={() => onOpenScanner && onOpenScanner(nextScheduledLecture.slot)}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition flex items-center gap-2 cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5 text-[#1A4731]" />
                      <span>Launch Scanner</span>
                    </button>
                  ) : null}
                </div>
              )}
            </div>

            {/* Quick Cohort & Weekly Stats Card (1 col) */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#1A4731]" />
                  <h3 className="text-xs font-bold text-[#111827] uppercase tracking-wider">
                    My Schedule Overview
                  </h3>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Today's Classes</span>
                    <span className="text-2xl font-black text-[#111827] mt-0.5 block">{todayClasses.length}</span>
                    <span className="text-[11px] text-slate-400">{currentDay}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Weekly Total</span>
                    <span className="text-2xl font-black text-emerald-700 mt-0.5 block">{timetable.length}</span>
                    <span className="text-[11px] text-slate-400">Lectures / Wk</span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-500">Department:</span>
                  <span className="font-semibold text-slate-800 truncate max-w-[150px]">{studentDept}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-500">Class &amp; Section:</span>
                  <span className="font-semibold font-mono text-[#1A4731]">Sem {studentSem} - Sec {studentSec}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-500">Published Status:</span>
                  <span className="font-bold text-emerald-700 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 text-emerald-600" /> Live &amp; Active
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* VIEW MODE 1: WEEKLY MATRIX GRID */}
          {viewMode === 'grid' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-[#1A4731]" />
                  <h3 className="text-sm font-bold text-[#111827] uppercase tracking-wider">
                    Official Weekly Timetable Matrix
                  </h3>
                </div>
                <span className="text-xs text-slate-500">
                  Today is <strong className="text-[#1A4731]">{currentDay}</strong> ({currentTimeStr} Local)
                </span>
              </div>

              {/* Weekly Columns Container */}
              <div className="overflow-x-auto pb-2">
                <div className="grid grid-cols-7 gap-3 min-w-[950px]">
                  {ORDERED_DAYS.map((day) => {
                    const isToday = (day === currentDay);
                    const daySlots = slotsByDay[day] || [];

                    return (
                      <div
                        key={day}
                        className={`rounded-2xl border transition-all flex flex-col ${
                          isToday
                            ? 'bg-white border-2 border-[#1A4731] shadow-md'
                            : 'bg-white border border-slate-200 shadow-xs hover:border-slate-300'
                        }`}
                      >
                        {/* Day Header */}
                        <div className={`p-3 border-b flex items-center justify-between ${
                          isToday
                            ? 'border-emerald-100 bg-[#EBF4EE]'
                            : 'border-slate-100 bg-slate-50/80'
                        }`}>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className={`text-xs font-black uppercase tracking-wider ${
                                isToday ? 'text-[#1A4731]' : 'text-[#111827]'
                              }`}>
                                {DAY_LABELS[day]}
                              </span>
                              {isToday && (
                                <span className="px-1.5 py-0.2 rounded text-[11px] font-black bg-[#1A4731] text-white uppercase">
                                  Today
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500 font-medium">
                              {day.charAt(0) + day.slice(1).toLowerCase()}
                            </span>
                          </div>

                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                            daySlots.length > 0
                              ? isToday
                                ? 'bg-white text-[#1A4731] border border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                              : 'bg-slate-50 text-slate-400'
                          }`}>
                            {daySlots.length}
                          </span>
                        </div>

                        {/* Day Schedule Slots */}
                        <div className="p-2.5 space-y-2.5 flex-1 min-h-[320px]">
                          {daySlots.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400 space-y-1">
                              <Calendar className="w-5 h-5 opacity-40" />
                              <span className="text-[11px] font-medium">No Lectures</span>
                            </div>
                          ) : (
                            daySlots.map((slot) => {
                              const status = getSlotStatus(slot);
                              const attended = isSlotAttendedToday(slot);

                              return (
                                <div
                                  key={slot.id}
                                  className={`p-3 rounded-xl border transition-all text-left space-y-2 relative overflow-hidden ${
                                    status.status === 'LIVE'
                                      ? 'bg-emerald-50/70 border-emerald-300 shadow-2xs'
                                      : isToday
                                      ? 'bg-slate-50 border-slate-200 hover:border-slate-300'
                                      : 'bg-white border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  {/* Slot Status Tag */}
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-[11px] font-mono font-bold text-[#1A4731] flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-[#1A4731]" />
                                      {slot.start_time} - {slot.end_time}
                                    </span>

                                    {status.status === 'LIVE' ? (
                                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 animate-pulse">
                                        LIVE
                                      </span>
                                    ) : attended ? (
                                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-0.5">
                                        <Check className="w-2.5 h-2.5" /> Present
                                      </span>
                                    ) : null}
                                  </div>

                                  {/* Subject Code & Name */}
                                  <div>
                                    <span className="px-1.5 py-0.5 rounded text-[11px] font-bold font-mono bg-[#EBF4EE] text-[#1A4731] border border-emerald-200">
                                      {slot.subject_code}
                                    </span>
                                    <h4 className="text-xs font-bold text-[#111827] mt-1 leading-snug line-clamp-2">
                                      {slot.subject_name}
                                    </h4>
                                  </div>

                                  {/* Faculty & Room details */}
                                  <div className="space-y-1 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                                    <div className="flex items-center gap-1 truncate text-slate-700">
                                      <User className="w-3 h-3 text-[#1A4731] shrink-0" />
                                      <span className="truncate">{slot.faculty_name}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px]">
                                      <span className="flex items-center gap-1 text-slate-600">
                                        <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                                        <strong className="text-slate-800 font-mono">{slot.room_no}</strong>
                                      </span>
                                      <span className="text-slate-400 font-mono">Sec {slot.section}</span>
                                    </div>
                                  </div>

                                  {/* Action button if slot is live today and not attended */}
                                  {isToday && status.status === 'LIVE' && !attended && (
                                    <button
                                      type="button"
                                      onClick={() => onOpenScanner && onOpenScanner(slot)}
                                      className="w-full mt-1 py-1.5 px-2 rounded-xl bg-[#1A4731] hover:bg-[#143826] text-white text-[11px] font-bold flex items-center justify-center gap-1 shadow-xs transition active:scale-95 cursor-pointer"
                                    >
                                      <QrCode className="w-3 h-3" />
                                      <span>Check In</span>
                                    </button>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* VIEW MODE 2: DAILY SCHEDULE VIEW */}
          {viewMode === 'daily' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">

              {/* Day Selection Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {ORDERED_DAYS.map((day) => {
                  const isSelected = (day === selectedDay);
                  const isToday = (day === currentDay);
                  const count = (slotsByDay[day] || []).length;

                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setSelectedDay(day)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 border cursor-pointer ${
                        isSelected
                          ? 'bg-[#1A4731] text-white border-[#1A4731] shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>{day.charAt(0) + day.slice(1).toLowerCase()}</span>
                      {isToday && (
                        <span className="px-1.5 py-0.2 rounded text-[11px] bg-emerald-500 text-white font-black uppercase">
                          Today
                        </span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Day Header Info */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[#111827]">
                    {selectedDay.charAt(0) + selectedDay.slice(1).toLowerCase()} Lectures
                  </h3>
                  {selectedDay === currentDay && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#EBF4EE] text-[#1A4731] border border-emerald-200">
                      Today's Classes
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-500">
                  Total: <strong className="text-[#111827] font-mono">{(slotsByDay[selectedDay] || []).length}</strong> Scheduled Lectures
                </span>
              </div>

              {/* Timeline of lectures for selected day */}
              {(slotsByDay[selectedDay] || []).length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-[#111827]">No Lectures Scheduled</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    There are no published lecture slots assigned to your class on {selectedDay.charAt(0) + selectedDay.slice(1).toLowerCase()}.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(slotsByDay[selectedDay] || []).map((slot, index) => {
                    const status = getSlotStatus(slot);
                    const attended = isSlotAttendedToday(slot);

                    return (
                      <div
                        key={slot.id}
                        className={`p-5 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                          status.status === 'LIVE'
                            ? 'bg-emerald-50/60 border-emerald-300 shadow-2xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {/* Time & Sequence */}
                        <div className="flex items-start md:items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-mono font-bold text-sm shrink-0">
                            #{index + 1}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base font-mono font-black text-[#111827] flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-[#1A4731]" />
                                {slot.start_time} - {slot.end_time}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${status.badgeColor}`}>
                                {status.label}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 mt-1">
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold font-mono bg-[#EBF4EE] text-[#1A4731] border border-emerald-200">
                                {slot.subject_code}
                              </span>
                              <h4 className="text-sm sm:text-base font-bold text-[#111827]">
                                {slot.subject_name}
                              </h4>
                            </div>
                          </div>
                        </div>

                        {/* Faculty, Room, & Action */}
                        <div className="flex flex-wrap items-center gap-3 justify-between md:justify-end pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                          <div className="text-xs text-slate-600 flex items-center gap-3">
                            <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                              <User className="w-3.5 h-3.5 text-[#1A4731]" />
                              Prof. <strong className="text-[#111827]">{slot.faculty_name}</strong>
                            </span>
                            <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                              <MapPin className="w-3.5 h-3.5 text-rose-500" />
                              <strong className="text-slate-800 font-mono">{slot.room_no}</strong>
                            </span>
                          </div>

                          {/* Attendance Status / Action */}
                          {attended ? (
                            <div className="px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Attended Today</span>
                            </div>
                          ) : selectedDay === currentDay && status.status === 'LIVE' ? (
                            <button
                              type="button"
                              onClick={() => onOpenScanner && onOpenScanner(slot)}
                              className="px-4 py-2 rounded-xl bg-[#1A4731] hover:bg-[#143826] text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              <span>Check In &amp; Scan QR</span>
                            </button>
                          ) : selectedDay === currentDay && status.status === 'UPCOMING' ? (
                            <button
                              type="button"
                              onClick={() => onOpenScanner && onOpenScanner(slot)}
                              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                            >
                              <QrCode className="w-3.5 h-3.5 text-[#1A4731]" />
                              <span>Open Scanner</span>
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}
        </>
      )}

    </div>
  );
}
