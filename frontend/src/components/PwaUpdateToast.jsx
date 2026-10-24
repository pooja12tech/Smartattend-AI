import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, X } from 'lucide-react';
import { applyPwaUpdate, isInAttendanceFlow } from '../pwa/pwaManager';

export default function PwaUpdateToast() {
  const [updateWorker, setUpdateWorker] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleUpdate = (e) => {
      // If currently taking attendance, do not present disruptive toast
      if (!isInAttendanceFlow()) {
        setUpdateWorker(e.detail?.worker || true);
      }
    };

    window.addEventListener('pwa-update-available', handleUpdate);
    return () => window.removeEventListener('pwa-update-available', handleUpdate);
  }, []);

  if (!updateWorker || dismissed) return null;

  return (
    <div className="fixed top-18 right-4 z-50 max-w-sm animate-bounce-subtle">
      <div className="p-3.5 rounded-2xl bg-slate-900/95 border border-indigo-500/40 shadow-2xl shadow-indigo-950/80 backdrop-blur-xl text-xs flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
          <Sparkles className="w-4 h-4 animate-pulse" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-xs">New Version Available</p>
          <p className="text-[11px] text-slate-400">Update now to get the latest features.</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => applyPwaUpdate()}
            className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1 transition shadow-sm"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Update</span>
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
