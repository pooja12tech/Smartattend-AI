import React from 'react';
import {
  Play, Users, MapPin, Radio, Calendar, Clock, ChevronRight,
  BookOpen, ShieldCheck, CheckCircle2, AlertTriangle, Sparkles, User, RefreshCw
} from 'lucide-react';

export default function FacultyDashboardView({
  user,
  activeSession,
  isSessionActive,
  liveData,
  roster = [],
  todayClasses = [],
  loadingClasses = false,
  facultyGps,
  onRecalibrateGps,
  ultrasonicBeaconActive,
  onToggleUltrasonic,
  onOpenSessionSetup,
  onOpenLiveQR,
  onOpenTimetable,
  onOpenProfile,
  onOpenNotifications
}) {
  const facultyName = user?.name || 'Prof. Faculty';
  const facultyLastName = facultyName.split(' ').slice(-1)[0] || 'Faculty';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const todayFormattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  // Calculate real metrics from active session or roster
  const presentCount = liveData?.counters?.present_count ??
    roster.filter(s => s.status === 'PRESENT' || s.status === 'MANUAL_PRESENT').length;
  const pendingCount = liveData?.counters?.pending_count ??
    roster.filter(s => s.status === 'PENDING_APPROVAL').length;
  const totalEnrolled = roster.length > 0 ? roster.length : (activeSession ? 50 : 0);
  const alertsCount = liveData?.counters?.alerts_count ?? 0;

  // Identify currently ongoing class slot or next upcoming slot from today's timetable
  const currentSlot = todayClasses.find(c => c.is_current_slot);
  const nextSlot = todayClasses.find(c => c.is_upcoming_slot);
  const highlightedSlot = currentSlot || nextSlot || todayClasses[0] || null;

  return (
    <div className="space-y-4">
      {/* Top Mobile Header: Greeting, Date, Alerts & Profile Avatar */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#111827] tracking-tight flex items-center gap-1.5">
            <span>{getGreeting()}, {facultyLastName}!</span>
            <span className="text-xl">👋</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {todayFormattedDate} &bull; {user?.department || 'Computer Science & Engineering'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Notification Bell with Security Alert Badge */}
          <button
            type="button"
            onClick={onOpenNotifications}
            className="relative p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-[#1A4731] transition shadow-sm"
            title="Notifications"
            aria-label="Notifications"
          >
            <AlertTriangle className="w-4 h-4" />
            {alertsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-4 px-1 rounded-full bg-rose-500 text-white font-bold text-[11px] flex items-center justify-center ring-2 ring-white">
                {alertsCount}
              </span>
            )}
          </button>

          {/* Profile Avatar Button */}
          <button
            type="button"
            onClick={onOpenProfile}
            className="relative p-0.5 rounded-full border-2 border-emerald-600/40 hover:border-emerald-600 transition focus:outline-none"
            title="Faculty Profile"
            aria-label="Faculty Profile"
          >
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden font-bold text-xs text-slate-700">
              <User className="w-5 h-5 text-slate-700" />
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
          </button>
        </div>
      </div>

      {/* Hero Card: Active Session (Ongoing) OR Class Launch Card */}
      {isSessionActive ? (
        <div
          onClick={onOpenLiveQR}
          className="cursor-pointer bg-gradient-to-r from-emerald-950 via-[#1A4731] to-[#143826] text-white rounded-2xl p-5 shadow-lg shadow-emerald-950/20 relative overflow-hidden transition transform hover:scale-[1.01] active:scale-[0.99]"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/30 text-emerald-100 border border-emerald-400/30 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Live Attendance Active
            </span>
            <span className="text-xs text-emerald-200 font-mono flex items-center gap-1 font-semibold">
              Live QR <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>

          <h2 className="font-extrabold text-lg text-white">
            {activeSession?.subject_name || 'Operating Systems'}
          </h2>
          <p className="text-xs text-emerald-100/90 mt-0.5 flex items-center gap-2">
            <span>{activeSession?.section ? `Section ${activeSession.section}` : 'CSE 5A'}</span>
            <span>&bull;</span>
            <span>Room {activeSession?.room_no || '304'}</span>
          </p>

          {/* Metric Pills Row (Screen 3 Reference) */}
          <div className="grid grid-cols-2 min-[380px]:grid-cols-4 gap-2 mt-4 pt-3 border-t border-emerald-700/50 text-center">
            <div className="bg-emerald-950/60 rounded-xl py-2 px-1 border border-emerald-700/30">
              <span className="text-[11px] uppercase font-bold text-emerald-300 block">Enrolled</span>
              <span className="text-sm sm:text-base font-extrabold text-white">{totalEnrolled}</span>
            </div>
            <div className="bg-emerald-950/60 rounded-xl py-2 px-1 border border-emerald-700/30">
              <span className="text-[11px] uppercase font-bold text-emerald-300 block">Present</span>
              <span className="text-sm sm:text-base font-extrabold text-white">{presentCount}</span>
            </div>
            <div className="bg-emerald-950/60 rounded-xl py-2 px-1 border border-emerald-700/30">
              <span className="text-[11px] uppercase font-bold text-emerald-300 block">Pending</span>
              <span className="text-sm sm:text-base font-extrabold text-white">{pendingCount}</span>
            </div>
            <div className="bg-emerald-950/60 rounded-xl py-2 px-1 border border-emerald-700/30">
              <span className="text-[11px] uppercase font-bold text-emerald-300 block">Review</span>
              <span className="text-sm sm:text-base font-extrabold text-white">{alertsCount}</span>
            </div>
          </div>
        </div>
      ) : (
        /* Current / Next Scheduled Class Launch Card (Screen 3 & 4 Inspiration) */
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#1A4731] uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#1A4731]" />
              {currentSlot ? 'Current Class (Live Now)' : nextSlot ? 'Next Scheduled Class' : 'Class Attendance'}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              Timetable Auto-Selected
            </span>
          </div>

          {highlightedSlot ? (
            <div className="flex items-start justify-between gap-3 bg-[#F8FAF9] p-3.5 rounded-xl border border-slate-200">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-[#1A4731] border border-emerald-200 flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-sm text-[#111827] truncate">
                    {highlightedSlot.subject_name || highlightedSlot.subject_code}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {highlightedSlot.section || 'CSE 5A'} &bull; Room {highlightedSlot.room_no || '304'}
                  </p>
                  <p className="text-[11px] font-mono font-semibold text-[#1A4731] mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{highlightedSlot.start_time} - {highlightedSlot.end_time}</span>
                  </p>
                </div>
              </div>

              {highlightedSlot.is_current_slot && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 animate-pulse shrink-0">
                  Live Slot
                </span>
              )}
            </div>
          ) : (
            <div className="bg-[#F8FAF9] p-3.5 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
              No classes currently scheduled on your timetable for this hour.
            </div>
          )}

          {/* Action CTA: Explicit confirmation flow (Screen 4 & 5) */}
          <button
            type="button"
            onClick={() => onOpenSessionSetup(highlightedSlot)}
            className="w-full py-3.5 px-4 rounded-xl bg-[#1A4731] hover:bg-[#143826] active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-emerald-950/20 flex items-center justify-center gap-2 transition"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Start Attendance Session</span>
          </button>
        </div>
      )}

      {/* Hardware Security Controls: Live GPS & Ultrasonic Beacon */}
      <div className="grid grid-cols-2 gap-3">
        {/* Geofence Status */}
        <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
            <MapPin className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Campus Geofence</span>
            <span className="text-xs font-extrabold text-[#111827] truncate block">
              150m Protected
            </span>
            <button
              type="button"
              onClick={onRecalibrateGps}
              className="text-[10px] text-[#1A4731] font-semibold hover:underline flex items-center gap-0.5 mt-0.5"
            >
              <RefreshCw className="w-2.5 h-2.5" />
              <span>Sync GPS</span>
            </button>
          </div>
        </div>

        {/* Ultrasonic Beacon */}
        <div
          onClick={onToggleUltrasonic}
          className="cursor-pointer bg-white rounded-xl p-3 border border-slate-200/90 shadow-sm flex items-center gap-3 active:scale-[0.98] transition group"
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition ${
            ultrasonicBeaconActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-400 border-slate-200'
          }`}>
            <Radio className={`w-5 h-5 ${ultrasonicBeaconActive ? 'animate-pulse text-emerald-600' : ''}`} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Acoustic Beacon</span>
            <span className={`text-xs font-extrabold truncate block ${ultrasonicBeaconActive ? 'text-emerald-700' : 'text-slate-500'}`}>
              {ultrasonicBeaconActive ? '18.8 kHz ON' : 'Muted'}
            </span>
            <span className="text-[10px] text-slate-400 font-medium block">
              Anti-proxy room check
            </span>
          </div>
        </div>
      </div>

      {/* Today's Classes Schedule (Screen 3 Reference) */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#111827] tracking-tight">
            Today's Classes
          </h2>
          <button
            type="button"
            onClick={onOpenTimetable}
            className="text-xs font-semibold text-[#1A4731] hover:underline"
          >
            View All
          </button>
        </div>

        {loadingClasses ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-slate-200/90 animate-pulse space-y-2.5">
                <div className="flex justify-between items-center">
                  <div className="h-4 w-32 bg-slate-200 rounded" />
                  <div className="h-4 w-16 bg-slate-200 rounded-full" />
                </div>
                <div className="h-3 w-48 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        ) : todayClasses && todayClasses.length > 0 ? (
          <div className="space-y-2.5">
            {todayClasses.map((cls, idx) => {
              const isOngoing = cls.is_current_slot;
              const isUpcoming = cls.is_upcoming_slot;

              return (
                <div
                  key={cls.id || idx}
                  onClick={() => onOpenSessionSetup(cls)}
                  className={`bg-white rounded-2xl p-4 border transition-all cursor-pointer active:scale-[0.97] ${
                    isOngoing
                      ? 'border-emerald-300 ring-1 ring-emerald-300 shadow-sm hover:bg-emerald-50/20'
                      : 'border-slate-200/90 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-emerald-50 text-[#1A4731] border border-emerald-200 flex items-center justify-center shrink-0">
                        <BookOpen className="w-5 h-5" />
                      </div>

                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-[#111827] truncate">
                          {cls.subject_name || cls.subject_code}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {cls.start_time} - {cls.end_time}
                          </span>
                          <span>&bull;</span>
                          <span className="truncate">
                            {cls.section || 'CSE 5A'} {cls.room_no ? `• Room ${cls.room_no}` : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isOngoing ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Live Now
                        </span>
                      ) : isUpcoming ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          Upcoming
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Completed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 text-center border border-slate-200/90 text-slate-500 space-y-1">
            <BookOpen className="w-7 h-7 mx-auto text-slate-400" />
            <p className="text-xs font-semibold text-slate-700">No scheduled classes for today</p>
            <p className="text-[11px] text-slate-400">Enjoy your preparation time or check your full timetable.</p>
          </div>
        )}
      </div>
    </div>
  );
}
