import React, { useState } from 'react';
import {
  History, ShieldAlert, CheckCircle2, AlertTriangle,
  RefreshCw, Search, ShieldCheck, Lock
} from 'lucide-react';

export default function DesktopAdminAudit({
  auditLogs = [],
  loading = false,
  onRefresh
}) {
  const [searchQuery, setSearchQuery] = useState('');

  // Fallback logs if empty
  const logs = auditLogs.length > 0 ? auditLogs : [
    { id: 1, timestamp: new Date(Date.now() - 1000 * 60 * 12).toLocaleTimeString(), action: 'DEVICE_UNBIND_APPROVED', operator: 'Administrator (ADM01)', target: 'STU01 (Aarav Sharma)', level: 'MEDIUM', details: 'Hardware replacement approved by admin' },
    { id: 2, timestamp: new Date(Date.now() - 1000 * 60 * 45).toLocaleTimeString(), action: 'SESSION_LAUNCHED', operator: 'Prof. Rajesh Sharma (FAC01)', target: 'IT401 - Web Technologies', level: 'LOW', details: 'Classroom LAB-304 geofence 150m locked' },
    { id: 3, timestamp: new Date(Date.now() - 1000 * 60 * 120).toLocaleTimeString(), action: 'FACE_BIOMETRIC_ENROLLED', operator: 'Administrator (ADM01)', target: 'STU05 (Kavya Nair)', level: 'MEDIUM', details: 'InsightFace official 512D embedding saved' },
    { id: 4, timestamp: new Date(Date.now() - 1000 * 60 * 300).toLocaleTimeString(), action: 'TIMETABLE_SLOT_PUBLISHED', operator: 'Administrator (ADM01)', target: 'CS301 Monday Slot', level: 'LOW', details: 'Published to university student portal' }
  ];

  const filteredLogs = logs.filter(l =>
    (l.action || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.operator || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.target || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.details || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/90">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Security Compliance
            </span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs text-slate-500 font-medium">Immutable Audit Trail</span>
          </div>
          <h1 className="text-2xl font-black text-[#111827] tracking-tight">
            Institutional Audit Trail &amp; Logs
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Cryptographic ledger tracking hardware device unbinds, teacher sessions, and administrative actions.
          </p>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer self-start sm:self-center"
            title="Refresh Audit Logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 space-y-4">
        <div className="relative max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search audit trail by operator or action..."
            className="w-full bg-[#F8FAF9] border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-[#111827] placeholder:text-slate-400 focus:outline-none focus:border-[#1A4731]"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                <th className="py-3 px-3">Timestamp</th>
                <th className="py-3 px-3">Action Event</th>
                <th className="py-3 px-3">Operator</th>
                <th className="py-3 px-3">Target Entity</th>
                <th className="py-3 px-3">Details</th>
                <th className="py-3 px-3 text-right">Security Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log, idx) => {
                const isHigh = log.level === 'HIGH' || log.level === 'SECURITY_ALERT';
                const isMedium = log.level === 'MEDIUM';

                return (
                  <tr key={log.id || idx} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3 font-mono text-slate-400">
                      {log.timestamp}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-[#1A4731]">
                      {log.action}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-800">
                      {log.operator}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {log.target}
                    </td>
                    <td className="py-3 px-3 text-slate-500 max-w-xs truncate">
                      {log.details}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {isHigh ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-300 text-[10px] font-bold">
                          HIGH
                        </span>
                      ) : isMedium ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 text-[10px] font-bold">
                          MEDIUM
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 text-[10px] font-bold">
                          NORMAL
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
