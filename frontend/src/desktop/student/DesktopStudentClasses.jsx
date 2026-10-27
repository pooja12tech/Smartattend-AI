import React, { useState, useMemo } from 'react';
import {
  CalendarDays, Clock, MapPin, User, BookOpen, CheckCircle2,
  Calendar, ArrowLeft, Filter, Search, Sparkles
} from 'lucide-react';

export default function DesktopStudentClasses({
  todayClasses = [],
  fullTimetable = [],
  onStartScan
}) {
  const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  
  const currentDayName = useMemo(() => {
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    return days[new Date().getDay()];
  }, []);

  const [selectedDay, setSelectedDay] = useState(
    DAYS.includes(currentDayName) ? currentDayName : 'MONDAY'
  );
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'TODAY'
  const [searchQuery, setSearchQuery] = useState('');

  // Classes to display
  const displayedClasses = useMemo(() => {
    let source = [];
    if (filterMode === 'TODAY') {
      source = todayClasses;
    } else {
      source = (fullTimetable || []).filter(
        cls => (cls.day_of_week || '').toUpperCase() === selectedDay
      );
      // Fallback if fullTimetable for that day is empty and it is today
      if (source.length === 0 && selectedDay === currentDayName) {
        source = todayClasses;
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      source = source.filter(
        c => (c.subject_name || '').toLowerCase().includes(q) ||
             (c.subject_code || '').toLowerCase().includes(q) ||
             (c.faculty_name || '').toLowerCase().includes(q) ||
             (c.room || '').toLowerCase().includes(q)
      );
    }

    return [...source].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
  }, [filterMode, selectedDay, fullTimetable, todayClasses, currentDayName, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EBF4EE] text-[#1A4731] border border-[#1A4731]/15 uppercase tracking-wide">
              Timetable Schedule
            </span>
            <span className="text-xs text-slate-400 font-medium">Semester 6 &bull; Section A</span>
          </div>
          <h1 className="text-2xl font-black text-[#111827] tracking-tight mt-1">
            Classes &amp; Weekly Timetable
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Central academic schedule with live room allocations &amp; faculty assignments
          </p>
        </div>

        {/* Search Input */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search subject or faculty..."
              className="pl-9 pr-4 py-2 bg-[#F8FAF9] border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#1A4731] w-56"
            />
          </div>
        </div>
      </div>

      {/* Day Selector Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {DAYS.map((day) => {
          const isToday = day === currentDayName;
          const isSelected = selectedDay === day;

          return (
            <button
              key={day}
              type="button"
              onClick={() => {
                setSelectedDay(day);
                setFilterMode('ALL');
              }}
              className={`px-5 py-2.5 rounded-2xl text-xs font-extrabold transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
                isSelected
                  ? 'bg-[#1A4731] text-white shadow-sm'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90'
              }`}
            >
              <span>{day.slice(0, 3)}</span>
              {isToday && (
                <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-emerald-300' : 'bg-emerald-600'}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Classes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayedClasses.length > 0 ? (
          displayedClasses.map((cls, idx) => {
            const isCurrent = cls.is_current_slot;

            return (
              <div
                key={idx}
                className={`bg-white rounded-3xl p-5 border transition-all space-y-4 ${
                  isCurrent
                    ? 'border-emerald-300 ring-2 ring-emerald-300/40 shadow-sm bg-[#EBF4EE]/30'
                    : 'border-slate-200/90 hover:shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isCurrent
                        ? 'bg-[#1A4731] text-white'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                    }`}>
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[11px] font-mono font-bold text-slate-400 uppercase">
                        {cls.subject_code || 'CS301'}
                      </span>
                      <h3 className="font-extrabold text-sm text-[#111827] leading-tight">
                        {cls.subject_name || 'Subject Lecture'}
                      </h3>
                    </div>
                  </div>

                  {isCurrent && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500 text-white uppercase tracking-wider animate-pulse">
                      Live
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-xs text-slate-600 bg-slate-50/70 p-3 rounded-2xl border border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Time:
                    </span>
                    <span className="font-bold text-slate-800">
                      {cls.start_time} - {cls.end_time}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> Room / Lab:
                    </span>
                    <span className="font-bold text-slate-800">
                      {cls.room || 'Room TBA'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> Faculty:
                    </span>
                    <span className="font-bold text-slate-800 truncate max-w-[150px]">
                      {cls.faculty_name || 'Assigned Faculty'}
                    </span>
                  </div>
                </div>

                {isCurrent && (
                  <button
                    type="button"
                    onClick={onStartScan}
                    className="w-full py-2.5 rounded-xl bg-[#1A4731] hover:bg-[#143826] text-white font-bold text-xs shadow-xs transition"
                  >
                    Scan QR &amp; Mark Attendance
                  </button>
                )}
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-16 bg-white rounded-3xl border border-dashed border-slate-200 text-center space-y-2">
            <CalendarDays className="w-8 h-8 text-slate-400 mx-auto" />
            <h4 className="font-bold text-sm text-slate-700">No classes found for {selectedDay}</h4>
            <p className="text-xs text-slate-500">Select another day or adjust your search filter</p>
          </div>
        )}
      </div>
    </div>
  );
}
