import React from 'react';
import { Home, Users, GraduationCap, CalendarCheck, Sliders, Bell } from 'lucide-react';

export default function AdminBottomNav({
  activeTab = 'home',
  onTabChange,
  pendingCount = 0,
  activeSessionsCount = 0
}) {
  const tabs = [
    {
      id: 'home',
      label: 'Home',
      icon: Home,
    },
    {
      id: 'users',
      label: 'Users',
      icon: Users,
    },
    {
      id: 'academics',
      label: 'Academics',
      icon: GraduationCap,
    },
    {
      id: 'attendance',
      label: 'Attendance',
      icon: CalendarCheck,
      badge: pendingCount > 0 ? pendingCount : null,
      activeDot: activeSessionsCount > 0
    },
    {
      id: 'more',
      label: 'More',
      icon: Sliders,
    }
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] md:hidden select-none transition-all duration-200"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
      aria-label="Admin Mobile Navigation"
    >
      <div className="max-w-md mx-auto px-2 flex items-center justify-around h-[64px]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`relative flex flex-col items-center justify-center h-full min-h-[44px] min-w-[52px] px-1 rounded-2xl transition-all duration-200 active:scale-95 cursor-pointer ${
                isActive
                  ? 'text-[#1A4731] font-bold'
                  : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive ? 'scale-110 stroke-[2.4]' : 'stroke-[1.8]'
                  }`}
                />

                {/* Badge for pending reviews */}
                {tab.badge && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-4 px-1 rounded-full bg-amber-500 text-white text-[11px] font-extrabold flex items-center justify-center ring-2 ring-white">
                    {tab.badge}
                  </span>
                )}

                {/* Pulsing dot for active live sessions */}
                {tab.activeDot && !tab.badge && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse" />
                )}
              </div>

              <span className={`text-[11px] mt-1 tracking-tight ${isActive ? 'font-extrabold text-[#1A4731]' : 'text-slate-400'}`}>
                {tab.label}
              </span>

              {/* Active Indicator Dot */}
              {isActive && (
                <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-[#1A4731] transition-all" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
