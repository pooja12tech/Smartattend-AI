import React from 'react';
import {
  GraduationCap, Home, CalendarDays, CheckSquare, User,
  Smartphone, LogOut, ArrowRightLeft, Sparkles, QrCode
} from 'lucide-react';

export default function DesktopStudentSidebar({
  user,
  currentView,
  onNavigate,
  onTriggerScanNotice,
  onLogout
}) {
  const firstName = user?.name || 'Aarav Sharma';
  const rollNo = user?.roll_no || 'STU01';
  const department = user?.department || 'CSE';
  const semester = user?.semester || 6;
  const initials = firstName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const navItems = [
    { id: 'home', label: 'Dashboard', icon: Home },
    { id: 'classes', label: 'Classes & Timetable', icon: CalendarDays },
    { id: 'attendance', label: 'Attendance Breakdown', icon: CheckSquare },
    { id: 'profile', label: 'Student Profile', icon: User }
  ];

  const getActiveTab = () => {
    if (currentView === 'home' || currentView === 'active-session') return 'home';
    if (currentView === 'classes') return 'classes';
    if (currentView === 'attendance' || currentView === 'subject-attendance' || currentView === 'history') return 'attendance';
    if (['profile', 'personal-info', 'academic-details', 'settings'].includes(currentView)) return 'profile';
    return 'home';
  };

  const activeId = getActiveTab();

  return (
    <aside
      className="w-64 bg-white border-r border-slate-200/90 flex flex-col justify-between shrink-0 select-none min-h-screen"
      aria-label="Student Navigation Sidebar"
    >
      {/* Top Brand & Profile */}
      <div className="p-5 space-y-6">
        {/* Brand Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#1A4731] text-white flex items-center justify-center shadow-xs">
            <GraduationCap className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold text-[#111827] tracking-tight">
                SmartAttend
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EBF4EE] text-[#1A4731] border border-[#1A4731]/15 uppercase tracking-wide">
                Student
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Campus Attendance Portal</p>
          </div>
        </div>

        {/* Student Mini Profile Card */}
        <div className="p-3.5 rounded-2xl bg-[#F8FAF9] border border-slate-200/90 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-800 font-extrabold text-xs flex items-center justify-center shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <span className="font-bold text-xs text-[#111827] block truncate leading-tight">
              {firstName}
            </span>
            <span className="text-[11px] font-mono font-medium text-slate-500 block leading-tight mt-0.5">
              {rollNo} &bull; {department} Sem {semester}
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1.5" aria-label="Student Menu">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 block">
            Navigation
          </span>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeId === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'home') onNavigate('home');
                  else if (item.id === 'classes') onNavigate('classes');
                  else if (item.id === 'attendance') onNavigate('subject-attendance');
                  else if (item.id === 'profile') onNavigate('profile');
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                  isActive
                    ? 'bg-[#1A4731] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'stroke-[2.4] text-white' : 'stroke-[1.8] text-slate-400'
                  }`}
                />
                <span className="truncate">{item.label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-300" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Mark Attendance Notice Action */}
        <div className="pt-2">
          <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 space-y-2.5">
            <div className="flex items-center gap-2 text-amber-800 text-xs font-bold">
              <Smartphone className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Mark Attendance</span>
            </div>
            <p className="text-[11px] text-amber-900/80 leading-relaxed font-medium">
              Attendance can only be scanned and verified using the phone PWA.
            </p>
            <button
              type="button"
              onClick={onTriggerScanNotice}
              className="w-full py-2 rounded-xl bg-white hover:bg-amber-100/60 text-amber-900 border border-amber-300 font-bold text-[11px] transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <QrCode className="w-3.5 h-3.5 text-amber-700" />
              <span>How to Scan</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Footer: Sign Out */}
      <div className="p-5 border-t border-slate-100">

        {/* Logout Button */}
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition cursor-pointer"
        >
          <LogOut className="w-4 h-4 text-rose-600" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
