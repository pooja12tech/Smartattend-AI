import React, { useState, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { applyPwaUpdate, isInAttendanceFlow } from '../pwa/pwaManager';

export default function PwaUpdateToast() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleUpdateAvailable = () => {
      // Do not display if currently in attendance flow
      if (isInAttendanceFlow()) {
        // Poll until attendance flow is exited
        const interval = setInterval(() => {
          if (!isInAttendanceFlow()) {
            clearInterval(interval);
            setUpdateAvailable(true);
          }
        }, 3000);
        return;
      }
      setUpdateAvailable(true);
    };

    window.addEventListener('pwa-update-available', handleUpdateAvailable);
    return () => {
      window.removeEventListener('pwa-update-available', handleUpdateAvailable);
    };
  }, []);

  // Guard against showing during active attendance flow
  if (!updateAvailable || dismissed || isInAttendanceFlow()) {
    return null;
  }

  const handleUpdate = () => {
    setIsUpdating(true);
    applyPwaUpdate();
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-20 left-4 right-4 sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-md z-50 bg-white border border-[#E5E7EB] rounded-2xl shadow-xl p-4 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#EBF4EE] flex items-center justify-center shrink-0 text-[#1A4731]">
          <RefreshCw className={`w-5 h-5 ${isUpdating ? 'animate-spin' : ''}`} />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <h4 className="text-sm font-semibold text-[#111827]">
            New version available
          </h4>
          <p className="text-xs text-[#6B7280] mt-0.5">
            An update to SmartAttend-AI is ready. Update now to get the latest improvements.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="inline-flex items-center justify-center px-4 py-1.5 text-xs font-medium text-white bg-[#1A4731] hover:bg-[#123323] active:bg-[#123323] rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              {isUpdating ? 'Updating...' : 'Update'}
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-[#6B7280] hover:text-[#111827] hover:bg-[#F8FAF9] rounded-lg transition-colors"
            >
              Later
            </button>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 text-[#6B7280] hover:text-[#111827] rounded-lg hover:bg-[#F8FAF9] transition-colors shrink-0"
          aria-label="Dismiss update alert"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
