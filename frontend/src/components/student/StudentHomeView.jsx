import React from 'react';
import {
  ChevronRight, BookOpen, Clock, MapPin, Sparkles, Flame,
  Radio, CheckCircle2, AlertTriangle, ShieldCheck, User, QrCode, History
} from 'lucide-react';

export default function StudentHomeView({
  dashboard,
  user,
  todayClasses = [],
  activeSession = null,
  onOpenActiveSession,
  onOpenSubjectAttendance,
  onOpenClassesTab,
  onOpenProfile,
  onOpenScanner
}) {
  const attendance = dashboard?.attendance || {};
  const currentPct = attendance.current_pct ?? 85.0;
  const activeStreak = attendance.active_streak ?? 0;
  const bunkCalc = dashboard?.bunk_calculator || {};

  // Extract first name for friendly greeting
  const studentName = dashboard?.student?.name || user?.name || 'Student';
  const firstName = studentName.split(' ')[0] || 'Student';

  // Dynamic time greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Motivational message
  const getMotivationalMessage = (pct) => {
    if (pct >= 85) return "You're doing great!";
    if (pct >= 75) return "Good standing, keep it up!";
    if (pct >= 65) return "Warning: Close to minimum threshold (75%)";
    return "Action needed: Defaulter detention risk";
  };

  // Subject icon helper
  const getSubjectColorStyles = (index) => {
    const palette = [
      { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
      { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
      { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
      { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' }
    ];
    return palette[index % palette.length];
  };

  return (
    <div className="space-y-5">
      {/* Top Header: Student Greeting & Profile Avatar */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#111827] tracking-tight flex items-center gap-1.5">
            <span>{getGreeting()}, {firstName}!</span>
            <span className="text-xl">👋</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {dashboard?.student?.roll_no || user?.roll_no || 'STU01'} &bull; {dashboard?.student?.department || user?.department || 'CSE'}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenProfile}
          className="relative group p-0.5 rounded-full border-2 border-emerald-600/40 hover:border-emerald-600 transition focus:outline-none"
          title="View Student Profile"
          aria-label="View Student Profile"
        >
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden">
            <User className="w-5 h-5 text-slate-700" />
          </div>
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
        </button>
      </div>

      {/* Active Session Notification Card (if ongoing lecture session) */}
      {activeSession ? (
        <div
          onClick={() => onOpenActiveSession(activeSession)}
          className="cursor-pointer bg-gradient-to-r from-emerald-900 to-[#1A4731] text-white rounded-2xl p-4 shadow-md shadow-emerald-950/20 relative overflow-hidden transition transform hover:scale-[1.01] active:scale-[0.99]"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/30 text-emerald-100 border border-emerald-400/30 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Live Attendance Active
            </span>
            <span className="text-xs text-emerald-200 font-mono flex items-center gap-1">
              Tap to Scan <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <h3 className="font-bold text-base text-white">{activeSession.subject_name || 'Class Attendance'}</h3>
          <p className="text-xs text-emerald-100/90 mt-0.5">
            {activeSession.room_no ? `Room ${activeSession.room_no} &bull; ` : ''}Faculty: {activeSession.faculty_name || 'Faculty in room'}
          </p>
        </div>
      ) : null}

      {/* Overall Attendance Card (Screen 3 Reference) */}
      <div
        onClick={onOpenSubjectAttendance}
        className="cursor-pointer bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition-all group"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-600 tracking-wide">
            Overall Attendance
          </span>
          <div className="flex items-center text-slate-400 group-hover:text-[#1A4731] transition">
            <ChevronRight className="w-5 h-5" />
          </div>
        </div>

        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-3xl sm:text-4xl font-extrabold text-[#111827] tracking-tight">
            {currentPct}%
          </span>
          <span className="text-xs font-medium text-slate-500">
            ({attendance.attended_lectures ?? 0}/{attendance.total_lectures ?? 0} classes)
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              currentPct >= 75 ? 'bg-[#10B981]' : currentPct >= 65 ? 'bg-amber-500' : 'bg-rose-500'
            }`}
            style={{ width: `${Math.min(100, currentPct)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className={`font-semibold ${currentPct >= 75 ? 'text-emerald-700' : currentPct >= 65 ? 'text-amber-700' : 'text-rose-700'}`}>
            {getMotivationalMessage(currentPct)}
          </span>
          {bunkCalc?.safe_skips !== undefined && currentPct >= 75 && (
            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {bunkCalc.safe_skips} safe skips
            </span>
          )}
        </div>
      </div>

      {/* Quick Metrics Pills: Active Streak & Defaulter Radar */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
            <Flame className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Streak</span>
            <span className="text-sm font-extrabold text-[#111827] truncate block">
              {activeStreak > 0 ? `+${activeStreak} Lectures` : `${activeStreak} Lectures`}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Exam Eligibility</span>
            <span className="text-sm font-extrabold text-[#111827] truncate block">
              {currentPct >= 75 ? 'Eligible (75%+)' : 'Warning (<75%)'}
            </span>
          </div>
        </div>
      </div>

      {/* Today's Classes Section (Screen 3 Reference) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#111827] tracking-tight">
            Today's Classes
          </h2>
          <button
            type="button"
            onClick={onOpenClassesTab}
            className="text-xs font-semibold text-[#1A4731] hover:underline"
          >
            View All
          </button>
        </div>

        {todayClasses && todayClasses.length > 0 ? (
          <div className="space-y-2.5">
            {todayClasses.map((cls, idx) => {
              const styles = getSubjectColorStyles(idx);
              const isOngoing = cls.is_current_slot || cls.status === 'Ongoing';
              const isAttended = cls.is_attended || cls.status === 'Attended';

              return (
                <div
                  key={cls.id || idx}
                  onClick={() => {
                    if (isOngoing) {
                      onOpenActiveSession(cls);
                    }
                  }}
                  className={`bg-white rounded-2xl p-4 border transition-all ${
                    isOngoing
                      ? 'border-emerald-300 ring-1 ring-emerald-300 shadow-sm cursor-pointer hover:bg-emerald-50/20'
                      : 'border-slate-200/90 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Left icon badge */}
                      <div className={`w-11 h-11 rounded-xl ${styles.bg} ${styles.text} border ${styles.border} flex items-center justify-center shrink-0`}>
                        <BookOpen className="w-5 h-5" />
                      </div>

                      {/* Subject Name & Details */}
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-[#111827] truncate">
                          {cls.subject_name || cls.subject_code || 'Lecture'}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {cls.start_time && cls.end_time ? `${cls.start_time} - ${cls.end_time}` : (cls.time || '09:00 AM - 10:00 AM')}
                          </span>
                          <span>&bull;</span>
                          <span className="truncate">
                            {cls.section || cls.room_no ? `${cls.section || ''} ${cls.room_no ? `• ${cls.room_no}` : ''}`.trim() : 'CSE 5A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status Pill Badge */}
                    <div className="shrink-0">
                      {isOngoing ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Ongoing
                        </span>
                      ) : isAttended ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Attended
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          {idx === 0 ? 'Next' : 'Upcoming'}
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
            <p className="text-[11px] text-slate-400">Enjoy your study break or check your weekly timetable.</p>
          </div>
        )}
      </div>

      {/* Quick Access Scan Attendance Floating CTA */}
      <div className="pt-1">
        <button
          type="button"
          onClick={onOpenScanner}
          className="w-full py-3.5 px-4 rounded-2xl bg-[#1A4731] hover:bg-[#143826] active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-emerald-950/20 flex items-center justify-center gap-2 transition"
        >
          <QrCode className="w-5 h-5" />
          <span>Quick Scan Attendance</span>
        </button>
      </div>

      {/* Recent Attendance Activity */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#111827] tracking-tight flex items-center gap-1.5">
            <History className="w-4 h-4 text-[#1A4731]" />
            <span>Recent Activity</span>
          </h3>
          <button
            type="button"
            onClick={onOpenSubjectAttendance}
            className="text-xs font-semibold text-[#1A4731] hover:underline flex items-center gap-0.5"
          >
            <span>Full History</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {dashboard?.recent_logs && dashboard.recent_logs.length > 0 ? (
          <div className="space-y-2">
            {dashboard.recent_logs.slice(0, 3).map((log, idx) => (
              <div
                key={log.id || idx}
                className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-sm flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-[#111827] truncate">
                      {log.subject_name || log.subject_code || 'Lecture Session'}
                    </h4>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {log.marked_at ? new Date(log.marked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Verified session'}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Present
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-sm flex items-center gap-3 text-slate-500">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
              <History className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-xs">
              <p className="font-semibold text-slate-700">No attendance records yet</p>
              <p className="text-[11px] text-slate-400">Scanned lectures will appear here automatically.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
