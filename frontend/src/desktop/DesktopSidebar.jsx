import React from 'react';
import {
  Home, CalendarDays, Users, BarChart3, User,
  ChevronLeft, ChevronRight, ShieldCheck, LogOut
} from 'lucide-react';

export default function DesktopSidebar({
  activeTab,
  onTabChange,
  collapsed,
  onToggleCollapse,
  user,
  onLogout
}) {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home, path: '/faculty/home' },
    { id: 'classes', label: 'Classes', icon: CalendarDays, path: '/faculty/classes' },
    { id: 'students', label: 'Students', icon: Users, path: '/faculty/students' },
    { id: 'reports', label: 'Reports', icon: BarChart3, path: '/faculty/reports' },
    { id: 'profile', label: 'Profile', icon: User, path: '/faculty/profile' },
  ];

  const facultyName = user?.name || 'Prof. Faculty';
  const facultyDept = user?.department || 'CSE';
  const initials = facultyName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside
      className={`sticky top-0 h-screen self-start overflow-y-auto bg-white border-r border-slate-200/90 flex flex-col justify-between shrink-0 transition-all duration-200 select-none ${
        collapsed ? 'w-20' : 'w-20 lg:w-60'
      }`}
      aria-label="Desktop Faculty Navigation"
    >
      {/* Top Branding */}
      <div>
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-3 overflow-hidden">
            <img
              src="/smartattend_logo.png"
              alt="SmartAttend Logo"
              className="w-11 h-11 object-contain shrink-0"
            />
            {!collapsed && (
              <div className="hidden lg:block truncate">
                <span className="text-sm font-extrabold text-[#111827] tracking-tight block leading-tight">
                  SmartAttend
                </span>
                <span className="text-[11px] font-bold text-emerald-800 bg-[#EBF4EE] px-1.5 py-0.5 rounded uppercase tracking-wider">
                  Faculty Console
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1.5" aria-label="Faculty Main Menu">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <a
                key={item.id}
                href={item.path}
                onClick={(e) => {
                  e.preventDefault();
                  onTabChange(item.id);
                }}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-3 rounded-2xl transition-all duration-150 group font-semibold text-xs min-h-[44px] cursor-pointer ${
                  isActive
                    ? 'bg-[#1A4731] text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <div className="w-6 h-6 flex items-center justify-center shrink-0">
                  <Icon
                    className={`w-5 h-5 transition-transform duration-150 ${
                      isActive ? 'stroke-[2.5] text-white scale-105' : 'stroke-[1.8] text-slate-500 group-hover:text-slate-800'
                    }`}
                  />
                </div>
                {!collapsed && (
                  <span className="hidden lg:inline truncate text-[13px]">
                    {item.label}
                  </span>
                )}
                {/* Active Pill Indicator */}
                {isActive && (
                  <span className="ml-auto w-1.5 h-4 rounded-full bg-emerald-400 hidden lg:block" />
                )}
              </a>
            );
          })}
        </nav>
      </div>

      {/* Footer / User Card / Protection Pill / Collapse */}
      <div className="p-3 border-t border-slate-100 space-y-2">
        {/* User Mini Profile Card */}
        {user && !collapsed && (
          <div className="hidden lg:flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="w-8 h-8 rounded-lg bg-[#EBF4EE] text-[#1A4731] font-bold text-xs flex items-center justify-center shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <span className="text-xs font-bold text-[#111827] block truncate leading-tight">
                {facultyName}
              </span>
              <span className="text-[11px] text-slate-500 truncate block">
                {facultyDept}
              </span>
            </div>
          </div>
        )}

        {!collapsed && (
          <div className="hidden lg:flex items-center gap-2 p-2 rounded-xl bg-[#EBF4EE] border border-emerald-200/60 text-[#1A4731] text-[11px] font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
            <span className="truncate">Anti-Proxy Engine Active</span>
          </div>
        )}

        {/* Logout Button */}
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            title={collapsed ? "Sign Out" : undefined}
            className={`w-full flex items-center gap-2 py-2 px-3 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition cursor-pointer ${
              collapsed ? 'justify-center' : 'justify-center lg:justify-start'
            }`}
          >
            <LogOut className="w-4 h-4 text-rose-600 shrink-0" />
            {!collapsed && <span className="hidden lg:inline">Sign Out</span>}
          </button>
        )}

        {/* Collapse Button */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition text-xs font-semibold cursor-pointer"
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          aria-label={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span className="hidden lg:inline ml-1.5">Collapse Menu</span>}
        </button>
      </div>
    </aside>
  );
}
