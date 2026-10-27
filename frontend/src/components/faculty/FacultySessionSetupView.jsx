import React, { useState } from 'react';
import {
  ArrowLeft, BookOpen, Clock, Users, User, Calendar, MapPin,
  ShieldCheck, CheckCircle2, ChevronDown, RefreshCw, Radio, AlertCircle
} from 'lucide-react';

export default function FacultySessionSetupView({
  user,
  initialClass,
  todayClasses = [],
  facultyGps,
  onBack,
  onStartSession,
  starting = false
}) {
  // Stepper step: 1 = Class selection/verification, 2 = Settings & Security Confirmation
  const [step, setStep] = useState(1);

  // Selected class state
  const [selectedClass, setSelectedClass] = useState(() => {
    return initialClass || todayClasses.find(c => c.is_current_slot) || todayClasses[0] || {
      subject_name: 'CS301 - Operating Systems',
      subject_code: 'CS301',
      section: 'CSE 5A',
      room_no: '304',
      start_time: '10:00 AM',
      end_time: '11:00 AM'
    };
  });

  const [durationMinutes, setDurationMinutes] = useState(60);

  const facultyName = user?.name || 'Prof. Faculty';
  const todayFormattedDate = new Date().toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const handleNext = () => {
    setStep(2);
  };

  const handleConfirmStart = () => {
    const subjectTitle = selectedClass?.subject_name || selectedClass?.subject_code || 'CS301 - Operating Systems';
    onStartSession(subjectTitle, durationMinutes);
  };

  return (
    <div className="space-y-4">
      {/* Top Header with Back Navigation */}
      <div className="sticky top-0 z-20 bg-[#F8FAF9]/95 backdrop-blur-md py-2.5 -mx-4 px-4 flex items-center gap-3 border-b border-slate-200/60 select-none">
        <button
          type="button"
          onClick={() => {
            if (step === 2) {
              setStep(1);
            } else {
              onBack();
            }
          }}
          className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 active:scale-[0.97] transition shadow-xs flex items-center justify-center cursor-pointer"
          title="Go Back"
          aria-label="Go Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-extrabold text-[#111827] tracking-tight">
            Start Attendance
          </h1>
          <p className="text-[11px] text-slate-500 font-medium">
            Step {step} of 2 &bull; {step === 1 ? 'Verify Class' : 'Confirm Settings & Security'}
          </p>
        </div>
      </div>

      {/* Stepper Progress Bar (Screen 4 & 5 Reference) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm">
        <div className="flex items-center justify-between relative">
          {/* Step 1 Pill */}
          <div className="flex flex-col items-center z-10">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
              step >= 1 ? 'bg-[#1A4731] text-white shadow-sm' : 'bg-slate-100 text-slate-400'
            }`}>
              1
            </div>
            <span className={`text-[11px] mt-1 font-semibold ${step === 1 ? 'text-[#1A4731] font-bold' : 'text-slate-500'}`}>
              Class
            </span>
          </div>

          {/* Progress Connecting Line */}
          <div className="flex-1 h-0.5 bg-slate-200 mx-2 -mt-4 relative">
            <div
              className="h-full bg-[#1A4731] transition-all duration-300"
              style={{ width: step === 2 ? '100%' : '50%' }}
            />
          </div>

          {/* Step 2 Pill */}
          <div className="flex flex-col items-center z-10">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
              step === 2 ? 'bg-[#1A4731] text-white shadow-sm' : 'bg-slate-100 text-slate-400'
            }`}>
              2
            </div>
            <span className={`text-[11px] mt-1 font-semibold ${step === 2 ? 'text-[#1A4731] font-bold' : 'text-slate-500'}`}>
              Confirm
            </span>
          </div>
        </div>
      </div>

      {/* STEP 1: CLASS SELECTION / VERIFICATION (Screen 4 Reference) */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#1A4731] uppercase tracking-wider">
                Selected Class (From Timetable)
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                Auto-Selected
              </span>
            </div>

            {/* Class Hero Details Card */}
            <div className="p-4 rounded-xl bg-[#F8FAF9] border border-slate-200 flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#1A4731] border border-emerald-200 flex items-center justify-center shrink-0">
                <BookOpen className="w-6 h-6" />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-base text-[#111827] truncate">
                  {selectedClass.subject_name || selectedClass.subject_code}
                </h3>
                <p className="text-xs font-semibold text-slate-600 mt-0.5">
                  Section: {selectedClass.section || 'CSE 5A'}
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                  <span className="flex items-center gap-1 font-mono text-[#1A4731] font-semibold">
                    <Clock className="w-3.5 h-3.5" />
                    {selectedClass.start_time} - {selectedClass.end_time}
                  </span>
                  <span>&bull;</span>
                  <span>Room {selectedClass.room_no || '304'}</span>
                </div>
              </div>
            </div>

            {/* Class Attributes Grid (Screen 4 Reference) */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center gap-2.5">
                <Users className="w-4 h-4 text-slate-500" />
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Students</span>
                  <span className="text-xs font-extrabold text-[#111827]">50 Enrolled</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center gap-2.5">
                <User className="w-4 h-4 text-slate-500" />
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Faculty</span>
                  <span className="text-xs font-extrabold text-[#111827] truncate block">{facultyName}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center gap-2.5 col-span-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Session Date</span>
                  <span className="text-xs font-extrabold text-[#111827]">{todayFormattedDate} (Today)</span>
                </div>
              </div>
            </div>

            {/* Class Switcher dropdown if multiple classes today */}
            {todayClasses.length > 1 && (
              <div className="pt-1">
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Switch to Another Class Today
                </label>
                <select
                  value={selectedClass.id || selectedClass.subject_code}
                  onChange={(e) => {
                    const found = todayClasses.find(c => String(c.id || c.subject_code) === e.target.value);
                    if (found) setSelectedClass(found);
                  }}
                  className="w-full bg-white border border-slate-300 text-xs font-semibold text-[#111827] rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1A4731]/20 focus:border-[#1A4731]"
                >
                  {todayClasses.map((c, i) => (
                    <option key={c.id || i} value={c.id || c.subject_code}>
                      {c.subject_name || c.subject_code} ({c.start_time} - {c.end_time})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Timetable Helper Note (Screen 4 Reference) */}
            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-800 text-xs leading-relaxed flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>Class is selected based on your timetable. Please confirm and proceed to session configuration.</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleNext}
            className="w-full py-3.5 px-4 rounded-xl bg-[#1A4731] hover:bg-[#143826] active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-emerald-950/20 flex items-center justify-center gap-2 transition"
          >
            <span>Next: Configure Settings</span>
            <ArrowLeft className="w-4 h-4 rotate-180" />
          </button>
        </div>
      )}

      {/* STEP 2: SETTINGS & SECURITY CONFIRMATION (Screen 5 Reference) */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm space-y-4">
            <h2 className="text-xs font-bold text-[#1A4731] uppercase tracking-wider">
              Session Settings
            </h2>

            {/* Duration Selector */}
            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                Session Duration
              </label>
              <div className="relative">
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full appearance-none bg-[#F8FAF9] border border-slate-300 text-xs font-bold text-[#111827] rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1A4731]/20 focus:border-[#1A4731]"
                >
                  <option value={45}>45 minutes (Short Lecture)</option>
                  <option value={60}>60 minutes (Standard Default)</option>
                  <option value={90}>90 minutes (Extended Lab / Seminar)</option>
                  <option value={120}>120 minutes (Double Block)</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                QR code will refresh automatically every 20 seconds.
              </p>
            </div>

            {/* Automatic Security Checks Checklist (Screen 5 Reference) */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#111827] tracking-tight flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#1A4731]" />
                  <span>Security Checks (Automatic)</span>
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  5-Gate Anti-Proxy
                </span>
              </div>

              <div className="space-y-2 bg-[#F8FAF9] p-3.5 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center gap-2 text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">Face Verification</span>
                  <span className="text-[10px] text-slate-400 ml-auto">128D Embeddings</span>
                </div>

                <div className="flex items-center gap-2 text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">Liveness Detection (Blink)</span>
                  <span className="text-[10px] text-slate-400 ml-auto">Anti-Spoofing</span>
                </div>

                <div className="flex items-center gap-2 text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">Location (Campus Geofence)</span>
                  <span className="text-[10px] text-emerald-700 font-mono font-bold ml-auto">
                    {facultyGps?.lat ? `±${facultyGps.accuracy || 15}m Locked` : '150m Active'}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">Device &amp; Network Validation</span>
                  <span className="text-[10px] text-slate-400 ml-auto">Hardware Lock</span>
                </div>

                <div className="flex items-center gap-2 text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">Class &amp; Section Validation</span>
                  <span className="text-[10px] text-slate-400 ml-auto">{selectedClass.section || 'CSE 5A'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Explicit Session Launch CTA (Screen 5 Reference) */}
          <button
            type="button"
            onClick={handleConfirmStart}
            disabled={starting}
            className="w-full py-3.5 px-4 rounded-xl bg-[#1A4731] hover:bg-[#143826] active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-emerald-950/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            {starting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Launching Dynamic Session...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Start Session</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
