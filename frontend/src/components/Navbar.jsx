import React, { useState, useEffect } from 'react';
import { ShieldCheck, LogOut, Smartphone, User, Sparkles, Radio, Download } from 'lucide-react';
import { isAppInstalled, isInstallPromptAvailable, promptPwaInstall } from '../pwa/pwaManager';

export default function Navbar({ currentUser, onLogout, backendOnline }) {
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const updateInstallState = () => {
      setCanInstall(isInstallPromptAvailable() && !isAppInstalled());
    };

    updateInstallState();
    window.addEventListener('pwa-installable-changed', updateInstallState);
    return () => window.removeEventListener('pwa-installable-changed', updateInstallState);
  }, []);

  const handleInstallClick = async () => {
    const result = await promptPwaInstall();
    if (result && result.outcome === 'accepted') {
      setCanInstall(false);
    }
  };

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
          <img
            src="/smartattend_logo.png"
            alt="SmartAttend Logo"
            className="w-10 h-10 object-contain shrink-0"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-white">SmartAttend</span>
              <span className="text-xs font-black px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30">AI</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium hidden sm:block">Anti-Proxy & ML-Driven Attendance</p>
          </div>
        </div>

        {/* Center: Live Status Indicator */}
        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
            <Radio className={`w-3.5 h-3.5 ${backendOnline ? 'text-emerald-400 animate-pulse' : 'text-rose-400'}`} />
            <span className={backendOnline ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
              {backendOnline ? 'Backend Online (Port 8000)' : 'Backend Disconnected'}
            </span>
          </div>
        </div>

        {/* Right: Install App Button, User Profile & Logout */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* PWA Install Button (subtle, shown when browser supports install and not yet standalone) */}
          {canInstall && (
            <button
              onClick={handleInstallClick}
              title="Install SmartAttend as Progressive Web App"
              className="px-2.5 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm animate-pulse"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Install App</span>
            </button>
          )}

          {currentUser ? (
            <>
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
            </>
          ) : (
            <div className="text-xs text-slate-400 font-medium">Please sign in to continue</div>
          )}
        </div>

      </div>
    </header>
  );
}
