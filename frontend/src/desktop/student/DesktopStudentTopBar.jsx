import React from 'react';
import {
  GraduationCap, Home, CalendarDays, CheckSquare, History, User,
  QrCode, Bell, LogOut, ArrowRightLeft, Sparkles
} from 'lucide-react';

export default function DesktopStudentTopBar({
  user,
  currentView,
  onNavigate,
  activeSession,
  onStartScan,
  unreadCount = 0,
  onOpenNotifications,
  onLogout
}) {
  const firstName = user?.name ? user.name.split(' ')[0] : 'Student';
  const rollNo = user?.roll_no || 'STU01';
  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'ST';

  const navTabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'classes', label: 'Classes & Timetable', icon: CalendarDays },
    { id: 'attendance', label: 'Subject Attendance', icon: CheckSquare },
    { id: 'history', label: 'Attendance History', icon: History },
    { id: 'profile', label: 'Profile & Settings', icon: User }
  ];

  const getActiveTab = () => {
    if (currentView === 'home' || currentView === 'active-session') return 'home';
    if (currentView === 'classes') return 'classes';
    if (currentView === 'attendance' || currentView === 'subject-attendance') return 'attendance';
    if (currentView === 'history') return 'history';
    if (['profile', 'personal-info', 'academic-details', 'settings'].includes(currentView)) return 'profile';
    return 'home';
  };

  const activeTabId = getActiveTab();

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand & Portal Badge */}
        <div className="flex items-center gap-3 shrink-0">
          <img
            src="/smartattend_tile.png"
            alt="SmartAttend Logo"
            className="w-10 h-10 object-contain shrink-0 drop-shadow-xs"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold text-[#111827] tracking-tight">
                SmartAttend
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EBF4EE] text-[#1A4731] border border-[#1A4731]/15 tracking-wide uppercase">
                Student
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium">
              {user?.department || 'Computer Science'} &bull; Sem {user?.semester || '6'}
            </p>
          </div>
        </div>

        {/* Center: Desktop Navigation Tabs */}
        <nav className="hidden lg:flex items-center gap-1 bg-[#F8FAF9] p-1 rounded-2xl border border-slate-200/80" aria-label="Student Navigation">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTabId === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  if (tab.id === 'home') onNavigate('home');
                  else if (tab.id === 'classes') onNavigate('classes');
                  else if (tab.id === 'attendance') onNavigate('subject-attendance');
                  else if (tab.id === 'history') onNavigate('history');
                  else if (tab.id === 'profile') onNavigate('profile');
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white text-[#1A4731] shadow-xs border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'stroke-[2.4] text-[#1A4731]' : 'stroke-[1.8] text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Actions, Scan CTA, User Profile */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Live Session Active Indicator */}
          {activeSession && (
            <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live: {activeSession.subject_code || activeSession.subject_name || 'Active Class'}</span>
            </div>
          )}

          {/* Quick Scan Attendance CTA */}
          <button
            type="button"
            id="desktop-scan-button"
            onClick={onStartScan}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#1A4731] to-[#143826] hover:from-[#143826] hover:to-[#0E271B] active:scale-95 text-white text-xs font-extrabold shadow-sm shadow-[#1A4731]/30 transition cursor-pointer"
            title="Scan Dynamic Rolling QR Attendance"
          >
            <QrCode className="w-4 h-4 stroke-[2.2]" />
            <span>Quick Scan</span>
          </button>

          {/* Notifications Bell */}
          <button
            type="button"
            onClick={onOpenNotifications}
            className="relative p-2 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 transition cursor-pointer"
            title="View Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-xs">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* User Profile Chip */}
          <div className="flex items-center gap-2 pl-1 border-l border-slate-200">
            <button
              type="button"
              onClick={() => onNavigate('profile')}
              className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-100 transition text-left cursor-pointer"
              title="Open My Profile"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 font-extrabold text-xs flex items-center justify-center">
                {initials}
              </div>
              <div className="hidden sm:block">
                <span className="text-xs font-bold text-[#111827] block leading-tight">
                  {firstName}
                </span>
                <span className="text-[10px] font-mono text-slate-500 block leading-tight">
                  {rollNo}
                </span>
              </div>
            </button>

            {/* Logout Button */}
            <button
              type="button"
              onClick={onLogout}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Sub-navigation bar for medium screens (tablets / 768px - 1024px) */}
      <div className="lg:hidden flex items-center gap-1 px-4 py-2 bg-[#F8FAF9] border-t border-slate-200/60 overflow-x-auto">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTabId === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                if (tab.id === 'home') onNavigate('home');
                else if (tab.id === 'classes') onNavigate('classes');
                else if (tab.id === 'attendance') onNavigate('subject-attendance');
                else if (tab.id === 'history') onNavigate('history');
                else if (tab.id === 'profile') onNavigate('profile');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                isActive
                  ? 'bg-white text-[#1A4731] shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'stroke-[2.4] text-[#1A4731]' : 'stroke-[1.8] text-slate-500'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
