import React, { useState, useEffect } from 'react';
import { WifiOff, AlertTriangle } from 'lucide-react';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="bg-rose-500/15 border-b border-rose-500/30 px-4 py-2 text-center text-xs text-rose-300 flex items-center justify-center gap-2 z-40 sticky top-16 backdrop-blur-md">
      <WifiOff className="w-4 h-4 text-rose-400 shrink-0 animate-pulse" />
      <span className="font-medium">
        <strong>Offline Mode:</strong> Internet connection lost. Real-time biometric attendance and dynamic QR verification require an active network connection.
      </span>
    </div>
  );
}
