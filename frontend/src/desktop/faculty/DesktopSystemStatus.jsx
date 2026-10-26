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
  const [countdown, setCountdown] = useState(qrData?.expires_in_seconds || 20);

  useEffect(() => {
    if (qrData?.expires_in_seconds !== undefined) {
      setCountdown(qrData.expires_in_seconds);
    }
  }, [qrData?.expires_in_seconds, qrData?.qr_token]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const refreshInterval = qrData?.refresh_interval_seconds || 20;
  const progressPct = Math.min(100, Math.max(0, (countdown / refreshInterval) * 100));

  return (
    <div className="space-y-6">
      {/* CARD 1: Session QR Panel */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#EBF4EE] text-[#1A4731] flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-extrabold text-[#111827]">
              Session QR Code
            </h3>
          </div>

          {isSessionActive && (
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              Rotating Every {refreshInterval}s
            </span>
          )}
        </div>

        {isSessionActive && qrData ? (
          <div className="flex flex-col items-center text-center space-y-4 pt-1">
            {/* Realtime QR display */}
            <div className="p-4 rounded-2xl bg-white border-2 border-slate-900 shadow-md">
              <QRCodeSVG
                value={qrData.qr_token || 'smartattend-token'}
                size={180}
                level="H"
                includeMargin={false}
              />
            </div>

            {/* Countdown progress bar */}
            <div className="w-full space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-500">Next Rotation:</span>
                <span className="text-[#1A4731] font-mono text-sm">{countdown}s</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-[#1A4731] transition-all duration-300 ease-linear rounded-full"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {/* Projector Trigger Button */}
            {onOpenProjector && (
              <button
                type="button"
                onClick={onOpenProjector}
                className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-xs"
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
            <span className="text-[10px] text-slate-400 font-semibold block">
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
                  <span className="text-[10px] text-slate-500 font-medium block">
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

            <div className="text-[10px] text-slate-500 font-mono bg-white p-2 rounded-xl border border-slate-200/60 flex items-center justify-between">
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
                  <span className="text-[10px] text-slate-500 font-medium block">
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

            <p className="text-[10px] text-slate-500 leading-relaxed">
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
