import React from 'react';
import { Smartphone, ShieldAlert, QrCode, CheckCircle2, X, ArrowRight, Lock } from 'lucide-react';

export default function DesktopMobileOnlyModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 relative">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          title="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon & Tag */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <img src="/smartattend_tile.png" alt="SmartAttend" className="w-11 h-11 object-contain shrink-0 drop-shadow-xs" />
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 uppercase tracking-wider">
              Anti-Proxy Security Policy
            </span>
          </div>

          <div>
            <h2 className="text-xl font-black text-[#111827] tracking-tight mt-1.5">
              Mark Attendance from Your Mobile Phone
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
              Attendance scanning is restricted to registered smartphones to verify physical classroom presence through high-precision campus GPS geofencing &amp; biometric liveness.
            </p>
          </div>
        </div>

        {/* 3 Step Guide Card */}
        <div className="p-4 rounded-2xl bg-[#F8FAF9] border border-slate-200/90 space-y-3">
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block">
            How to Mark Your Attendance:
          </span>

          <div className="space-y-2.5 text-xs text-slate-600">
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#1A4731] text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                1
              </span>
              <span>Open the <strong>SmartAttend PWA</strong> on your mobile phone.</span>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#1A4731] text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                2
              </span>
              <span>Tap the center green <strong>Scan</strong> button in the bottom navigation.</span>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#1A4731] text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                3
              </span>
              <span>Scan the faculty's rolling QR code &amp; complete the quick face verification.</span>
            </div>
          </div>
        </div>

        {/* Laptop Notice */}
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-[11px]">
          <Lock className="w-4 h-4 text-slate-400 shrink-0" />
          <span>Laptop webcams cannot mark attendance due to device verification requirements.</span>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-[#1A4731] hover:bg-[#143826] text-white font-extrabold text-xs shadow-md transition cursor-pointer"
        >
          Got it &bull; I'll Use My Phone
        </button>
      </div>
    </div>
  );
}
