import React from 'react';
import { Calendar, Clock, MapPin, Users, BookOpen, ChevronRight, Play, CheckCircle2 } from 'lucide-react';

export default function DesktopScheduleList({
  todayClasses = [],
  loadingClasses = false,
  isSessionActive = false,
  selectedSlot = null,
  onSelectSlot,
  onStartSessionForSlot,
  onViewAllClasses
}) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-base font-extrabold text-[#111827] tracking-tight">
            Today's Schedule
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            {todayClasses.length > 0
              ? `${todayClasses.length} lecture slots scheduled for today • Click a slot to inspect or launch`
              : 'No timetable slots assigned for today'}
          </p>
        </div>

        {onViewAllClasses && (
          <button
            type="button"
            onClick={onViewAllClasses}
            className="text-xs font-bold text-[#1A4731] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>View Full Timetable</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Class Items List */}
      {loadingClasses ? (
        <div className="py-8 text-center text-xs text-slate-400">
          Loading today's assigned timetable slots...
        </div>
      ) : todayClasses.length === 0 ? (
        <div className="py-8 text-center space-y-2">
          <div className="w-10 h-10 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto">
            <Calendar className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-slate-500">
            No classes scheduled for today.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {todayClasses.map((item, idx) => {
            const isLive = item.is_current_slot;
            const isUpcoming = item.is_upcoming_slot;
            const isSelected = selectedSlot && (
              selectedSlot.id === item.id ||
              selectedSlot.subject_code === item.subject_code
            );

            return (
              <div
                key={item.id || idx}
                onClick={() => onSelectSlot && onSelectSlot(item)}
                className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer ${
                  isSelected
                    ? 'bg-[#EBF4EE]/80 border-[#1A4731] ring-2 ring-[#1A4731]/20 shadow-sm'
                    : isLive
                    ? 'bg-emerald-50/40 border-emerald-300 hover:border-emerald-400 shadow-xs'
                    : 'bg-[#F8FAF9] border-slate-200/80 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                {/* Left: Icon + Code + Name */}
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition ${
                      isSelected
                        ? 'bg-[#1A4731] text-white shadow-xs'
                        : isLive
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-white border border-slate-200 text-slate-600'
                    }`}
                  >
                    <BookOpen className="w-5 h-5" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-black text-[#1A4731] bg-white px-2 py-0.5 rounded-lg border border-slate-200/80">
                        {item.subject_code || 'CS301'}
                      </span>
                      <span className="text-sm font-extrabold text-[#111827]">
                        {item.subject_name || 'Operating Systems'}
                      </span>
                      {isSelected && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#1A4731] bg-white px-2 py-0.5 rounded-full border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-[#1A4731]" />
                          Active Selection
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.time || '09:00 - 10:00 AM'}</span>
                      </span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-bold text-slate-700">{item.room_no || 'LAB-302'}</span>
                      </span>
                      <span>&bull;</span>
                      <span>{item.section || 'Sec A'}</span>
                      <span>&bull;</span>
                      <span>{item.enrolled_count || 50} Enrolled</span>
                    </div>
                  </div>
                </div>

                {/* Right: Status chip & Start Action */}
                <div className="flex items-center gap-2.5 sm:self-center shrink-0">
                  {isLive ? (
                    <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center gap-1.5 uppercase tracking-wider">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                      Live Now
                    </span>
                  ) : isUpcoming ? (
                    <span className="px-3 py-1 rounded-full bg-slate-200/80 text-slate-700 text-[10px] font-bold uppercase tracking-wider">
                      Upcoming
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-semibold uppercase tracking-wider">
                      Scheduled
                    </span>
                  )}

                  {!isSessionActive && onStartSessionForSlot && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartSessionForSlot(item);
                      }}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#1A4731] hover:bg-[#143826] active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                      title={`Launch Attendance Session for ${item.subject_name}`}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Start</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
