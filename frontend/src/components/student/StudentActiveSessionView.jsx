import React, { useState, useEffect } from 'react';
import { ArrowLeft, BookOpen, Clock, MapPin, User, QrCode, ShieldCheck } from 'lucide-react';

export default function StudentActiveSessionView({
  session,
  onBack,
  onStartScan
}) {
  // Countdown timer calculation (e.g. 24:18 or dynamic based on end_time)
  const [secondsRemaining, setSecondsRemaining] = useState(24 * 60 + 18);

  useEffect(() => {
    // If session has an end_time, compute remaining seconds
    if (session?.end_time) {
      try {
        const [endH, endM] = session.end_time.split(':').map(Number);
        const now = new Date();
        const end = new Date();
        end.setHours(endH, endM, 0, 0);
        const diffSec = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
        if (diffSec > 0 && diffSec < 7200) {
          setSecondsRemaining(diffSec);
        }
      } catch (e) {}
    }

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [session?.end_time]);

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-5">
      {/* Top Header: Back Button & Live Badge (Screen 4 Reference) */}
      <div className="sticky top-0 z-20 bg-[#F8FAF9]/95 backdrop-blur-md py-2.5 -mx-4 px-4 flex items-center justify-between border-b border-slate-200/60 select-none">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 min-h-[44px] min-w-[44px] text-slate-700 hover:text-[#111827] active:scale-[0.97] font-bold text-sm focus:outline-none transition"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
          <span>Active Session</span>
        </button>

        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </span>
      </div>

      {/* Session Details Card (Screen 4 Reference) */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-[#111827]">
              {session?.subject_name || session?.subject_code || 'Data Structures'}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              {session?.section || 'CSE 5A'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs">
          <div>
            <span className="text-[11px] text-slate-400 block font-medium">Faculty</span>
            <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
              <User className="w-3.5 h-3.5 text-slate-500" />
              {session?.faculty_name || 'Prof. Sharma'}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-slate-400 block font-medium">Time</span>
            <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              {session?.start_time && session?.end_time
                ? `${session.start_time} - ${session.end_time}`
                : (session?.time || '09:00 AM - 10:00 AM')}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-slate-400 block font-medium">Started At</span>
            <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              {session?.started_at || session?.start_time || '09:02 AM'}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-slate-400 block font-medium">Location</span>
            <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              {session?.room_no ? `Room ${session.room_no}` : (session?.location || 'CSE Block, Room 304')}
            </span>
          </div>
        </div>
      </div>

      {/* "Session is Active" Countdown Card (Screen 4 Reference) */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm text-center space-y-4">
        <div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Session is Active
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Time Remaining</span>
          <div className="text-4xl sm:text-5xl font-black text-[#1A4731] tracking-tight font-mono my-2">
            {formatTimer(secondsRemaining)}
          </div>
        </div>

        <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
          Mark your attendance by scanning the QR code shown by your faculty.
        </p>

        <button
          type="button"
          id="btn-scan-qr-code"
          onClick={onStartScan}
          className="w-full py-4 px-6 rounded-2xl bg-[#1A4731] hover:bg-[#143826] active:scale-[0.99] text-white font-bold text-sm shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-2.5 transition"
        >
          <QrCode className="w-5 h-5 stroke-[2.2]" />
          <span>Scan QR Code</span>
        </button>
      </div>
    </div>
  );
}
