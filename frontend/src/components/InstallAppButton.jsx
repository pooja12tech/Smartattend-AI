import React, { useState, useEffect } from 'react';
import { Download, ChevronRight } from 'lucide-react';
import {
  isInstallPromptAvailable,
  isAppInstalled,
  promptPwaInstall,
  isIosSafari
} from '../pwa/pwaManager';

export default function InstallAppButton({
  variant = 'topbar',
  className = '',
  label = 'Install App'
}) {
  const [installed, setInstalled] = useState(() => isAppInstalled());
  const [installable, setInstallable] = useState(
    () => isInstallPromptAvailable() || isIosSafari()
  );

  useEffect(() => {
    const handleInstallableChange = (e) => {
      setInstalled(isAppInstalled());
      setInstallable(Boolean(e.detail?.installable || isIosSafari()));
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setInstallable(false);
    };

    window.addEventListener('pwa-installable-changed', handleInstallableChange);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('pwa-installable-changed', handleInstallableChange);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Hide if already installed or if not installable (unless iOS Safari where we can guide manual installation)
  if (installed || (!installable && !isIosSafari())) {
    return null;
  }

  const handleInstallClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (isIosSafari()) {
      window.dispatchEvent(new CustomEvent('show-ios-install-banner'));
      return;
    }

    try {
      await promptPwaInstall();
    } catch (err) {
      console.warn('[PWA] Install prompt failed:', err);
    }
  };

  if (variant === 'profile') {
    return (
      <button
        type="button"
        id="btn-install-app-profile"
        onClick={handleInstallClick}
        className={`w-full p-4 rounded-2xl bg-white border border-[#E5E7EB] hover:bg-[#F8FAF9] active:scale-[0.99] text-left shadow-xs transition flex items-center justify-between ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#EBF4EE] flex items-center justify-center text-[#1A4731]">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-xs text-[#111827]">
              {label}
            </h4>
            <p className="text-[11px] text-[#6B7280]">
              Add to Home Screen for fast, fullscreen access
            </p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-[#6B7280]" />
      </button>
    );
  }

  return (
    <button
      type="button"
      id="btn-install-app-topbar"
      onClick={handleInstallClick}
      className={`min-h-[44px] px-3.5 py-2 rounded-2xl bg-[#EBF4EE] hover:bg-[#d9ebd2] active:scale-98 text-[#1A4731] border border-[#1A4731]/20 text-xs font-semibold transition flex items-center gap-2 shadow-2xs cursor-pointer ${className}`}
      title="Install SmartAttend-AI on this device"
    >
      <Download className="w-4 h-4 text-[#1A4731] shrink-0" />
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}
