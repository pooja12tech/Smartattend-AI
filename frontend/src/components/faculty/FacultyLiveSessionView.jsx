import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Users, Square, RefreshCw, Radio, MapPin, Maximize2, ShieldCheck,
  AlertTriangle, Clock, ArrowLeft, CheckCircle2, AlertCircle, Sparkles
} from 'lucide-react';

export default function FacultyLiveSessionView({
  user,
  activeSession,
  qrData,
  liveData,
  roster = [],
  facultyGps,
  onRecalibrateGps,
  ultrasonicBeaconActive,
  onToggleUltrasonic,
  onOpenProjector,
  onViewRoster,
  onEndSession,
  ending = false,
  onBack
}) {
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [countdown, setCountdown] = useState(qrData?.expires_in_seconds || 20);

  // Smooth local countdown in between 2s polling ticks
  useEffect(() => {
    if (qrData?.expires_in_seconds !== undefined) {
      setCountdown(qrData.expires_in_seconds);
    }
  }, [qrData?.expires_in_seconds, qrData?.qr_token]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => (prev > 1 ? prev - 1 : 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Compute live attendance statistics
  const presentCount = roster.filter(s => s.status === 'PRESENT' || s.status === 'MANUAL_PRESENT').length;
  const pendingCount = roster.filter(s => s.status === 'PENDING_APPROVAL').length;
  const totalEnrolled = roster.length;
  const unmarkedCount = Math.max(0, totalEnrolled - presentCount - pendingCount);
  const attendancePct = totalEnrolled > 0 ? Math.round((presentCount / totalEnrolled) * 100) : 0;
  const alertsCount = liveData?.counters?.alerts_count || 0;

  // Compute session elapsed / remaining time
  const [sessionElapsed, setSessionElapsed] = useState('');
  useEffect(() => {
    if (!activeSession?.started_at) return;
    const updateElapsed = () => {
      const start = new Date(activeSession.started_at).getTime();
      const now = Date.now();
      const diffSecs = Math.max(0, Math.floor((now - start) / 1000));
      const mins = Math.floor(diffSecs / 60);
      const secs = diffSecs % 60;
      setSessionElapsed(`${mins}m ${secs < 10 ? '0' : ''}${secs}s`);
    };
    updateElapsed();
    const t = setInterval(updateElapsed, 1000);
    return () => clearInterval(t);
  }, [activeSession?.started_at]);

  const refreshInterval = qrData?.refresh_interval_seconds || 20;
  const progressPct = Math.min(100, Math.max(0, (countdown / refreshInterval) * 100));

  const subjectTitle = activeSession?.subject_name || 'Operating Systems (CS301)';
  const roomName = activeSession?.room_no || 'Room 304';
  const sectionName = activeSession?.section || 'Sec A';

  return (
    <div className="space-y-4 pb-4">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-1 border-b border-slate-200">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h2 className="text-sm font-extrabold text-[#111827] tracking-tight">Live Session</h2>
            <p className="text-[11px] text-slate-500 font-medium">
              {sectionName} &bull; {roomName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 flex items-center gap-1.5 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            LIVE ATTENDANCE
          </span>
        </div>
      </div>

      {/* Class & Elapsed Banner */}
      <div className="bg-gradient-to-r from-[#1A4731] to-[#2D6A4F] text-white rounded-2xl p-4 shadow-md shadow-emerald-950/15">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-200/90">
              Active Lecture
            </span>
            <h3 className="text-base font-black truncate mt-0.5">{subjectTitle}</h3>
            <p className="text-xs text-emerald-100/80 mt-1 flex items-center gap-2">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {sessionElapsed || 'Active'}
              </span>
              <span>&bull;</span>
              <span>Geofence 150m</span>
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-2.5 text-center shrink-0 border border-white/15">
            <span className="text-[10px] text-emerald-200 block font-semibold">Attendance</span>
            <span className="text-xl font-black">{attendancePct}%</span>
          </div>
        </div>
      </div>

      {/* Dynamic Rotating QR Card */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex flex-col items-center text-center space-y-4">
        {/* QR Canvas */}
        <div className="relative p-3.5 rounded-2xl bg-white border-2 border-slate-200 shadow-sm">
          {qrData?.qr_token ? (
            <QRCodeSVG
              value={qrData.qr_token}
              size={218}
              level="H"
              includeMargin={true}
            />
          ) : (
            <div className="w-[218px] h-[218px] bg-slate-50 flex flex-col items-center justify-center text-slate-400 space-y-2 rounded-xl">
              <RefreshCw className="w-8 h-8 animate-spin text-[#1A4731]" />
              <span className="text-xs font-semibold">Generating Token...</span>
            </div>
          )}

          {/* Projector expand button badge */}
          {onOpenProjector && (
            <button
              type="button"
              onClick={onOpenProjector}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/90 backdrop-blur-xs border border-slate-200 text-slate-700 hover:text-[#1A4731] shadow-xs transition"
              title="Projector / Wall Mode"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Cryptographic Refresh Countdown */}
        <div className="w-full max-w-xs space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-500 flex items-center gap-1">
              <RefreshCw className={`w-3.5 h-3.5 text-[#1A4731] ${countdown <= 3 ? 'animate-spin' : ''}`} />
              Token Refresh
            </span>
            <span className="text-[#1A4731] font-mono font-bold text-xs">
              {countdown}s remaining
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#2D6A4F] to-[#1A4731] transition-all duration-300 ease-linear rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Security Signature Pill */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10px] font-semibold text-slate-600 bg-slate-50 py-1.5 px-3 rounded-full border border-slate-200">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>HMAC-SHA256</span>
          <span className="text-slate-300">&bull;</span>
          <span>Window {qrData?.window_index || 'Active'}</span>
          <span className="text-slate-300">&bull;</span>
          <span>150m Campus Lock</span>
        </div>

        {/* Hardware Status Buttons */}
        <div className="grid grid-cols-2 gap-2 w-full pt-1">
          <button
            type="button"
            onClick={onToggleUltrasonic}
            className={`py-2 px-2.5 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1.5 transition ${
              ultrasonicBeaconActive
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${ultrasonicBeaconActive ? 'text-emerald-700 animate-pulse' : ''}`} />
            <span>Beacon: {ultrasonicBeaconActive ? '18.8 kHz ON' : 'Muted'}</span>
          </button>

          <button
            type="button"
            onClick={onRecalibrateGps}
            className="py-2 px-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-bold flex items-center justify-center gap-1.5 transition"
          >
            <MapPin className="w-3.5 h-3.5 text-[#1A4731]" />
            <span>GPS Sync {facultyGps?.accuracy ? `±${facultyGps.accuracy}m` : ''}</span>
          </button>
        </div>
      </div>

      {/* Attendance Stats Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div
          onClick={onViewRoster}
          className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-xs text-center cursor-pointer hover:border-emerald-300 transition"
        >
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
            Present
          </span>
          <span className="text-lg font-black text-emerald-700 mt-0.5 block">
            {presentCount}
          </span>
          <span className="text-[10px] text-slate-400">of {totalEnrolled}</span>
        </div>

        <div
          onClick={onViewRoster}
          className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-xs text-center cursor-pointer hover:border-amber-300 transition"
        >
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
            Review
          </span>
          <span className={`text-lg font-black mt-0.5 block ${pendingCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
            {pendingCount}
          </span>
          <span className="text-[10px] text-slate-400">Exceptions</span>
        </div>

        <div
          onClick={onViewRoster}
          className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-xs text-center cursor-pointer hover:border-slate-300 transition"
        >
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
            Unmarked
          </span>
          <span className="text-lg font-black text-slate-700 mt-0.5 block">
            {unmarkedCount}
          </span>
          <span className="text-[10px] text-slate-400">Pending</span>
        </div>
      </div>

      {/* Pending Reviews Notice (if any) */}
      {pendingCount > 0 && (
        <div
          onClick={onViewRoster}
          className="bg-amber-50 rounded-xl p-3 border border-amber-200 flex items-center justify-between gap-2.5 cursor-pointer hover:bg-amber-100/70 transition"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-xs font-semibold text-amber-900 truncate">
              {pendingCount} student{pendingCount > 1 ? 's' : ''} awaiting biometric/device review
            </p>
          </div>
          <span className="text-[11px] font-bold text-amber-800 underline shrink-0">
            Review
          </span>
        </div>
      )}

      {/* Primary Action Buttons */}
      <div className="space-y-2.5 pt-1">
        <button
          type="button"
          onClick={onViewRoster}
          className="w-full py-3.5 px-4 rounded-xl bg-white border border-slate-200/90 hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-[0.99]"
        >
          <Users className="w-4 h-4 text-[#1A4731]" />
          <span>View Live Student Roster ({totalEnrolled})</span>
        </button>

        <button
          type="button"
          onClick={() => setShowEndConfirm(true)}
          disabled={ending}
          className="w-full py-3 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50"
        >
          {ending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4 fill-rose-700" />}
          <span>End Attendance Session</span>
        </button>
      </div>

      {/* End Session Confirmation Modal */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto">
              <Square className="w-5 h-5 fill-rose-600" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-extrabold text-[#111827]">
                End Attendance Session?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Ending the session will immediately stop QR rotation and lock attendance. Any unmarked enrolled students will be recorded as absent.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Present</span>
                <span className="font-bold text-emerald-700">{presentCount} students</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Unmarked (Will be Absent)</span>
                <span className="font-bold text-rose-600">{unmarkedCount} students</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowEndConfirm(false)}
                disabled={ending}
                className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEndConfirm(false);
                  onEndSession();
                }}
                disabled={ending}
                className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-900/20 transition flex items-center justify-center gap-1.5"
              >
                {ending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Yes, End Session</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
