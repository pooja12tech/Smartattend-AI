import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Clock, MapPin, Users, BookOpen, Sparkles, Play,
  CheckCircle2, AlertTriangle, RefreshCw, Layers, CalendarDays,
  ArrowRight, Radio, ShieldCheck, ChevronRight, Check, Building2,
  CalendarX, Info, ExternalLink
} from 'lucide-react';
import { api } from '../api';

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

export default function FacultyTimetable({ user, activeSession, onStartAttendance, onSwitchToLive }) {
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

  // Keep time updated every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTimeStr(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Fetch timetable data from existing backend API
  const fetchTimetable = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch official published personal timetable
      const res = await api.getMyTimetable();
      const entries = res.timetable || [];
      // Published entries only (double-enforce)
      const publishedOnly = entries.filter(e => e.is_published !== false);
      setTimetable(publishedOnly);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to fetch faculty timetable:', err);
      setError(err.message || 'Failed to load official timetable from backend.');
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
    // Sort each day chronologically
    ORDERED_DAYS.forEach(d => {
      map[d].sort((a, b) => a.start_time.localeCompare(b.start_time));
    });
    return map;
  }, [timetable]);

  // Today's classes
  const todayClasses = useMemo(() => {
    return slotsByDay[currentDay] || [];
  }, [slotsByDay, currentDay]);

  // Determine slot status helper
  const getSlotStatus = (slot) => {
    if (slot.day_of_week !== currentDay) {
      return { status: 'SCHEDULED', label: 'Scheduled', badgeColor: 'bg-slate-800 text-slate-400 border-slate-700' };
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
    // Check today first: active or upcoming slot
    const activeOrUpcomingToday = todayClasses.find(s => s.end_time >= currentTimeStr);
    if (activeOrUpcomingToday) {
      return {
        slot: activeOrUpcomingToday,
        isToday: true,
        isLiveNow: (activeOrUpcomingToday.start_time <= currentTimeStr && currentTimeStr <= activeOrUpcomingToday.end_time)
      };
    }

    // If no more lectures today, search subsequent days of the week in cyclic order
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

  // Check if a slot matches the currently active session
  const isSlotSessionActive = (slot) => {
    if (!activeSession) return false;
    const sessionSubj = (activeSession.subject_name || '').toLowerCase();
    const slotCode = (slot.subject_code || '').toLowerCase();
    const slotName = (slot.subject_name || '').toLowerCase();
    return sessionSubj.includes(slotCode) || sessionSubj.includes(slotName);
  };

  return (
    <div className="space-y-6">

      {/* Top Header & View Switcher */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-brand-400" />
              FACULTY TIMETABLE
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              Official & Published (Read-Only)
            </span>
            {lastRefreshed && (
              <span className="text-[11px] text-slate-500">
                Synced at {lastRefreshed}
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white mt-1.5 flex items-center gap-2">
            My Teaching Schedule & Weekly Grid
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Faculty ID: <span className="font-mono text-slate-300 font-semibold">{user.faculty_id || user.roll_no}</span> &bull; {user.name} &bull; {user.department || 'Computer Science & Engineering'}
          </p>
        </div>

        {/* View Mode Toggle + Refresh Button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === 'grid'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Weekly Matrix Grid"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Weekly Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('daily')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === 'daily'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                  : 'text-slate-400 hover:text-white'
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
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 transition flex items-center gap-1.5 text-xs font-semibold disabled:opacity-50"
            title="Refresh Timetable from Server"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-400' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && timetable.length === 0 && (
        <div className="glass-panel rounded-2xl p-12 border border-slate-800 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 animate-spin">
            <RefreshCw className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">Loading Your Official Timetable...</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Retrieving authenticated faculty timetable and real-time class schedule from the server.
          </p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="glass-panel rounded-2xl p-6 border border-rose-500/40 bg-rose-500/10 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-rose-200">Unable to Load Timetable</h3>
              <p className="text-xs text-rose-300/80 mt-1">{error}</p>
            </div>
            <button
              onClick={fetchTimetable}
              className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area (When loaded) */}
      {!loading && !error && (
        <>
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Metric 1: Total Weekly Lectures */}
            <div className="glass-panel rounded-xl p-4 border border-slate-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Weekly Lectures</p>
                <p className="text-xl font-bold text-white mt-0.5">{timetable.length} <span className="text-xs font-normal text-slate-500">Slots</span></p>
              </div>
            </div>

            {/* Metric 2: Today's Classes */}
            <div className="glass-panel rounded-xl p-4 border border-slate-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Today's Classes ({DAY_LABELS[currentDay] || currentDay})</p>
                <p className="text-xl font-bold text-emerald-300 mt-0.5">{todayClasses.length} <span className="text-xs font-normal text-slate-500">Lectures</span></p>
              </div>
            </div>

            {/* Metric 3: Active / Upcoming Lecture */}
            <div className="glass-panel rounded-xl p-4 border border-slate-800 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                nextScheduledLecture?.isLiveNow
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 animate-pulse'
                  : 'bg-brand-500/15 border border-brand-500/30 text-brand-400'
              }`}>
                <Clock className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
                  {nextScheduledLecture?.isLiveNow ? 'Current Live Lecture' : 'Next Lecture'}
                </p>
                <p className="text-sm font-bold text-white truncate mt-0.5">
                  {nextScheduledLecture ? (
                    `${nextScheduledLecture.slot.subject_code} (${nextScheduledLecture.slot.start_time})`
                  ) : (
                    'None Scheduled'
                  )}
                </p>
              </div>
            </div>

            {/* Metric 4: System Status */}
            <div className="glass-panel rounded-xl p-4 border border-slate-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Schedule Authority</p>
                <p className="text-xs font-bold text-purple-300 mt-0.5">Academic Deanery</p>
                <p className="text-[10px] text-slate-500">Curated & Synchronized</p>
              </div>
            </div>

          </div>

          {/* SPOTLIGHT HERO: Today's Schedule & Next Scheduled Lecture Banner */}
          {nextScheduledLecture ? (
            <div className={`glass-panel rounded-2xl p-5 sm:p-6 border transition-all ${
              nextScheduledLecture.isLiveNow
                ? 'border-emerald-500/40 bg-gradient-to-r from-emerald-950/30 via-slate-900 to-slate-900 shadow-xl shadow-emerald-500/10'
                : 'border-brand-500/30 bg-gradient-to-r from-brand-950/20 via-slate-900 to-slate-900 shadow-xl shadow-brand-500/10'
            }`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {nextScheduledLecture.isLiveNow ? (
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500 text-slate-950 flex items-center gap-1.5 shadow-md shadow-emerald-500/30 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping"></span>
                        HAPPENING NOW
                      </span>
                    ) : nextScheduledLecture.isToday ? (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-brand-500/20 text-brand-300 border border-brand-500/40 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        TODAY'S UPCOMING LECTURE
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        NEXT UP: {nextScheduledLecture.targetDay}
                      </span>
                    )}

                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                      {nextScheduledLecture.slot.start_time} - {nextScheduledLecture.slot.end_time}
                    </span>

                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-medium bg-slate-800/80 text-slate-400 border border-slate-700/80 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-rose-400" />
                      {nextScheduledLecture.slot.room_no}
                    </span>
                  </div>

                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                      <span className="text-brand-400 font-mono">{nextScheduledLecture.slot.subject_code}</span>
                      <span>&bull;</span>
                      <span>{nextScheduledLecture.slot.subject_name}</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3 h-3 text-indigo-400" />
                        {nextScheduledLecture.slot.department} &bull; Semester {nextScheduledLecture.slot.semester} &bull; Section {nextScheduledLecture.slot.section}
                      </span>
                      <span>&bull;</span>
                      <span>Academic Year: {nextScheduledLecture.slot.academic_year || '2025-2026'}</span>
                    </p>
                  </div>
                </div>

                {/* Action Button: Start Attendance Integration */}
                <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                  {isSlotSessionActive(nextScheduledLecture.slot) ? (
                    <button
                      type="button"
                      onClick={onSwitchToLive}
                      className="px-4 py-2.5 rounded-xl font-bold text-xs text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 flex items-center gap-2 transition shadow-lg shadow-emerald-500/10"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                      <span>Session Live (Go to Console)</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onStartAttendance(nextScheduledLecture.slot)}
                      className={`px-5 py-2.5 rounded-xl font-bold text-xs text-white shadow-lg flex items-center gap-2 transition active:scale-95 ${
                        nextScheduledLecture.isLiveNow
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-500/30'
                          : 'bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 shadow-brand-500/25'
                      }`}
                      title={`Launch attendance session for ${nextScheduledLecture.slot.subject_code}`}
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>Start Attendance</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : todayClasses.length === 0 && (
            <div className="glass-panel rounded-2xl p-5 border border-slate-800 bg-slate-900/60 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                <Info className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-slate-300">No Teaching Sessions Scheduled Today ({currentDay})</p>
                <p className="text-[11px] text-slate-500">You have no official classes scheduled for today. Review the weekly grid below for your upcoming slots.</p>
              </div>
            </div>
          )}

          {/* EMPTY SCHEDULE STATE */}
          {timetable.length === 0 ? (
            <div className="glass-panel rounded-2xl p-12 border border-slate-800 text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700 text-slate-400">
                <CalendarX className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-white">No Published Timetable Entries</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                There are currently no published timetable lecture slots assigned to your faculty ID (<span className="font-mono text-slate-300">{user.faculty_id || user.roll_no}</span>).
                Official class timetables are scheduled and published by university academic administration.
              </p>
              <div className="pt-2">
                <button
                  onClick={fetchTimetable}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition inline-flex items-center gap-2 border border-slate-700"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Re-check Server
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* VIEW 1: WEEKLY TIMETABLE GRID */}
              {viewMode === 'grid' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <CalendarDays className="w-4 h-4 text-brand-400" />
                      Weekly Schedule Grid &bull; Monday to Sunday
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Highlighted column indicates today's schedule
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7 gap-3">
                    {ORDERED_DAYS.map((day) => {
                      const isToday = (day === currentDay);
                      const slots = slotsByDay[day] || [];

                      return (
                        <div
                          key={day}
                          className={`rounded-2xl border transition-all flex flex-col ${
                            isToday
                              ? 'bg-slate-900/90 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                              : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700/80'
                          }`}
                        >
                          {/* Day Column Header */}
                          <div className={`p-3 border-b flex items-center justify-between ${
                            isToday
                              ? 'border-emerald-500/30 bg-emerald-500/10'
                              : 'border-slate-800 bg-slate-900/80'
                          }`}>
                            <div className="flex items-center gap-1.5">
                              <span className={`text-xs font-black tracking-wider uppercase ${
                                isToday ? 'text-emerald-300' : 'text-slate-300'
                              }`}>
                                {day}
                              </span>
                              {isToday && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-500 text-slate-950 uppercase tracking-widest">
                                  TODAY
                                </span>
                              )}
                            </div>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              slots.length > 0
                                ? 'bg-slate-800 text-slate-300 border border-slate-700'
                                : 'text-slate-500'
                            }`}>
                              {slots.length} {slots.length === 1 ? 'class' : 'classes'}
                            </span>
                          </div>

                          {/* Day Slots List */}
                          <div className="p-2.5 flex-1 space-y-2">
                            {slots.length === 0 ? (
                              <div className="py-8 text-center text-[11px] text-slate-500 italic">
                                No classes scheduled
                              </div>
                            ) : (
                              slots.map((slot) => {
                                const statusInfo = getSlotStatus(slot);
                                const isLive = statusInfo.status === 'LIVE';
                                const isUpcoming = statusInfo.status === 'UPCOMING';
                                const isSessionRunning = isSlotSessionActive(slot);

                                return (
                                  <div
                                    key={slot.id}
                                    className={`p-3 rounded-xl border text-xs transition-all relative overflow-hidden ${
                                      isLive
                                        ? 'bg-emerald-950/20 border-emerald-500/40 shadow-md shadow-emerald-500/10'
                                        : isUpcoming
                                        ? 'bg-slate-800/70 border-slate-700/80 hover:border-slate-600'
                                        : 'bg-slate-800/40 border-slate-800/80 hover:border-slate-700'
                                    }`}
                                  >
                                    {/* Time Range & Status Pill */}
                                    <div className="flex items-center justify-between gap-1 mb-1.5">
                                      <span className="font-mono text-[11px] font-bold text-slate-300 flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-brand-400" />
                                        {slot.start_time} - {slot.end_time}
                                      </span>
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${statusInfo.badgeColor}`}>
                                        {statusInfo.label}
                                      </span>
                                    </div>

                                    {/* Subject Title */}
                                    <p className="font-bold text-white text-xs leading-snug">
                                      {slot.subject_code} &bull; {slot.subject_name}
                                    </p>

                                    {/* Cohort & Room */}
                                    <div className="mt-2 pt-2 border-t border-slate-700/50 flex flex-col gap-1 text-[11px] text-slate-400">
                                      <div className="flex items-center justify-between">
                                        <span className="truncate text-indigo-300">
                                          {slot.department ? `${slot.department.split(' ')[0]} S${slot.semester}` : `Sem ${slot.semester}`} ({slot.section})
                                        </span>
                                        <span className="font-mono text-slate-300 font-semibold bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-700/80 flex items-center gap-0.5">
                                          <MapPin className="w-2.5 h-2.5 text-rose-400" />
                                          {slot.room_no}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Action button if slot is eligible for attendance today */}
                                    {isToday && (isLive || isUpcoming) && (
                                      <div className="mt-2.5 pt-2 border-t border-slate-700/60">
                                        {isSessionRunning ? (
                                          <button
                                            type="button"
                                            onClick={onSwitchToLive}
                                            className="w-full py-1.5 rounded-lg text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition flex items-center justify-center gap-1.5"
                                          >
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                                            Active Session &bull; Console
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => onStartAttendance(slot)}
                                            className={`w-full py-1.5 rounded-lg text-[11px] font-bold text-white transition flex items-center justify-center gap-1.5 shadow ${
                                              isLive
                                                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500'
                                                : 'bg-brand-600 hover:bg-brand-500'
                                            }`}
                                          >
                                            <Play className="w-3 h-3 fill-white" />
                                            Start Attendance
                                          </button>
                                        )}
                                      </div>
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
              )}

              {/* VIEW 2: DAILY SCHEDULE VIEW */}
              {viewMode === 'daily' && (
                <div className="space-y-4">
                  
                  {/* Day Picker Pills */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                    {ORDERED_DAYS.map((day) => {
                      const isSelected = (day === selectedDay);
                      const isToday = (day === currentDay);
                      const count = (slotsByDay[day] || []).length;

                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => setSelectedDay(day)}
                          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 border ${
                            isSelected
                              ? 'bg-brand-600 text-white border-brand-500 shadow-lg shadow-brand-600/30'
                              : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800/80'
                          }`}
                        >
                          <span>{day}</span>
                          {isToday && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                          )}
                          <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected Day Timeline List */}
                  <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                      <div>
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                          <span>{selectedDay} Schedule</span>
                          {selectedDay === currentDay && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              TODAY
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-slate-400">
                          {(slotsByDay[selectedDay] || []).length} lectures scheduled for this day
                        </p>
                      </div>
                      <span className="text-xs font-mono text-slate-400">
                        {user.faculty_id || user.roll_no} &bull; {user.name}
                      </span>
                    </div>

                    {(slotsByDay[selectedDay] || []).length === 0 ? (
                      <div className="py-12 text-center space-y-2">
                        <Calendar className="w-8 h-8 text-slate-600 mx-auto" />
                        <p className="text-sm font-semibold text-slate-400">No Teaching Sessions for {selectedDay}</p>
                        <p className="text-xs text-slate-500">You have no official lectures scheduled on this day.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(slotsByDay[selectedDay] || []).map((slot, index) => {
                          const statusInfo = getSlotStatus(slot);
                          const isLive = statusInfo.status === 'LIVE';
                          const isUpcoming = statusInfo.status === 'UPCOMING';
                          const isSessionRunning = isSlotSessionActive(slot);

                          return (
                            <div
                              key={slot.id || index}
                              className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                                isLive
                                  ? 'bg-emerald-950/20 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-start gap-4">
                                {/* Time column */}
                                <div className="text-center shrink-0 w-24 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 font-mono">
                                  <span className="text-xs font-bold text-white block">{slot.start_time}</span>
                                  <span className="text-[10px] text-slate-500 block">to</span>
                                  <span className="text-xs font-bold text-white block">{slot.end_time}</span>
                                </div>

                                {/* Class details */}
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-brand-500/15 text-brand-300 border border-brand-500/30 font-mono">
                                      {slot.subject_code}
                                    </span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusInfo.badgeColor}`}>
                                      {statusInfo.label}
                                    </span>
                                    <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                                      <Building2 className="w-3 h-3 text-slate-500" />
                                      {slot.room_no}
                                    </span>
                                  </div>

                                  <h4 className="text-sm sm:text-base font-bold text-white">
                                    {slot.subject_name}
                                  </h4>

                                  <p className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                                    <span className="text-indigo-300 font-medium">
                                      {slot.department} &bull; Sem {slot.semester} &bull; Section {slot.section}
                                    </span>
                                    <span>&bull;</span>
                                    <span>Academic Year: {slot.academic_year || '2025-2026'}</span>
                                  </p>
                                </div>
                              </div>

                              {/* Action: Start Attendance if today */}
                              <div className="shrink-0 self-end md:self-center">
                                {selectedDay === currentDay && (isLive || isUpcoming) ? (
                                  isSessionRunning ? (
                                    <button
                                      type="button"
                                      onClick={onSwitchToLive}
                                      className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition flex items-center gap-2"
                                    >
                                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                                      <span>Session Active (Console)</span>
                                      <ArrowRight className="w-3.5 h-3.5" />
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => onStartAttendance(slot)}
                                      className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition flex items-center gap-2 shadow ${
                                        isLive
                                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-500/20'
                                          : 'bg-brand-600 hover:bg-brand-500 shadow-brand-500/20'
                                      }`}
                                    >
                                      <Play className="w-3.5 h-3.5 fill-white" />
                                      <span>Start Attendance</span>
                                    </button>
                                  )
                                ) : (
                                  <span className="text-xs font-semibold text-slate-500 px-3 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800">
                                    Official Slot
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

    </div>
  );
}
