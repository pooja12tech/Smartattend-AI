import React, { useState, useEffect } from 'react';
import { Share, PlusSquare, X, Smartphone } from 'lucide-react';
import { isIosSafari } from '../pwa/pwaManager';

export default function IosInstallBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const isDismissed = localStorage.getItem('smartattend_ios_install_dismissed') === 'true';
    if (!isDismissed && isIosSafari()) {
      setShowBanner(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('smartattend_ios_install_dismissed', 'true');
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto animate-fade-in">
      <div className="glass-panel p-4 rounded-2xl border border-indigo-500/30 shadow-2xl shadow-indigo-950/80 bg-slate-900/95 backdrop-blur-xl text-slate-200 text-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-white text-sm">
            <Smartphone className="w-4 h-4 text-indigo-400" />
            <span>Install on iOS</span>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Dismiss iOS install banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-slate-300 leading-relaxed text-[11px]">
          Install SmartAttend-AI as an app on your iPhone or iPad for full-screen camera and biometric verification:
        </p>

        <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px] font-medium bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
          <li className="flex items-center gap-1.5">
            <span>1. Tap the</span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono text-[10px] border border-slate-700">
              <Share className="w-3 h-3 mr-1" /> Share
            </span>
            <span>button in Safari</span>
          </li>
          <li className="flex items-center gap-1.5">
            <span>2. Scroll down and tap</span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono text-[10px] border border-slate-700">
              <PlusSquare className="w-3 h-3 mr-1" /> Add to Home Screen
            </span>
          </li>
        </ol>

        <div className="flex justify-end pt-1">
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-sm"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
