import React, { useState } from 'react';
import {
  ArrowLeft, Moon, Bell, Shield, Globe, Trash2, HelpCircle,
  Info, LogOut, ChevronRight, Check, Sparkles
} from 'lucide-react';

export default function StudentSettingsView({
  onBack,
  onLogout,
  onOpenNotifications,
  onQuickSwitchRole
}) {
  const [cacheSize, setCacheSize] = useState('12.4 MB');
  const [cacheCleared, setCacheCleared] = useState(false);

  const handleClearCache = () => {
    try {
      // Clear non-critical caches
      sessionStorage.clear();
      setCacheSize('0.0 MB');
      setCacheCleared(true);
      setTimeout(() => setCacheCleared(false), 2500);
    } catch (e) {}
  };

  return (
    <div className="space-y-5">
      {/* Top Header: < Settings (Screen 19 Reference) */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-[#111827] font-extrabold text-base focus:outline-none"
        >
          <ArrowLeft className="w-5 h-5 text-slate-700" />
          <span>Settings</span>
        </button>
      </div>

      {/* Settings Menu List (Screen 19 Reference) */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden divide-y divide-slate-100 text-xs">
        {/* App Theme */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Moon className="w-4 h-4 text-slate-500" />
            <span className="font-semibold text-[#111827]">App Theme</span>
          </div>
          <span className="text-slate-500 font-medium flex items-center gap-1">
            Light <ChevronRight className="w-4 h-4 text-slate-400" />
          </span>
        </div>

        {/* Notifications */}
        <button
          type="button"
          onClick={onOpenNotifications}
          className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition"
        >
          <div className="flex items-center gap-3">
            <Bell className="w-4 h-4 text-slate-500" />
            <span className="font-semibold text-[#111827]">Notifications</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        {/* Privacy & Security */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-4 h-4 text-slate-500" />
            <span className="font-semibold text-[#111827]">Privacy & Security</span>
          </div>
          <span className="text-emerald-700 font-semibold flex items-center gap-1">
            Protected <ChevronRight className="w-4 h-4 text-slate-400" />
          </span>
        </div>

        {/* Language */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe className="w-4 h-4 text-slate-500" />
            <span className="font-semibold text-[#111827]">Language</span>
          </div>
          <span className="text-slate-500 font-medium flex items-center gap-1">
            English <ChevronRight className="w-4 h-4 text-slate-400" />
          </span>
        </div>

        {/* Clear Cache */}
        <button
          type="button"
          onClick={handleClearCache}
          className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition"
        >
          <div className="flex items-center gap-3">
            <Trash2 className="w-4 h-4 text-slate-500" />
            <span className="font-semibold text-[#111827]">Clear Cache</span>
          </div>
          <span className="text-slate-500 font-medium flex items-center gap-1">
            {cacheCleared ? (
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Cleared
              </span>
            ) : (
              cacheSize
            )}
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </span>
        </button>

        {/* Help & Support */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-4 h-4 text-slate-500" />
            <span className="font-semibold text-[#111827]">Help & Support</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>

        {/* About */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Info className="w-4 h-4 text-slate-500" />
            <span className="font-semibold text-[#111827]">About</span>
          </div>
          <span className="text-slate-400 font-mono text-[11px]">v1.0.0</span>
        </div>
      </div>

      {/* Demo / Quick Portal Switcher (For Evaluation & Defense) */}
      {onQuickSwitchRole && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Evaluation Role Switcher</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onQuickSwitchRole('student')}
              className="py-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-xs"
            >
              Student
            </button>
            <button
              type="button"
              onClick={() => onQuickSwitchRole('faculty')}
              className="py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs"
            >
              Faculty
            </button>
            <button
              type="button"
              onClick={() => onQuickSwitchRole('admin')}
              className="py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs"
            >
              Admin
            </button>
          </div>
        </div>
      )}

      {/* Red Logout Button (Screen 19 Reference) */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onLogout}
          className="w-full py-3.5 px-4 rounded-2xl bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition"
        >
          <LogOut className="w-4 h-4 text-rose-600" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
