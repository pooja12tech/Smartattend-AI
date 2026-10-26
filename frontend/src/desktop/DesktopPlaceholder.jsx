import React from 'react';
import { Sparkles, CalendarDays, Users, BarChart3, User, ArrowLeft } from 'lucide-react';

export default function DesktopPlaceholder({ tabId, onGoHome }) {
  const meta = {
    classes: {
      title: 'Classes & Timetable Management',
      description: 'The desktop timetable grid, semester schedule planner, and slot manager is being assembled in the next phase.',
      icon: CalendarDays,
    },
    students: {
      title: 'Student Roster & Verification Directory',
      description: 'Full-table student attendance inspection, face registration status, and manual overrides are being built for desktop view.',
      icon: Users,
    },
    reports: {
      title: 'Institutional Attendance Analytics & Reports',
      description: 'Comprehensive CSV downloads, ML defaulter radar graphs, and monthly compliance summaries will be displayed here.',
      icon: BarChart3,
    },
    profile: {
      title: 'Faculty Profile & Security Settings',
      description: 'Account settings, biometric device management, and department affiliations.',
      icon: User,
    }
  }[tabId] || {
    title: 'Module In Development',
    description: 'This desktop module is planned for upcoming rollout.',
    icon: Sparkles
  };

  const Icon = meta.icon;

  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] text-center p-8">
      <div className="w-16 h-16 rounded-3xl bg-[#EBF4EE] text-[#1A4731] flex items-center justify-center mb-4 shadow-xs">
        <Icon className="w-8 h-8" />
      </div>

      <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-extrabold uppercase tracking-wider mb-2">
        Desktop Phase 2 Module
      </span>

      <h2 className="text-xl font-extrabold text-[#111827] tracking-tight mb-2">
        {meta.title}
      </h2>

      <p className="text-xs text-slate-500 max-w-md leading-relaxed mb-6">
        {meta.description}
      </p>

      <button
        type="button"
        onClick={onGoHome}
        className="px-4 py-2.5 rounded-2xl bg-[#1A4731] hover:bg-[#143826] text-white text-xs font-bold transition flex items-center gap-2 shadow-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Home Dashboard</span>
      </button>
    </div>
  );
}
