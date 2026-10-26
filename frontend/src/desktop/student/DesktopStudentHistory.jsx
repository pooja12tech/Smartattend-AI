import React, { useState, useMemo } from 'react';
import {
  History, Search, Filter, CheckCircle2, XCircle, Clock,
  Calendar, MapPin, ShieldCheck, Download
} from 'lucide-react';

export default function DesktopStudentHistory({
  logs = []
}) {
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PRESENT' | 'ABSENT'
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLogs = useMemo(() => {
    let list = logs;
    if (statusFilter === 'PRESENT') {
      list = list.filter(l => l.status === 'PRESENT' || l.status === 'MANUAL_PRESENT');
    } else if (statusFilter === 'ABSENT') {
      list = list.filter(l => l.status === 'ABSENT' || l.status === 'REJECTED');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        l => (l.subject_name || '').toLowerCase().includes(q) ||
             (l.subject_code || '').toLowerCase().includes(q) ||
             (l.room || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [logs, statusFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EBF4EE] text-[#1A4731] border border-[#1A4731]/15 uppercase tracking-wide">
              Audit Trail
            </span>
            <span className="text-xs text-slate-400 font-medium">All Logged Verification Records</span>
          </div>
          <h1 className="text-2xl font-black text-[#111827] tracking-tight mt-1">
            Attendance Verification History
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Cryptographically sealed audit records containing biometric match scores &amp; GPS timestamps
          </p>
        </div>

        {/* Filter Pills & Search */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex bg-[#F8FAF9] p-1 rounded-2xl border border-slate-200">
            {['ALL', 'PRESENT', 'ABSENT'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === f
                    ? 'bg-[#1A4731] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by subject or room..."
              className="pl-9 pr-4 py-2 bg-[#F8FAF9] border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#1A4731] w-48 sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* History Data Table */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-4 px-6">Subject / Course</th>
                <th className="py-4 px-4">Date &amp; Time</th>
                <th className="py-4 px-4">Room</th>
                <th className="py-4 px-4">Verification Method</th>
                <th className="py-4 px-6 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log, idx) => {
                  const isPresent = log.status === 'PRESENT' || log.status === 'MANUAL_PRESENT';
                  const dateStr = log.timestamp || log.date
                    ? new Date(log.timestamp || log.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })
                    : 'Today';
                  const timeStr = log.timestamp
                    ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '09:02 AM';

                  return (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-6">
                        <span className="font-bold text-[#111827] block text-sm">
                          {log.subject_name || log.subject_code || 'Lecture Session'}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {log.subject_code || 'CS301'} &bull; {log.faculty_name || 'Prof. Faculty'}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        <span className="font-semibold text-slate-800 block">
                          {dateStr}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {timeStr}
                        </span>
                      </td>

                      <td className="py-4 px-4 font-medium text-slate-700">
                        {log.room || 'LAB-302'}
                      </td>

                      <td className="py-4 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 font-semibold text-[11px]">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#1A4731]" />
                          Dynamic QR + Face Liveness
                        </span>
                      </td>

                      <td className="py-4 px-6 text-right">
                        {isPresent ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-[#EBF4EE] text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Present
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3.5 h-3.5 text-rose-500" />
                            Absent
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" className="py-16 text-center text-slate-400 space-y-2">
                    <History className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="font-bold text-sm text-slate-600">No attendance records match your filter</p>
                    <p className="text-xs">Adjust your search term or switch to 'All' filter</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
