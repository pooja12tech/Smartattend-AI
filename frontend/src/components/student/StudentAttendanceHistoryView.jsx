import React, { useState, useMemo } from 'react';
import { ArrowLeft, BookOpen, Clock, Calendar, CheckCircle2, XCircle } from 'lucide-react';

export default function StudentAttendanceHistoryView({
  logs = [],
  onBack
}) {
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PRESENT' | 'ABSENT'

  const filteredLogs = useMemo(() => {
    if (statusFilter === 'ALL') return logs;
    if (statusFilter === 'PRESENT') {
      return logs.filter(l => l.status === 'PRESENT' || l.status === 'MANUAL_PRESENT');
    }
    if (statusFilter === 'ABSENT') {
      return logs.filter(l => l.status === 'ABSENT' || l.status === 'REJECTED');
    }
    return logs;
  }, [logs, statusFilter]);

  const getSubjectColorStyles = (index) => {
    const palette = [
      { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
      { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
      { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
      { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' }
    ];
    return palette[index % palette.length];
  };

  return (
    <div className="space-y-4">
      {/* Top Header: < Attendance History (Screen 14 Reference) */}
      <div className="sticky top-0 z-20 bg-[#F8FAF9]/95 backdrop-blur-md py-2.5 -mx-4 px-4 flex items-center justify-between border-b border-slate-200/60 select-none">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 min-h-[44px] min-w-[44px] text-[#111827] active:scale-[0.97] font-extrabold text-base focus:outline-none transition"
        >
          <ArrowLeft className="w-5 h-5 text-slate-700" />
          <span>Attendance History</span>
        </button>
      </div>

      {/* Filter Pills: [ All | Present | Absent ] (Screen 14 Reference) */}
      <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
        <button
          type="button"
          onClick={() => setStatusFilter('ALL')}
          className={`flex-1 min-h-[44px] py-2 text-xs font-bold rounded-xl transition-all active:scale-[0.97] ${
            statusFilter === 'ALL'
              ? 'bg-[#1A4731] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          All
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('PRESENT')}
          className={`flex-1 min-h-[44px] py-2 text-xs font-bold rounded-xl transition-all active:scale-[0.97] ${
            statusFilter === 'PRESENT'
              ? 'bg-[#1A4731] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Present
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('ABSENT')}
          className={`flex-1 min-h-[44px] py-2 text-xs font-bold rounded-xl transition-all active:scale-[0.97] ${
            statusFilter === 'ABSENT'
              ? 'bg-[#1A4731] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Absent
        </button>
      </div>

      {/* Month Section Header */}
      <div className="pt-1">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          October 2026
        </span>
      </div>

      {/* Attendance History List */}
      <div className="space-y-2.5">
        {filteredLogs.length > 0 ? (
          filteredLogs.map((log, idx) => {
            const isPresent = log.status === 'PRESENT' || log.status === 'MANUAL_PRESENT';
            const styles = getSubjectColorStyles(idx);
            const dateStr = log.marked_at
              ? new Date(log.marked_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ', ' + new Date(log.marked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '24 Oct, 09:00 AM';

            return (
              <div
                key={log.id || idx}
                className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-11 h-11 rounded-xl ${styles.bg} ${styles.text} border ${styles.border} flex items-center justify-center shrink-0`}>
                    <BookOpen className="w-5 h-5" />
                  </div>

                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-[#111827] truncate">
                      {log.subject_name || log.session_id || 'Data Structures'}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {dateStr}
                    </p>
                  </div>
                </div>

                <div className="shrink-0">
                  {isPresent ? (
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
                      Present
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-300">
                      Absent
                    </span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/90 text-slate-500 space-y-2">
            <Calendar className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-xs font-bold text-slate-700">No attendance records found</p>
            <p className="text-[11px] text-slate-400">Mark your attendance in lectures to see verified session logs here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
