import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Clock, MapPin, Users, BookOpen, Play,
  CheckCircle2, RefreshCw, CalendarDays, ArrowLeft,
  ChevronRight, Building2, Sparkles, AlertCircle
} from 'lucide-react';
import { api } from '../../api';

const ORDERED_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const DAY_LABELS = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday'
};

export default function DesktopFacultyClasses({ user, onStartSession, onGoHome }) {
  const [timetable, setTimetable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDay, setSelectedDay] = useState(() => {
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const today = days[new Date().getDay()];
    return ORDERED_DAYS.includes(today) ? today : 'MONDAY';
  });

  const fetchTimetable = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getMyTimetable();
      let entries = res?.timetable || [];
      // If full timetable returned empty, attempt today's schedule fallback
      if (entries.length === 0) {
        try {
          const todayRes = await api.getFacultyTimetableToday();
          if (todayRes?.today_classes?.length) {
            entries = todayRes.today_classes;
          }
        } catch (_) {}
      }
      const published = entries.filter(e => e.is_published !== false);
      setTimetable(published);

      // If current day has no classes but another day does, auto-switch to a day with classes
      if (published.length > 0) {
        const todayCount = published.filter(e => (e.day_of_week || '').trim().toUpperCase() === selectedDay).length;
        if (todayCount === 0) {
          const firstAvailableDay = ORDERED_DAYS.find(d => published.some(e => (e.day_of_week || '').trim().toUpperCase() === d));
          if (firstAvailableDay) setSelectedDay(firstAvailableDay);
        }
      }
    } catch (err) {
      console.error('Failed to load faculty timetable:', err);
      // Attempt fallback to today's schedule
      try {
        const todayRes = await api.getFacultyTimetableToday();
        if (todayRes?.today_classes?.length) {
          setTimetable(todayRes.today_classes);
          return;
        }
      } catch (_) {}
      setError(err.message || 'Could not load timetable from university backend. Please ensure the backend is connected.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimetable();
  }, []);

  const daySlots = useMemo(() => {
    return timetable
      .filter(e => (e.day_of_week || '').trim().toUpperCase() === selectedDay)
      .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
  }, [timetable, selectedDay]);

  const totalWeeklyClasses = timetable.length;
  const uniqueSubjects = useMemo(() => {
    const set = new Set(timetable.map(t => t.subject_code || t.subject_name));
    return set.size;
  }, [timetable]);

  return (
    <div className="w-full px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/90">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Academic Timetable
            </span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs text-slate-500 font-medium">Semester Even 2026</span>
          </div>
          <h1 className="text-2xl font-black text-[#111827] tracking-tight">
            My Teaching Schedule &amp; Classes
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Manage your weekly timetable, allocated lecture rooms, and launch anti-proxy attendance sessions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchTimetable}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
            title="Refresh Timetable"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {onGoHome && (
            <button
              type="button"
              onClick={onGoHome}
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </button>
          )}
        </div>
      </div>

      {/* Network / Load Error Alert */}
      {error && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchTimetable}
            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition shrink-0 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Top 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-slate-500">Weekly Lecture Slots</span>
          <p className="text-2xl font-black text-[#111827]">{totalWeeklyClasses}</p>
          <span className="text-[11px] text-slate-400">Total assigned classes this semester</span>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-slate-500">Unique Subjects</span>
          <p className="text-2xl font-black text-[#1A4731]">{uniqueSubjects}</p>
          <span className="text-[11px] text-slate-400">Theory, labs &amp; tutorial modules</span>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-slate-500">Selected Day Load</span>
          <p className="text-2xl font-black text-[#111827]">{daySlots.length} Classes</p>
          <span className="text-[11px] text-slate-400">Scheduled for {DAY_LABELS[selectedDay]}</span>
        </div>
      </div>

      {/* Day Selector Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {ORDERED_DAYS.map((day) => {
          const isSelected = selectedDay === day;
          const count = timetable.filter(e => (e.day_of_week || '').toUpperCase() === day).length;

          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
                isSelected
                  ? 'bg-[#1A4731] text-white shadow-sm'
                  : 'bg-white border border-slate-200/90 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span>{DAY_LABELS[day]}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-black ${
                isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Slots List for Selected Day */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 space-y-4">
        <h3 className="text-base font-extrabold text-[#111827]">
          {DAY_LABELS[selectedDay]} Lecture Schedule
        </h3>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#1A4731]" />
            Loading assigned timetable slots...
          </div>
        ) : daySlots.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[#EBF4EE] text-[#1A4731] flex items-center justify-center mx-auto">
              <CalendarDays className="w-6 h-6" />
            </div>
            <p className="text-sm font-extrabold text-slate-700">No classes scheduled on {DAY_LABELS[selectedDay]}</p>
            <p className="text-xs text-slate-400">Enjoy your teaching preparation &amp; research hours.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {daySlots.map((slot, idx) => (
              <div
                key={slot.id || idx}
                className="p-5 rounded-2xl bg-[#F8FAF9] border border-slate-200/90 hover:border-slate-300 transition space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="font-mono text-xs font-black text-[#1A4731] bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                      {slot.subject_code}
                    </span>
                    <h4 className="text-base font-extrabold text-[#111827]">
                      {slot.subject_name}
                    </h4>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                    Section {slot.section || 'A'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 font-medium">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{slot.start_time} - {slot.end_time}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{slot.room_no || 'TBA'}</span>
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">
                    {slot.cohort_name || 'CSE 6th Sem'}
                  </span>
                  {onStartSession && (
                    <button
                      type="button"
                      onClick={() => onStartSession(slot)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#1A4731] hover:bg-[#143826] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Start Session</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
