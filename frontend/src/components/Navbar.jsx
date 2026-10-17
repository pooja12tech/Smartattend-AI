import React from 'react';
import { ShieldCheck, LogOut, Smartphone, User, Sparkles, Radio } from 'lucide-react';

export default function Navbar({ currentUser, onLogout, onQuickSwitchRole, backendOnline }) {
  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
            Admin Portal
          </span>
        );
      case 'faculty':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Faculty Portal
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
            Student Portal (PWA)
          </span>
        );
    }
  };

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-brand-500/30">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-white">SmartAttend</span>
              <span className="text-xs font-black px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30">AI</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium hidden sm:block">Anti-Proxy & ML-Driven Attendance</p>
          </div>
        </div>

        {/* Center: Live Status Indicator & Quick Portal Switcher (For Demos/Presentation) */}
        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
            <Radio className={`w-3.5 h-3.5 ${backendOnline ? 'text-emerald-400 animate-pulse' : 'text-rose-400'}`} />
            <span className={backendOnline ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
              {backendOnline ? 'Backend Online (Port 8000)' : 'Backend Disconnected'}
            </span>
          </div>

          {/* Quick Demo Switcher */}
          {currentUser && (
            <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800 text-xs text-slate-400">
              <span className="px-2 text-[11px] font-medium text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" /> Switch:
              </span>
              <button
                onClick={() => onQuickSwitchRole('student')}
                className={`px-2.5 py-1 rounded text-xs transition ${currentUser.role === 'student' ? 'bg-indigo-600 text-white font-semibold shadow' : 'hover:text-white hover:bg-slate-800'}`}
              >
                Student
              </button>
              <button
                onClick={() => onQuickSwitchRole('faculty')}
                className={`px-2.5 py-1 rounded text-xs transition ${currentUser.role === 'faculty' ? 'bg-emerald-600 text-white font-semibold shadow' : 'hover:text-white hover:bg-slate-800'}`}
              >
                Faculty
              </button>
              <button
                onClick={() => onQuickSwitchRole('admin')}
                className={`px-2.5 py-1 rounded text-xs transition ${currentUser.role === 'admin' ? 'bg-purple-600 text-white font-semibold shadow' : 'hover:text-white hover:bg-slate-800'}`}
              >
                Admin
              </button>
            </div>
          )}
        </div>

        {/* Right: User Profile & Logout */}
        {currentUser ? (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-200">{currentUser.name}</span>
              <span className="text-[11px] text-slate-400 font-mono">
                {currentUser.roll_no || currentUser.faculty_id || currentUser.admin_id}
              </span>
            </div>

            {getRoleBadge(currentUser.role)}

            <button
              onClick={onLogout}
              title="Logout"
              className="p-2 rounded-xl bg-slate-900/80 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/30 transition shadow-sm flex items-center gap-1.5 text-xs font-medium"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">Logout</span>
            </button>
          </div>
        ) : (
          <div className="text-xs text-slate-400 font-medium">Please sign in to continue</div>
        )}

      </div>
    </header>
  );
}
