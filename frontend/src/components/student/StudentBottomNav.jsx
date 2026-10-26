import React from 'react';
import { Home, CalendarDays, QrCode, CheckSquare, User } from 'lucide-react';

export default function StudentBottomNav({ activeTab, onTabChange, onScanClick }) {
  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'classes', label: 'Classes', icon: CalendarDays },
    { id: 'scan', label: 'Scan', isAction: true },
    { id: 'attendance', label: 'Attendance', icon: CheckSquare },
    { id: 'profile', label: 'Profile', icon: User }
  ];

  return (
    <nav
      aria-label="Student Navigation"
      className="fixed bottom-0 inset-x-0 z-40 bg-white/98 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
        {tabs.map((tab) => {
          if (tab.isAction) {
            return (
              <div key={tab.id} className="flex-1 flex flex-col items-center justify-center">
                <button
                  type="button"
                  id="nav-scan-button"
                  onClick={onScanClick}
                  className="-mt-3.5 w-11 h-11 rounded-full bg-[#1A4731] hover:bg-[#143826] active:scale-95 text-white flex items-center justify-center shadow-md shadow-emerald-950/20 border-2 border-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#1A4731]/30"
                  title="Scan Attendance QR"
                  aria-label="Scan Attendance QR"
                >
                  <QrCode className="w-5 h-5 stroke-[2.2]" />
                </button>
                <span className="text-[10px] font-bold text-[#1A4731] mt-0.5 tracking-tight">
                  Scan
                </span>
              </div>
            );
          }

          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              id={`nav-tab-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1 transition-colors duration-150 focus:outline-none ${
                isActive ? 'text-[#1A4731]' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#1A4731]" />
                )}
              </div>
              <span className={`text-[10px] mt-1 ${isActive ? 'font-bold text-[#1A4731]' : 'font-medium'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
