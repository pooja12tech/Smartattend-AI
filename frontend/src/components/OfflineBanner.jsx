import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

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
    <div
      role="status"
      aria-live="assertive"
      className="sticky top-0 z-50 bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-center text-xs text-amber-900 flex items-center justify-center gap-2 shadow-sm"
    >
      <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
      <span className="font-medium">
        <strong>Offline Mode:</strong> Internet connection lost. Real-time biometric attendance and dynamic QR verification require an active connection.
      </span>
    </div>
  );
}
