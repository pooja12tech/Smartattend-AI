import React, { useState, useMemo } from 'react';
import { ArrowLeft, BookOpen, Clock, MapPin, User, CheckCircle2, ChevronRight } from 'lucide-react';

export default function StudentClassesView({
  timetable = [],
  todayClasses = [],
  onBack,
  onOpenSession
}) {
  const [filterTab, setFilterTab] = useState('today'); // 'today' | 'week' | 'all'

  const filteredClasses = useMemo(() => {
    if (filterTab === 'today') {
      return todayClasses;
    }
    if (filterTab === 'week') {
      // Return published entries sorted by day and time
      return timetable;
    }
    return timetable;
  }, [filterTab, todayClasses, timetable]);

  const getSubjectColorStyles = (index) => {
    const palette = [
      { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
      { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
      { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
      { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' }
    ];
    return palette[index % palette.length];
  };

  return (
    <div className="space-y-4">
      {/* Top Header: < My Classes (Screen 13 Reference) */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-[#111827] font-extrabold text-base focus:outline-none"
        >
          <ArrowLeft className="w-5 h-5 text-slate-700" />
          <span>My Classes</span>
        </button>
      </div>

      {/* Filter Tabs: [ Today | This Week | All ] (Screen 13 Reference) */}
      <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
        <button
          type="button"
          onClick={() => setFilterTab('today')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            filterTab === 'today'
              ? 'bg-[#1A4731] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Today
        </button>

        <button
          type="button"
          onClick={() => setFilterTab('week')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            filterTab === 'week'
              ? 'bg-[#1A4731] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          This Week
        </button>

        <button
          type="button"
          onClick={() => setFilterTab('all')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            filterTab === 'all'
              ? 'bg-[#1A4731] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          All
        </button>
      </div>

      {/* Class Cards List */}
      <div className="space-y-2.5">
        {filteredClasses.length > 0 ? (
          filteredClasses.map((cls, idx) => {
            const styles = getSubjectColorStyles(idx);
            const isOngoing = cls.is_current_slot;
            const isAttended = cls.is_attended;

            return (
              <div
                key={cls.id || idx}
                onClick={() => onOpenSession && onOpenSession(cls)}
                className={`bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm transition hover:border-slate-300 ${
                  isOngoing ? 'ring-1 ring-emerald-400 bg-emerald-50/20 cursor-pointer' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-11 h-11 rounded-xl ${styles.bg} ${styles.text} border ${styles.border} flex items-center justify-center shrink-0`}>
                      <BookOpen className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-[#111827] truncate">
                        {cls.subject_name || cls.subject_code}
                      </h4>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {cls.start_time && cls.end_time ? `${cls.start_time} - ${cls.end_time}` : (cls.time || '09:00 AM - 10:00 AM')}
                        </span>
                        <span>&bull;</span>
                        <span className="truncate">
                          {cls.section || 'CSE 5A'}
                        </span>
                      </div>
                      {cls.day_of_week && filterTab !== 'today' && (
                        <span className="text-[10px] text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded mt-1 inline-block">
                          {cls.day_of_week}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isOngoing ? (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Ongoing
                      </span>
                    ) : isAttended ? (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Attended
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        Upcoming
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/90 text-slate-500 space-y-2">
            <BookOpen className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-xs font-bold text-slate-700">No scheduled classes found</p>
            <p className="text-[11px] text-slate-400">Classes will appear once scheduled and published by faculty or administration.</p>
          </div>
        )}
      </div>
    </div>
  );
}
