import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Clock, BookOpen, ChevronRight, Play, CheckCircle2,
  RefreshCw, MapPin, ArrowLeft, ArrowRight
} from 'lucide-react';
import { api } from '../../api';

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

export default function FacultyTimetableMobileView({
  user,
  activeSession,
  onBack,
  onSelectClassForSession
}) {
  const [timetable, setTimetable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tab mode: 'today' | 'week' (Screen 13 Reference)
  const [timeMode, setTimeMode] = useState('today');

  // Currently live day of week
  const currentDay = useMemo(() => {
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    return days[new Date().getDay()];
  }, []);

  const [selectedDay, setSelectedDay] = useState(currentDay);

  const [currentTimeStr, setCurrentTimeStr] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });

  // Keep time updated
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTimeStr(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Fetch published personal timetable from backend
  const loadTimetable = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getMyTimetable();
      const entries = res.timetable || [];
      const published = entries.filter(e => e.is_published !== false);
      setTimetable(published);
    } catch (err) {
      console.error('Failed to load faculty timetable:', err);
      setError(err.message || 'Failed to load official timetable from backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTimetable();
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
    ORDERED_DAYS.forEach(d => {
      map[d].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
    });
    return map;
  }, [timetable]);

  const displayedDay = timeMode === 'today' ? currentDay : selectedDay;
  const displayedSlots = slotsByDay[displayedDay] || [];

  const getSlotStatus = (slot) => {
    if (displayedDay !== currentDay) {
      return { status: 'SCHEDULED', label: 'Scheduled', isLive: false, isCompleted: false };
    }
    if (slot.start_time <= currentTimeStr && currentTimeStr <= slot.end_time) {
      return { status: 'LIVE', label: 'Live Now', isLive: true, isCompleted: false };
    }
    if (currentTimeStr < slot.start_time) {
      return { status: 'UPCOMING', label: 'Upcoming', isLive: false, isCompleted: false };
    }
    return { status: 'COMPLETED', label: 'Completed', isLive: false, isCompleted: true };
  };

  const todayFormattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return (
    <div className="space-y-4">
      {/* Top Header with Back Navigation */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition shadow-sm"
            title="Back to Dashboard"
            aria-label="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base font-extrabold text-[#111827] tracking-tight">
              My Timetable
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">
              {todayFormattedDate}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadTimetable}
          className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-[#1A4731] transition shadow-sm"
          title="Refresh Timetable"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#1A4731]' : ''}`} />
        </button>
      </div>

      {/* Segmented Control: [Today] | [This Week] (Screen 13 Reference) */}
      <div className="p-1 rounded-xl bg-slate-100 border border-slate-200 flex items-center">
        <button
          type="button"
          onClick={() => setTimeMode('today')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
            timeMode === 'today'
              ? 'bg-white text-[#1A4731] shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => setTimeMode('week')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
            timeMode === 'week'
              ? 'bg-white text-[#1A4731] shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          This Week
        </button>
      </div>

      {/* Day Selector Pills (When in 'This Week' mode) */}
      {timeMode === 'week' && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {ORDERED_DAYS.map((d) => {
            const isSelected = selectedDay === d;
            const isToday = currentDay === d;
            const count = (slotsByDay[d] || []).length;

            return (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDay(d)}
                className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 flex flex-col items-center min-w-[50px] transition-all border ${
                  isSelected
                    ? 'bg-[#1A4731] text-white border-[#1A4731] shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                <span>{DAY_LABELS[d]}</span>
                <span className={`text-[10px] mt-0.5 ${isSelected ? 'text-emerald-200' : 'text-slate-400 font-normal'}`}>
                  {count} {count === 1 ? 'class' : 'classes'}
                </span>
                {isToday && (
                  <span className={`w-1 h-1 rounded-full mt-1 ${isSelected ? 'bg-white' : 'bg-[#1A4731]'}`} />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Classes List */}
      <div className="space-y-2.5">
        {loading ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/90 text-slate-500 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#1A4731]" />
            <p className="text-xs font-semibold text-slate-700">Loading lecture schedule...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl p-6 text-center border border-rose-200 text-rose-600 space-y-2">
            <p className="text-xs font-bold">{error}</p>
            <button
              type="button"
              onClick={loadTimetable}
              className="text-xs font-bold px-3 py-1 bg-rose-50 text-rose-700 rounded-lg hover:underline"
            >
              Retry
            </button>
          </div>
        ) : displayedSlots.length > 0 ? (
          displayedSlots.map((slot, idx) => {
            const st = getSlotStatus(slot);

            return (
              <div
                key={slot.id || idx}
                onClick={() => onSelectClassForSession(slot)}
                className={`bg-white rounded-2xl p-4 border transition-all cursor-pointer ${
                  st.isLive
                    ? 'border-emerald-300 ring-1 ring-emerald-300 shadow-sm'
                    : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 text-[#1A4731] border border-emerald-200 flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-[#111827] truncate">
                        {slot.subject_name || slot.subject_code}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span className="flex items-center gap-1 font-mono text-[#1A4731] font-semibold">
                          <Clock className="w-3 h-3" />
                          {slot.start_time} - {slot.end_time}
                        </span>
                        <span>&bull;</span>
                        <span className="truncate">
                          {slot.section || 'CSE 5A'} {slot.room_no ? `• Room ${slot.room_no}` : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {st.isLive ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Live
                      </span>
                    ) : st.isCompleted ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Completed
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        {st.label}
                      </span>
                    )}

                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/90 text-slate-500 space-y-2">
            <Calendar className="w-8 h-8 mx-auto text-slate-300 stroke-1" />
            <p className="text-xs font-semibold text-slate-700">No classes scheduled for {DAY_LABELS[displayedDay] || displayedDay}</p>
            <p className="text-[11px] text-slate-400">Enjoy your preparation time or check other days of the week.</p>
          </div>
        )}
      </div>
    </div>
  );
}
