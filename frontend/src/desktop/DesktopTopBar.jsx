import React, { useState } from 'react';
import {
  Search, Bell, User, Play, Maximize2, LogOut, CheckCircle2,
  AlertTriangle, ChevronDown, Radio, Sparkles
} from 'lucide-react';
import InstallAppButton from '../components/InstallAppButton';

export default function DesktopTopBar({
  user,
  todayFormattedDate,
  isSessionActive,
  alertsCount = 0,
  onStartSessionClick,
  onOpenProjector,
  onLogout,
  onOpenProfile
}) {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const facultyName = user?.name || 'Prof. Faculty';
  const facultyDept = user?.department || 'Computer Science & Engineering';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200/90 px-6 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Left: Greeting + Date + Dept */}
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-extrabold text-[#111827] tracking-tight truncate">
            {getGreeting()}, {facultyName}
          </h1>
          <span className="text-sm">🎓</span>
        </div>
        <p className="text-[11px] text-slate-500 font-medium truncate">
          {todayFormattedDate} &bull; {facultyDept}
        </p>
      </div>

      {/* Center: Search input */}
      <div className="hidden md:flex items-center flex-1 max-w-md mx-6">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search students, subjects, room or timetable..."
            aria-label="Search"
            className="w-full bg-slate-50/90 border border-slate-200/80 rounded-2xl pl-9 pr-14 py-2 text-xs text-[#111827] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1A4731]/30 focus:border-[#1A4731] transition"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono bg-white border border-slate-200 text-slate-400 px-1.5 py-0.5 rounded shadow-2xs">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right: Actions, Alerts, Profile */}
      <div className="flex items-center gap-3">
        {/* Primary Action Button (>= 44px height for accessible mouse targets) */}
        {isSessionActive ? (
          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 text-xs font-bold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Session Live</span>
            </span>
            {onOpenProjector && (
              <button
                type="button"
                onClick={onOpenProjector}
                className="min-h-[44px] px-3.5 py-2 rounded-2xl bg-[#1A4731] hover:bg-[#123323] active:scale-98 text-white text-xs font-bold transition flex items-center gap-2 shadow-sm"
                title="Open Classroom Projector Wall"
              >
                <Maximize2 className="w-4 h-4" />
                <span className="hidden sm:inline">Projector</span>
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={onStartSessionClick}
            className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-[#1A4731] hover:bg-[#143826] active:scale-98 text-white text-xs font-bold transition flex items-center gap-2 shadow-sm shadow-[#1A4731]/20 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Start Attendance Session</span>
          </button>
        )}

        {/* PWA Install App Button */}
        <InstallAppButton />

        {/* Security / Anti-Proxy Alerts Bell */}
        <button
          type="button"
          className="relative p-2.5 rounded-2xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="System & Proxy Alerts"
          aria-label="System & Proxy Alerts"
        >
          <Bell className="w-4 h-4" />
          {alertsCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[11px] font-extrabold flex items-center justify-center ring-2 ring-white">
              {alertsCount > 9 ? '9+' : alertsCount}
            </span>
          )}
        </button>

        {/* Profile Avatar / Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className="flex items-center gap-2 p-1 pl-2 rounded-2xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition min-h-[44px]"
            aria-expanded={profileDropdownOpen}
            aria-haspopup="true"
          >
            <div className="w-8 h-8 rounded-xl bg-[#EBF4EE] text-[#1A4731] font-extrabold text-xs flex items-center justify-center">
              {facultyName.split(' ').map(n => n[0]).slice(0, 2).join('')}
            </div>
            <div className="hidden xl:block text-left pr-1">
              <span className="text-xs font-extrabold text-[#111827] block leading-tight truncate max-w-[120px]">
                {facultyName}
              </span>
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
                Faculty
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Profile Dropdown Menu */}
          {profileDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="text-xs font-extrabold text-[#111827]">{facultyName}</p>
                <p className="text-[11px] text-slate-400 truncate">{user?.email || 'faculty@smartattend.edu'}</p>
              </div>

              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    onOpenProfile?.();
                  }}
                  className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <User className="w-4 h-4 text-slate-400" />
                  <span>Faculty Profile</span>
                </button>
              </div>

              <div className="border-t border-slate-100 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    onLogout?.();
                  }}
                  className="w-full text-left px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4 text-rose-600" />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
