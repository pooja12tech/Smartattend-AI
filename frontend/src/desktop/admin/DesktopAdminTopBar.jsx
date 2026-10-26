import React, { useState } from 'react';
import {
  Search, Bell, UserPlus, RefreshCw, Radio, ChevronDown,
  LogOut, Shield, CheckCircle2, User, Building2
} from 'lucide-react';

export default function DesktopAdminTopBar({
  user,
  todayFormattedDate,
  backendOnline,
  onOpenAddStudent,
  onOpenAddFaculty,
  onRefreshAll,
  onLogout
}) {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const adminName = user?.name || 'Administrator';
  const adminId = user?.admin_id || user?.id || 'ADM01';

  return (
    <header className="h-16 bg-white border-b border-slate-200/90 px-6 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Left: Heading + Date */}
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-extrabold text-[#111827] tracking-tight truncate">
            Administrator Control Center
          </h1>
          <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            ROOT
          </span>
        </div>
        <p className="text-[11px] text-slate-500 font-medium truncate">
          {todayFormattedDate} &bull; University Master Administration
        </p>
      </div>

      {/* Center: Search input */}
      <div className="hidden md:flex items-center flex-1 max-w-md mx-6">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search students, teachers, subjects, rooms..."
            aria-label="Search"
            className="w-full bg-slate-50/90 border border-slate-200/80 rounded-2xl pl-9 pr-14 py-2 text-xs text-[#111827] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1A4731]/30 focus:border-[#1A4731] transition"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono bg-white border border-slate-200 text-slate-400 px-1.5 py-0.5 rounded shadow-2xs">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right: Quick Actions, Backend Status, Profile */}
      <div className="flex items-center gap-2.5">
        {/* Backend Online status */}
        <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8FAF9] border border-slate-200 text-xs">
          <Radio className={`w-3.5 h-3.5 ${backendOnline ? 'text-emerald-500 animate-pulse' : 'text-rose-500'}`} />
          <span className={backendOnline ? 'text-emerald-800 font-bold text-[11px]' : 'text-rose-600 font-bold text-[11px]'}>
            {backendOnline ? 'FastAPI Online' : 'Offline'}
          </span>
        </div>

        {/* Action: Add Student */}
        {onOpenAddStudent && (
          <button
            type="button"
            onClick={onOpenAddStudent}
            className="px-3.5 py-2 rounded-2xl bg-[#1A4731] hover:bg-[#143826] active:scale-95 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">+ Student</span>
          </button>
        )}

        {/* Action: Add Faculty */}
        {onOpenAddFaculty && (
          <button
            type="button"
            onClick={onOpenAddFaculty}
            className="px-3.5 py-2 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 active:scale-95 text-slate-800 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5 text-[#1A4731]" />
            <span className="hidden sm:inline">+ Faculty</span>
          </button>
        )}

        {/* Refresh All */}
        {onRefreshAll && (
          <button
            type="button"
            onClick={onRefreshAll}
            className="p-2.5 rounded-2xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer"
            title="Refresh All Records"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}

        {/* Profile Avatar / Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className="flex items-center gap-2 p-1 pl-2 rounded-2xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition min-h-[44px] cursor-pointer"
            aria-expanded={profileDropdownOpen}
          >
            <div className="w-8 h-8 rounded-xl bg-[#EBF4EE] text-[#1A4731] font-extrabold text-xs flex items-center justify-center">
              AD
            </div>
            <div className="hidden xl:block text-left pr-1">
              <span className="text-xs font-extrabold text-[#111827] block leading-tight truncate max-w-[120px]">
                {adminName}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                Administrator
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Profile Dropdown Menu */}
          {profileDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="text-xs font-extrabold text-[#111827]">{adminName}</p>
                <p className="text-[11px] text-slate-400 font-mono">ID: {adminId}</p>
                <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">Master Campus Admin</p>
              </div>

              <div className="border-t border-slate-100 pt-1">
                {onLogout && (
                  <button
                    type="button"
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      onLogout();
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-rose-600" />
                    <span>Log Out of Console</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
