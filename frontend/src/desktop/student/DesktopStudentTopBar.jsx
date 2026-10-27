import React, { useState } from 'react';
import {
  Search, Bell, Smartphone, User, LogOut, ChevronDown
} from 'lucide-react';
import InstallAppButton from '../../components/InstallAppButton';

export default function DesktopStudentTopBar({
  user,
  onTriggerScanNotice,
  onOpenNotifications,
  onOpenProfile,
  onLogout,
  unreadCount = 0
}) {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const studentName = user?.name || 'Student';
  const rollNo = user?.roll_no || 'STU01';
  const dept = user?.department || 'CSE';
  const semester = user?.semester || 6;
  const initials = studentName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const todayFormattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });

  return (
    <header className="h-16 bg-white border-b border-slate-200/90 px-6 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Left: Greeting + Student details */}
      <div className="flex flex-col text-left">
        <div className="flex items-center gap-1.5">
          <h1 className="text-sm font-extrabold text-[#111827] tracking-tight truncate">
            {getGreeting()}, {studentName.split(' ')[0]}!
          </h1>
          <span className="text-sm">👋</span>
        </div>
        <p className="text-[11px] text-slate-500 font-medium truncate">
          {todayFormattedDate} &bull; {dept} Sem {semester}
        </p>
      </div>

      {/* Center: Search input */}
      <div className="hidden md:flex items-center flex-1 max-w-md mx-6">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search classes, subjects, attendance logs..."
            aria-label="Search"
            className="w-full bg-slate-50/90 border border-slate-200/80 rounded-2xl pl-9 pr-14 py-2 text-xs text-[#111827] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1A4731]/30 focus:border-[#1A4731] transition"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono bg-white border border-slate-200 text-slate-400 px-1.5 py-0.5 rounded shadow-2xs">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right: Phone Notice Pill, Notification Bell, Profile Menu */}
      <div className="flex items-center gap-3">
        {/* Visible "Use phone to mark attendance" Pill */}
        <button
          type="button"
          onClick={onTriggerScanNotice}
          className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition cursor-pointer shadow-2xs"
          title="Attendance can only be scanned and marked on mobile"
        >
          <Smartphone className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <span className="truncate">Use phone to mark attendance</span>
        </button>

        {/* PWA Install App Button */}
        <InstallAppButton />

        {/* Notifications Bell with Badge */}
        <button
          type="button"
          onClick={onOpenNotifications}
          className="relative p-2.5 rounded-2xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
          title="Student Notifications"
          aria-label="Student Notifications"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[11px] font-extrabold flex items-center justify-center ring-2 ring-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Profile Avatar / Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className="flex items-center gap-2 p-1 pl-2 rounded-2xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition min-h-[44px] cursor-pointer"
            aria-expanded={profileDropdownOpen}
            aria-haspopup="true"
          >
            <div className="w-8 h-8 rounded-xl bg-[#EBF4EE] text-[#1A4731] font-extrabold text-xs flex items-center justify-center">
              {initials}
            </div>
            <div className="hidden xl:block text-left pr-1">
              <span className="text-xs font-extrabold text-[#111827] block leading-tight truncate max-w-[120px]">
                {studentName}
              </span>
              <span className="text-[11px] font-mono text-slate-500 block leading-tight">
                {rollNo}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 mr-1 hidden sm:block" />
          </button>

          {/* Profile Dropdown Menu */}
          {profileDropdownOpen && (
            <div
              className="absolute right-0 mt-2 w-56 rounded-2xl bg-white border border-slate-200 shadow-xl py-2 z-50 text-xs animate-in fade-in zoom-in-95"
              role="menu"
            >
              <div className="px-4 py-2 border-b border-slate-100">
                <span className="font-bold text-slate-900 block truncate">{studentName}</span>
                <span className="text-[11px] font-mono text-slate-500 block truncate">{rollNo}</span>
              </div>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setProfileDropdownOpen(false);
                  onOpenProfile?.();
                }}
                className="w-full text-left px-4 py-2 hover:bg-slate-50 font-medium text-slate-700 flex items-center gap-2 cursor-pointer"
              >
                <User className="w-4 h-4 text-slate-400" />
                <span>Student Profile &amp; Settings</span>
              </button>

              <div className="border-t border-slate-100 my-1" />

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setProfileDropdownOpen(false);
                  onLogout?.();
                }}
                className="w-full text-left px-4 py-2 hover:bg-rose-50 font-bold text-rose-600 flex items-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-rose-600" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
