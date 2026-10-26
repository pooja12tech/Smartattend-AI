import React from 'react';
import {
  ShieldCheck, LayoutDashboard, Radio, Users, GraduationCap,
  BookOpen, Calendar, History, ChevronLeft, ChevronRight,
  LogOut, ShieldAlert
} from 'lucide-react';

export default function DesktopAdminSidebar({
  activeTab,
  onTabChange,
  collapsed,
  onToggleCollapse,
  activeSessionsCount = 0,
  pendingReviewsCount = 0
}) {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, path: '/admin/overview' },
    { id: 'sessions', label: 'Live Sessions', icon: Radio, path: '/admin/sessions', badge: activeSessionsCount },
    { id: 'students', label: 'Students & Biometrics', icon: Users, path: '/admin/students', badge: pendingReviewsCount },
    { id: 'faculty', label: 'Faculty Directory', icon: GraduationCap, path: '/admin/faculty' },
    { id: 'subjects', label: 'Curriculum & Subjects', icon: BookOpen, path: '/admin/subjects' },
    { id: 'timetable', label: 'Timetable Schedules', icon: Calendar, path: '/admin/timetable' },
    { id: 'audit', label: 'Audit Trail Logs', icon: History, path: '/admin/audit' },
  ];

  return (
    <aside
      className={`bg-white border-r border-slate-200/90 flex flex-col justify-between shrink-0 transition-all duration-200 select-none ${
        collapsed ? 'w-20' : 'w-20 lg:w-64'
      }`}
      aria-label="Desktop Admin Navigation"
    >
      {/* Top Branding */}
      <div>
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-3 overflow-hidden">
            <img
              src="/smartattend_tile.png"
              alt="SmartAttend Logo"
              className="w-11 h-11 object-contain shrink-0 drop-shadow-xs"
            />
            {!collapsed && (
              <div className="hidden lg:block truncate">
                <span className="text-sm font-extrabold text-[#111827] tracking-tight block">
                  SmartAttend
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded uppercase tracking-wider">
                  Admin Console
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1.5" aria-label="Admin Main Menu">
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
                className={`flex items-center gap-3 px-3 py-3 rounded-2xl transition-all duration-150 group font-semibold text-xs min-h-[44px] ${
                  isActive
                    ? 'bg-[#EBF4EE] text-[#1A4731] font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <div className="w-6 h-6 flex items-center justify-center shrink-0">
                  <Icon
                    className={`w-5 h-5 transition-transform duration-150 ${
                      isActive ? 'stroke-[2.5] text-[#1A4731] scale-105' : 'stroke-[1.8] text-slate-500 group-hover:text-slate-800'
                    }`}
                  />
                </div>
                {!collapsed && (
                  <span className="hidden lg:inline truncate text-[13px] flex-1">
                    {item.label}
                  </span>
                )}
                {/* Active badge if count > 0 */}
                {!collapsed && item.badge > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-rose-500 text-white hidden lg:inline">
                    {item.badge}
                  </span>
                )}
                {/* Active Pill Indicator */}
                {isActive && (
                  <span className="ml-auto w-1.5 h-4 rounded-full bg-[#1A4731] hidden lg:block" />
                )}
              </a>
            );
          })}
        </nav>
      </div>

      {/* Footer / Institutional Protection Pill */}
      <div className="p-3 border-t border-slate-100 space-y-2">
        {!collapsed && (
          <div className="hidden lg:flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/60 text-emerald-800 text-[11px] font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
            <span className="truncate">Campus Master Guard Active</span>
          </div>
        )}

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
