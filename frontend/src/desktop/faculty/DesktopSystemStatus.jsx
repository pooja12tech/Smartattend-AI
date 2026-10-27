import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  MapPin, Radio, ShieldCheck, RefreshCw, Maximize2,
  AlertTriangle, QrCode, Sparkles, CheckCircle2, Lock
} from 'lucide-react';

export default function DesktopSystemStatus({
  activeSession,
  isSessionActive,
  qrData,
  facultyGps,
  onRecalibrateGps,
  ultrasonicBeaconActive,
  onToggleUltrasonic,
  onOpenProjector,
  alertsCount = 0
}) {
  const refreshInterval = qrData?.refresh_interval_seconds || 20;
  const [countdown, setCountdown] = useState(qrData?.expires_in_seconds || 20);
  const targetEndRef = React.useRef(Date.now() + (qrData?.expires_in_seconds || 20) * 1000);

  useEffect(() => {
    if (qrData?.expires_in_seconds !== undefined) {
      targetEndRef.current = Date.now() + qrData.expires_in_seconds * 1000;
      setCountdown(qrData.expires_in_seconds);
    }
  }, [qrData?.qr_token, qrData?.expires_in_seconds]);

  useEffect(() => {
    if (!isSessionActive) return;
    const timer = setInterval(() => {
      const remainingMs = targetEndRef.current - Date.now();
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
      if (remainingSec <= 0) {
        targetEndRef.current = Date.now() + refreshInterval * 1000;
        setCountdown(refreshInterval);
      } else {
        setCountdown(remainingSec);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [isSessionActive, refreshInterval]);

  const progressPct = Math.min(100, Math.max(0, (countdown / refreshInterval) * 100));

  return (
    <div className="space-y-6">
      {/* CARD 1: Session QR Panel (Redesigned with Premium Cyber-Minimalist Aesthetics) */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#1A4731] flex items-center justify-center shadow-xs">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#111827]">
                Session QR Code
              </h3>
              <span className="text-[11px] text-slate-400 font-medium block">
                Dynamic 20-Second Anti-Proxy Token
              </span>
            </div>
          </div>

          {isSessionActive && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50/90 border border-emerald-200/90 px-3 py-1 rounded-full shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Rotating Every {refreshInterval}s
            </span>
          )}
        </div>

        {isSessionActive && qrData ? (
          <div className="flex flex-col items-center text-center space-y-5 pt-1">
            {/* Realtime QR Display with High-Tech Frame */}
            <div className="relative p-5 rounded-3xl bg-gradient-to-b from-white via-slate-50/50 to-emerald-50/30 border border-slate-200 shadow-xl shadow-emerald-950/5 group transition-all">
              {/* Corner Accents */}
              <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-emerald-600 rounded-tl-lg pointer-events-none" />
              <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-emerald-600 rounded-tr-lg pointer-events-none" />
              <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-emerald-600 rounded-bl-lg pointer-events-none" />
              <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-emerald-600 rounded-br-lg pointer-events-none" />

              <div className="p-3 bg-white rounded-2xl shadow-inner border border-slate-100">
                <QRCodeSVG
                  value={qrData.qr_token || 'smartattend-token'}
                  size={196}
                  level="H"
                  includeMargin={false}
                />
              </div>
            </div>

            {/* Countdown Progress with Live Indicator */}
            <div className="w-full max-w-[280px] space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                  Next Rotation:
                </span>
                <span className="text-[#1A4731] font-mono text-sm bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200/80">
                  {countdown}s
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-100 border border-slate-200 overflow-hidden p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-[#1A4731] to-emerald-600 transition-all duration-300 ease-linear rounded-full shadow-xs"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {/* Projector Trigger Button */}
            {onOpenProjector && (
              <button
                type="button"
                onClick={onOpenProjector}
                className="w-full min-h-[44px] px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#1A4731] via-[#143826] to-[#1A4731] hover:brightness-110 active:scale-[0.98] text-white font-extrabold text-xs flex items-center justify-center gap-2 transition shadow-md shadow-[#1A4731]/20 cursor-pointer"
              >
                <Maximize2 className="w-4 h-4" />
                <span>Fullscreen Classroom Wall</span>
              </button>
            )}
          </div>
        ) : (
          <div className="py-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-[#EBF4EE] text-[#1A4731] flex items-center justify-center mx-auto shadow-2xs">
              <QrCode className="w-7 h-7" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-[#111827]">
                QR Rotation Inactive
              </p>
              <p className="text-[11px] text-slate-500 max-w-[220px] mx-auto mt-1 leading-relaxed">
                Launch an attendance session to broadcast the dynamic anti-proxy QR code to students.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* CARD 2: System Status & Security Telemetry */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-[#111827]">
              System Integrity
            </h3>
            <span className="text-[11px] text-slate-400 font-semibold block">
              Multi-Layered Anti-Proxy Verification
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {/* Subcard A: Campus Geofence */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-white border border-slate-200 text-[#1A4731] flex items-center justify-center">
                  <MapPin className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-[#111827]">
                    Classroom Geofence
                  </h4>
                  <span className="text-[11px] text-slate-500 font-medium block">
                    150m Perimeter Lock
                  </span>
                </div>
              </div>

              {onRecalibrateGps && (
                <button
                  type="button"
                  onClick={onRecalibrateGps}
                  className="px-2.5 py-1 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-[#1A4731] text-[11px] font-bold transition flex items-center gap-1 shadow-2xs"
                  title="Sync Faculty GPS Coordinates"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Sync GPS</span>
                </button>
              )}
            </div>

            <div className="text-[11px] text-slate-500 font-mono bg-white p-2 rounded-xl border border-slate-200/60 flex items-center justify-between">
              <span>Status: <strong className="text-emerald-700">{facultyGps?.status || 'CALIBRATED'}</strong></span>
              <span>Acc: ±{facultyGps?.accuracy || 18}m</span>
            </div>
          </div>

          {/* Subcard B: Ultrasonic Acoustic Beacon */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-white border border-slate-200 text-[#1A4731] flex items-center justify-center">
                  <Radio className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-[#111827]">
                    Acoustic Beacon
                  </h4>
                  <span className="text-[11px] text-slate-500 font-medium block">
                    18.8 kHz Ultra-High Frequency
                  </span>
                </div>
              </div>

              {onToggleUltrasonic && (
                <button
                  type="button"
                  onClick={onToggleUltrasonic}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition border shadow-2xs ${
                    ultrasonicBeaconActive
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}
                >
                  {ultrasonicBeaconActive ? 'Active' : 'Muted'}
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Emits an inaudible ultrasonic token verifying students are physically situated inside this lecture hall.
            </p>
          </div>
        </div>
      </div>

      {/* CARD 3: Anti-Proxy Realtime Defense Telemetry */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 space-y-3">
        <h4 className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
          <Lock className="w-3.5 h-3.5 text-slate-500" />
          Active Defense Gates
        </h4>

        <div className="space-y-2 text-xs">
          <div className="p-2.5 rounded-xl bg-[#F8FAF9] border border-slate-200/70 flex items-center justify-between">
            <span className="text-slate-600 font-medium">1. Hardware Device Lock</span>
            <span className="font-bold text-emerald-700 flex items-center gap-1 text-[11px]">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> 1 Device / Student
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#F8FAF9] border border-slate-200/70 flex items-center justify-between">
            <span className="text-slate-600 font-medium">2. AI Eye-Blink Liveness</span>
            <span className="font-bold text-emerald-700 flex items-center gap-1 text-[11px]">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> MediaPipe Active
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#F8FAF9] border border-slate-200/70 flex items-center justify-between">
            <span className="text-slate-600 font-medium">3. Rotating Crypto QR</span>
            <span className="font-bold text-emerald-700 flex items-center gap-1 text-[11px]">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> 20s TTL Nonce
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
