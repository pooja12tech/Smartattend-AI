import React from 'react';
import {
  Radio, MapPin, Users, Clock, ShieldCheck, Square,
  RefreshCw, CheckCircle2, ChevronRight
} from 'lucide-react';

export default function DesktopAdminSessions({
  overview,
  onRefresh
}) {
  const sessions = overview?.sessions || [];
  const activeSessions = sessions.filter(s => s.status === 'ACTIVE');
  const pastSessions = sessions.filter(s => s.status !== 'ACTIVE');

  return (
    <div className="w-full px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/90">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Live Operations
            </span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs text-slate-500 font-medium">Campus Wide Monitoring</span>
          </div>
          <h1 className="text-2xl font-black text-[#111827] tracking-tight">
            Live Attendance Sessions &amp; Quorum Monitor
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Real-time inspection of active anti-proxy broadcasts, verified student headcounts, and room geofences.
          </p>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer self-start sm:self-center"
            title="Refresh Sessions"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-slate-500">Live Active Lectures</span>
          <p className="text-2xl font-black text-emerald-700">{activeSessions.length}</p>
          <span className="text-[11px] text-slate-400">Classrooms broadcasting rolling QR</span>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-slate-500">Students Verified Live</span>
          <p className="text-2xl font-black text-[#1A4731]">
            {activeSessions.reduce((acc, s) => acc + (s.present_count || 0), 0)}
          </p>
          <span className="text-[11px] text-slate-400">Validated via facial liveness &amp; geofence</span>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-slate-500">Campus Geofence Lock</span>
          <p className="text-2xl font-black text-[#111827]">150 Meters</p>
          <span className="text-[11px] text-emerald-700 font-bold">100% Rooms anchored by teacher GPS</span>
        </div>
      </div>

      {/* Active Sessions List */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 space-y-4">
        <h3 className="text-base font-extrabold text-[#111827]">
          Classrooms in Session Now ({activeSessions.length})
        </h3>

        {activeSessions.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[#EBF4EE] text-[#1A4731] flex items-center justify-center mx-auto">
              <Radio className="w-6 h-6" />
            </div>
            <p className="text-sm font-extrabold text-slate-700">No active classes broadcasting right now</p>
            <p className="text-xs text-slate-400">When teachers launch attendance from their consoles, they appear here live.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeSessions.map((sess, idx) => (
              <div
                key={sess.session_id || idx}
                className="p-5 rounded-2xl bg-[#F8FAF9] border border-emerald-300 ring-1 ring-emerald-300/40 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="font-mono text-xs font-black text-[#1A4731] bg-white px-2 py-0.5 rounded-lg border border-emerald-200">
                      {sess.subject_code || 'CS301'}
                    </span>
                    <h4 className="text-base font-extrabold text-[#111827] mt-1">
                      {sess.subject_name || 'Operating Systems'}
                    </h4>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    Live
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 font-medium">
                  <span>Teacher: <strong className="text-slate-700">{sess.faculty_name || sess.faculty_id}</strong></span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{sess.room_no || 'LAB-304'}</span>
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                  <span className="font-mono text-sm font-black text-emerald-800">
                    {sess.present_count || 0} Students Present
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Session: {sess.session_id?.substring(0, 8) || 'Active'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past Sessions Audit */}
      {pastSessions.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 space-y-4">
          <h3 className="text-base font-extrabold text-[#111827]">
            Recent Completed Sessions ({pastSessions.length})
          </h3>

          <div className="divide-y divide-slate-100 text-xs">
            {pastSessions.slice(0, 8).map((sess, idx) => (
              <div key={sess.session_id || idx} className="py-3 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800">{sess.subject_name || sess.subject_code}</span>
                  <span className="text-[11px] text-slate-400 block font-mono">
                    {sess.faculty_name || sess.faculty_id} &bull; Room {sess.room_no || 'TBA'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-700">{sess.present_count || 0} Attended</span>
                  <span className="text-[11px] text-slate-400 block">Status: ENDED</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
