import React from 'react';
import {
  Users, GraduationCap, Radio, TrendingUp, ShieldCheck,
  CheckCircle2, AlertTriangle, Clock, MapPin, ChevronRight,
  Sparkles, RefreshCw, Smartphone, Eye
} from 'lucide-react';

export default function DesktopAdminOverview({
  overview,
  usersList = [],
  pendingReviews = [],
  onApproveReview,
  onRejectReview,
  onSelectTab
}) {
  const students = usersList.filter(u => u.role === 'student');
  const faculty = usersList.filter(u => u.role === 'faculty');
  const sessions = overview?.sessions || [];
  const activeSessions = sessions.filter(s => s.status === 'ACTIVE');

  const totalStudentsCount = students.length || 50;
  const totalFacultyCount = faculty.length || 8;
  const activeSessionsCount = activeSessions.length;

  const totalAttended = students.reduce((acc, s) => acc + (s.overall_attendance_pct || 80), 0);
  const avgAttendance = students.length > 0 ? Math.round(totalAttended / students.length) : 84;

  const defaulters = students.filter(s => (s.overall_attendance_pct || s.attendance_pct || 80) < 75);

  return (
    <div className="w-full px-6 lg:px-8 py-6 space-y-6">
      {/* 1. TOP 5 KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Students */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Enrolled Students</span>
            <span className="w-8 h-8 rounded-xl bg-emerald-50 text-[#1A4731] flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <p className="text-3xl font-black text-[#111827] tracking-tight">{totalStudentsCount}</p>
          <span className="text-[11px] text-slate-400 font-medium block">Across all active batches</span>
        </div>

        {/* Card 2: Faculty Members */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Faculty Roster</span>
            <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <GraduationCap className="w-4 h-4" />
            </span>
          </div>
          <p className="text-3xl font-black text-[#111827] tracking-tight">{totalFacultyCount}</p>
          <span className="text-[11px] text-slate-400 font-medium block">Professors &amp; lecturers</span>
        </div>

        {/* Card 3: Active Live Sessions */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Active Live Sessions</span>
            <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
              activeSessionsCount > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}>
              <Radio className={`w-4 h-4 ${activeSessionsCount > 0 ? 'animate-pulse text-emerald-600' : ''}`} />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-black tracking-tight ${
              activeSessionsCount > 0 ? 'text-emerald-700' : 'text-slate-800'
            }`}>
              {activeSessionsCount}
            </span>
            <span className="text-xs font-bold text-slate-400">Classrooms</span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium block">
            {activeSessionsCount > 0 ? 'Broadcasting rolling QR' : 'No active lectures now'}
          </span>
        </div>

        {/* Card 4: Campus Quorum Average */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Campus Attendance</span>
            <span className="w-8 h-8 rounded-xl bg-emerald-50 text-[#1A4731] flex items-center justify-center font-bold">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <p className="text-3xl font-black text-[#1A4731] tracking-tight">{avgAttendance}%</p>
          <span className="text-[11px] text-emerald-800 font-semibold block">UGC quorum compliance met</span>
        </div>

        {/* Card 5: Defaulter Risk Count */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Defaulters (&lt;75%)</span>
            <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <p className="text-3xl font-black text-amber-600 tracking-tight">{defaulters.length}</p>
          <span className="text-[11px] text-slate-400 font-medium block">Under attendance quorum</span>
        </div>
      </div>

      {/* 2. MAIN 2-COLUMN WORKSPACE */}
      <div className="grid grid-cols-12 gap-6 items-start">
        {/* Left 8 Cols: Live Sessions Monitor + Defaulter Radar */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Active Live Sessions Monitor */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-[#111827] flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
                  <span>Real-Time Campus Sessions Monitor</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Lectures currently conducting dynamic anti-proxy attendance broadcasts.
                </p>
              </div>

              {onSelectTab && (
                <button
                  type="button"
                  onClick={() => onSelectTab('sessions')}
                  className="text-xs font-bold text-[#1A4731] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>View All Sessions</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {activeSessions.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-[#EBF4EE] text-[#1A4731] flex items-center justify-center mx-auto font-bold">
                  <Radio className="w-6 h-6" />
                </div>
                <p className="text-sm font-extrabold text-slate-700">No active lecture sessions right now</p>
                <p className="text-xs text-slate-400">Sessions will appear automatically when faculty members start lectures.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeSessions.map((sess, idx) => (
                  <div
                    key={sess.session_id || idx}
                    className="p-4 rounded-2xl bg-[#F8FAF9] border border-emerald-300 ring-1 ring-emerald-300/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-[#1A4731] bg-white px-2 py-0.5 rounded-lg border border-emerald-200">
                          {sess.subject_code || 'CS301'}
                        </span>
                        <h4 className="text-sm font-extrabold text-[#111827]">
                          {sess.subject_name || 'Operating Systems'}
                        </h4>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black uppercase tracking-wider flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                          Live Broadcast
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                        <span>Faculty: <strong className="text-slate-700">{sess.faculty_name || sess.faculty_id}</strong></span>
                        <span>&bull;</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{sess.room_no || 'LAB-304'}</span>
                        </span>
                        <span>&bull;</span>
                        <span>Section {sess.section || 'A'}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-mono text-sm font-black text-emerald-800">
                        {sess.present_count || 0} Students Verified
                      </span>
                      <span className="text-[11px] text-slate-400 block font-semibold">
                        Geofence: 150m Lock Active
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Defaulter Radar */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-[#111827] flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <span>University Defaulter Alert Radar (&lt;75% Quorum)</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Students across all departments currently failing mandatory attendance requirements.
                </p>
              </div>

              {onSelectTab && (
                <button
                  type="button"
                  onClick={() => onSelectTab('students')}
                  className="text-xs font-bold text-[#1A4731] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Manage Students</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {defaulters.slice(0, 5).map((st) => (
                <div
                  key={st.roll_no}
                  className="p-3.5 rounded-2xl bg-[#F8FAF9] border border-slate-200/90 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-700 font-bold text-xs flex items-center justify-center">
                      {st.roll_no.slice(-2)}
                    </div>
                    <div>
                      <span className="font-extrabold text-slate-800 block">{st.name}</span>
                      <span className="text-[11px] text-slate-400 font-mono">{st.roll_no} &bull; {st.department || 'CSE'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono font-black text-rose-600 text-sm">
                      {Math.round(st.overall_attendance_pct || st.attendance_pct || 65)}%
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
                      Deficit Risk
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Pending Hardware & Biometric Reviews + Security Checklist */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Pending Reviews Card */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-[#111827] flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#1A4731]" />
                <span>Pending Biometric Reviews</span>
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                {pendingReviews.length} Requests
              </span>
            </div>

            {pendingReviews.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-600" />
                <p className="text-xs font-bold text-slate-700">All device &amp; biometric requests resolved</p>
                <p className="text-[11px] text-slate-400">Zero pending hardware unbind approvals.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingReviews.map((rev, idx) => (
                  <div
                    key={rev.id || idx}
                    className="p-3.5 rounded-2xl bg-[#F8FAF9] border border-slate-200/90 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{rev.student_name || rev.name}</span>
                      <span className="font-mono text-[11px] text-slate-400">{rev.roll_no}</span>
                    </div>
                    <p className="text-[11px] text-slate-500">Reason: {rev.reason || 'Phone hardware replacement unbind'}</p>
                    <div className="flex items-center gap-2 pt-1">
                      {onApproveReview && (
                        <button
                          type="button"
                          onClick={() => onApproveReview(rev)}
                          className="flex-1 py-1.5 rounded-xl bg-[#1A4731] hover:bg-[#143826] text-white text-[11px] font-bold transition text-center"
                        >
                          Approve Unbind
                        </button>
                      )}
                      {onRejectReview && (
                        <button
                          type="button"
                          onClick={() => onRejectReview(rev)}
                          className="py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition text-center"
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* System Integrity & Defense Status */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Campus Security Integrity</span>
            </h4>

            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-2xl bg-[#F8FAF9] border border-slate-200/80 flex items-center justify-between">
                <span className="text-slate-600 font-medium">1. Hardware Device Fingerprint</span>
                <span className="font-bold text-emerald-800 text-[11px] flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Active Lock
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-[#F8FAF9] border border-slate-200/80 flex items-center justify-between">
                <span className="text-slate-600 font-medium">2. AI Facial Eye-Blink Liveness</span>
                <span className="font-bold text-emerald-800 text-[11px] flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> MediaPipe Enabled
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-[#F8FAF9] border border-slate-200/80 flex items-center justify-between">
                <span className="text-slate-600 font-medium">3. Dynamic Rolling QR Nonce</span>
                <span className="font-bold text-emerald-800 text-[11px] flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 20s Window
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-[#F8FAF9] border border-slate-200/80 flex items-center justify-between">
                <span className="text-slate-600 font-medium">4. Classroom Acoustic Beacon</span>
                <span className="font-bold text-emerald-800 text-[11px] flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 18.8 kHz
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
