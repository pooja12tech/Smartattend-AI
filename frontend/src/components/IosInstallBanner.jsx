import React, { useState, useEffect } from 'react';
import { Share, PlusSquare, X } from 'lucide-react';
import { isIosSafari } from '../pwa/pwaManager';

export default function IosInstallBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const isDismissed = localStorage.getItem('smartattend_ios_install_dismissed') === 'true';
    if (!isDismissed && isIosSafari()) {
      setShowBanner(true);
    }

    const handleShowRequest = () => {
      setShowBanner(true);
    };

    window.addEventListener('show-ios-install-banner', handleShowRequest);
    return () => {
      window.removeEventListener('show-ios-install-banner', handleShowRequest);
    };
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('smartattend_ios_install_dismissed', 'true');
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4">
      <div className="bg-white p-4 rounded-2xl border border-[#E5E7EB] shadow-2xl text-[#111827] text-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 font-semibold text-sm text-[#111827]">
            <img src="/smartattend_logo.png" alt="SmartAttend" className="w-5 h-5 object-contain" />
            <span>Install SmartAttend-AI on iOS</span>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F8FAF9] transition"
            aria-label="Dismiss iOS install banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[#6B7280] leading-relaxed text-xs">
          Install SmartAttend-AI on your iPhone or iPad for full-screen camera and biometric attendance verification:
        </p>

        <ol className="space-y-2 text-xs font-medium bg-[#F8FAF9] p-3 rounded-xl border border-[#E5E7EB]">
          <li className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#EBF4EE] text-[#1A4731] flex items-center justify-center font-bold text-[11px] shrink-0">1</span>
            <span className="text-[#374151]">Tap the</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-white text-[#1A4731] font-semibold text-[11px] border border-[#E5E7EB] shadow-xs">
              <Share className="w-3.5 h-3.5 mr-1" /> Share
            </span>
            <span className="text-[#374151]">button in Safari</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#EBF4EE] text-[#1A4731] flex items-center justify-center font-bold text-[11px] shrink-0">2</span>
            <span className="text-[#374151]">Scroll down and tap</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-white text-[#1A4731] font-semibold text-[11px] border border-[#E5E7EB] shadow-xs">
              <PlusSquare className="w-3.5 h-3.5 mr-1" /> Add to Home Screen
            </span>
          </li>
        </ol>

        <div className="flex justify-end pt-1">
          <button
            onClick={handleDismiss}
            className="px-4 py-2 rounded-xl bg-[#1A4731] hover:bg-[#123323] text-white font-medium text-xs transition shadow-sm"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
