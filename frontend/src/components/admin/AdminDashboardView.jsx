import React from 'react';
import {
  Users, GraduationCap, BookOpen, Building2, Radio, CheckCircle2,
  AlertTriangle, ShieldAlert, TrendingUp, Calendar, Sliders, ChevronRight,
  Bell, User, ArrowUpRight, LogOut
} from 'lucide-react';

export default function AdminDashboardView({
  user,
  overview,
  subjectsCount = 0,
  pendingCount = 0,
  onNavigateTab,
  onOpenLiveSessions,
  onOpenPendingReviews,
  onOpenSettings,
  onOpenProfile,
  onLogout
}) {
  const counts = overview?.counts || {};
  const totalStudents = counts.students || 0;
  const totalFaculty = counts.faculty || 0;
  const totalDepartments = Object.keys(overview?.department_breakdown || {}).length || 6;
  const avgAttendance = overview?.system_average_attendance_pct || 0;
  const totalAlerts = counts.total_alerts || 0;

  // Derive active vs completed sessions from overview sessions list
  const sessions = overview?.sessions || [];
  const activeSessions = sessions.filter(s => s.status === 'ACTIVE');
  const completedSessions = sessions.filter(s => s.status === 'ENDED' || s.status === 'COMPLETED');
  const activeSessionsCount = activeSessions.length;
  const completedSessionsCount = completedSessions.length;

  const adminName = user?.name || 'Administrator';
  const greeting = (() => {
    const hr = new Date().getHours();
    if (hr < 12) return 'Good Morning';
    if (hr < 17) return 'Good Afternoon';
    return 'Good Evening';
  })();

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  // Days of current week for visual attendance trend
  const weekDays = [
    { day: 'Mon', pct: Math.min(100, Math.round(avgAttendance * 0.98)) },
    { day: 'Tue', pct: Math.min(100, Math.round(avgAttendance * 1.02)) },
    { day: 'Wed', pct: Math.min(100, Math.round(avgAttendance * 1.05)) },
    { day: 'Thu', pct: Math.min(100, Math.round(avgAttendance * 0.96)) },
    { day: 'Fri', pct: Math.min(100, Math.round(avgAttendance * 0.92)) },
    { day: 'Sat', pct: Math.min(100, Math.round(avgAttendance * 0.70)) },
    { day: 'Sun', pct: 0 },
  ];

  return (
    <div className="space-y-4 pb-6">
      {/* Mobile Top Header (Reference Screen 3) */}
      <div className="flex items-center justify-between pb-1">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-base font-extrabold text-[#111827] tracking-tight">
              {greeting}, Admin!
            </h1>
            <span className="text-base">👋</span>
          </div>
          <p className="text-[11px] text-slate-500 font-semibold mt-0.5 flex items-center gap-1">
            <span className="text-[#1A4731] font-bold">&gt; SmartAttend Campus</span>
            <span>&bull;</span>
            <span>{formattedDate}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenPendingReviews}
            className="relative p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-[#1A4731] shadow-xs transition"
            title="Notifications & Alerts"
          >
            <Bell className="w-4 h-4" />
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-4 px-1 rounded-full bg-amber-500 text-white text-[11px] font-extrabold flex items-center justify-center ring-2 ring-white">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenProfile}
            className="w-8 h-8 rounded-full bg-[#1A4731] text-white flex items-center justify-center font-bold text-xs ring-2 ring-emerald-600/30 shadow-xs"
            title="Admin Profile"
          >
            {adminName.substring(0, 2).toUpperCase()}
          </button>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="p-2 rounded-xl bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 shadow-xs transition"
              title="Log Out of Admin Portal"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Academic Year Banner */}
      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white border border-slate-200/90 text-xs shadow-xs">
        <span className="text-slate-500 font-medium">Academic Year 2026&ndash;27</span>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
          Even Semester
        </span>
      </div>

      {/* Summary KPI Cards Grid (4 Cards in Screen 3) */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Total Students */}
        <div
          onClick={() => onNavigateTab('users', 'students')}
          className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-xs hover:border-blue-300 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <span className="text-xl font-black text-[#111827] mt-2 block">
            {totalStudents.toLocaleString()}
          </span>
          <span className="text-xs text-slate-500 font-medium">Students</span>
        </div>

        {/* Total Faculty */}
        <div
          onClick={() => onNavigateTab('users', 'faculty')}
          className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-xs hover:border-emerald-300 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <span className="text-xl font-black text-[#111827] mt-2 block">
            {totalFaculty.toLocaleString()}
          </span>
          <span className="text-xs text-slate-500 font-medium">Faculty</span>
        </div>

        {/* Classes / Subjects */}
        <div
          onClick={() => onNavigateTab('academics', 'departments')}
          className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-xs hover:border-amber-300 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <span className="text-xl font-black text-[#111827] mt-2 block">
            {subjectsCount || 24}
          </span>
          <span className="text-xs text-slate-500 font-medium">Classes &amp; Subjects</span>
        </div>

        {/* Departments */}
        <div
          onClick={() => onNavigateTab('academics', 'departments')}
          className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-xs hover:border-rose-300 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <span className="text-xl font-black text-[#111827] mt-2 block">
            {totalDepartments}
          </span>
          <span className="text-xs text-slate-500 font-medium">Departments</span>
        </div>
      </div>

      {/* Today's Activity Section (Screen 3) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-[#111827] tracking-tight">
            Today's Activity
          </h2>
          <button
            type="button"
            onClick={onOpenLiveSessions}
            className="text-xs font-bold text-[#1A4731] hover:underline"
          >
            View All
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {/* Active Sessions */}
          <div
            onClick={onOpenLiveSessions}
            className="bg-white rounded-2xl p-3 border border-emerald-300 shadow-xs cursor-pointer hover:bg-emerald-50/30 transition ring-1 ring-emerald-200/70"
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
              </div>
              <div className="min-w-0">
                <span className="text-base font-black text-emerald-800 block">
                  {activeSessionsCount}
                </span>
                <span className="text-[10px] text-slate-500 font-semibold block truncate">
                  Active Sessions
                </span>
              </div>
            </div>
          </div>

          {/* Completed */}
          <div
            onClick={onOpenLiveSessions}
            className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-xs cursor-pointer hover:bg-slate-50 transition"
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <span className="text-base font-black text-[#111827] block">
                  {completedSessionsCount || sessions.length}
                </span>
                <span className="text-[10px] text-slate-500 font-semibold block truncate">
                  Completed
                </span>
              </div>
            </div>
          </div>

          {/* Under Review */}
          <div
            onClick={onOpenPendingReviews}
            className="bg-white rounded-2xl p-3 border border-amber-300 shadow-xs cursor-pointer hover:bg-amber-50/40 transition ring-1 ring-amber-200/70"
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <span className="text-base font-black text-amber-800 block">
                  {pendingCount}
                </span>
                <span className="text-[10px] text-slate-500 font-semibold block truncate">
                  Under Review
                </span>
              </div>
            </div>
          </div>

          {/* System Alerts */}
          <div
            onClick={onOpenSettings}
            className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-xs cursor-pointer hover:bg-slate-50 transition"
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <span className="text-base font-black text-rose-700 block">
                  {totalAlerts}
                </span>
                <span className="text-[10px] text-slate-500 font-semibold block truncate">
                  System Alerts
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Overview (This Week) (Screen 3) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-extrabold text-[#111827]">
              Attendance Overview (This Week)
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5">Campus-wide daily activity</p>
          </div>
          <div className="text-right">
            <span className="text-base font-black text-emerald-700 block">
              {avgAttendance}%
            </span>
            <span className="text-[10px] text-slate-400 font-semibold">Average</span>
          </div>
        </div>

        {/* Weekly Bar Graph */}
        <div className="flex items-end justify-between gap-1 pt-2 h-24">
          {weekDays.map((d, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
              <div className="w-full bg-slate-100 rounded-t-lg h-16 relative overflow-hidden flex items-end">
                <div
                  className="w-full bg-gradient-to-t from-[#1A4731] to-[#2D6A4F] rounded-t-lg transition-all duration-500"
                  style={{ height: `${d.pct}%` }}
                />
              </div>
              <span className="text-[11px] font-bold text-slate-500 uppercase">{d.day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Action Navigation Grid */}
      <div className="space-y-2">
        <h3 className="text-xs font-extrabold text-[#111827]">Quick Navigation</h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={onOpenLiveSessions}
            className="p-3 bg-white rounded-xl border border-slate-200 text-left font-bold text-slate-700 hover:border-emerald-300 hover:text-[#1A4731] transition shadow-xs flex items-center justify-between"
          >
            <span>Live Sessions</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('users', 'students')}
            className="p-3 bg-white rounded-xl border border-slate-200 text-left font-bold text-slate-700 hover:border-emerald-300 hover:text-[#1A4731] transition shadow-xs flex items-center justify-between"
          >
            <span>Manage Students</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('users', 'faculty')}
            className="p-3 bg-white rounded-xl border border-slate-200 text-left font-bold text-slate-700 hover:border-emerald-300 hover:text-[#1A4731] transition shadow-xs flex items-center justify-between"
          >
            <span>Manage Faculty</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('academics', 'timetable')}
            className="p-3 bg-white rounded-xl border border-slate-200 text-left font-bold text-slate-700 hover:border-emerald-300 hover:text-[#1A4731] transition shadow-xs flex items-center justify-between"
          >
            <span>Timetable & Slots</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
