import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export const showToast = (message, type = 'info') => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('smartattend:toast', {
        detail: {
          id: Date.now() + Math.random(),
          message: typeof message === 'string' ? message : JSON.stringify(message),
          type
        }
      })
    );
  }
};

export const toast = {
  info: (msg) => showToast(msg, 'info'),
  success: (msg) => showToast(msg, 'success'),
  error: (msg) => showToast(msg, 'error'),
  warning: (msg) => showToast(msg, 'warning')
};

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleToast = (e) => {
      const newToast = e.detail;
      setToasts((prev) => [...prev.slice(-3), newToast]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, 4000);
    };

    window.addEventListener('smartattend:toast', handleToast);
    return () => window.removeEventListener('smartattend:toast', handleToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 inset-x-0 z-[100] flex flex-col items-center pointer-events-none gap-2 px-4 select-none">
      {toasts.map((t) => {
        const isSuccess = t.type === 'success';
        const isError = t.type === 'error';
        const isWarning = t.type === 'warning';

        return (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            className={`pointer-events-auto max-w-sm w-full py-3 px-4 rounded-2xl shadow-xl flex items-center justify-between gap-3 text-xs font-semibold animate-in fade-in slide-in-from-top-3 duration-200 ${
              isSuccess
                ? 'bg-[#1A4731] text-white border border-emerald-600/50 shadow-emerald-950/20'
                : isError
                ? 'bg-rose-900 text-rose-50 border border-rose-700/60 shadow-rose-950/20'
                : isWarning
                ? 'bg-amber-900 text-amber-50 border border-amber-700/60 shadow-amber-950/20'
                : 'bg-slate-900 text-slate-50 border border-slate-700/60 shadow-black/20'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
              {isError && <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
              {isWarning && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
              {!isSuccess && !isError && !isWarning && <Info className="w-4 h-4 text-slate-400 shrink-0" />}
              <span className="truncate">{t.message}</span>
            </div>

            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
              className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition shrink-0 cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default toast;
