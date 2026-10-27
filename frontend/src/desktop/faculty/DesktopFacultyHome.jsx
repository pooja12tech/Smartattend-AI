import React, { useState, useMemo } from 'react';
import {
  BookOpen, Users, Clock, ShieldCheck, CheckCircle2,
  Calendar, Flame, Sparkles, MapPin, Radio, Search,
  Check, UserCheck, AlertTriangle, Filter, ChevronRight
} from 'lucide-react';
import DesktopHeroClass from './DesktopHeroClass';
import DesktopScheduleList from './DesktopScheduleList';
import DesktopSystemStatus from './DesktopSystemStatus';

export default function DesktopFacultyHome({
  user,
  activeSession,
  isSessionActive,
  qrData,
  liveData,
  roster = [],
  todayClasses = [],
  loadingClasses = false,
  highlightedSlot,
  facultyGps,
  onRecalibrateGps,
  ultrasonicBeaconActive,
  onToggleUltrasonic,
  onStartSession,
  onEndSession,
  starting = false,
  ending = false,
  onOpenProjector,
  onViewAllClasses
}) {
  // Selected slot state allows faculty to pick which class to launch
  const [selectedSlotOverride, setSelectedSlotOverride] = useState(null);
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterFilter, setRosterFilter] = useState('ALL'); // 'ALL' | 'PRESENT' | 'UNMARKED' | 'FLAGGED'

  const effectiveSlot = selectedSlotOverride || highlightedSlot || todayClasses[0] || null;

  // Real KPI stats calculations
  const totalClassesCount = todayClasses.length;
  const totalEnrolledCount = todayClasses.reduce((acc, c) => acc + (c.enrolled_count || 50), 0);
  const presentCount = liveData?.counters?.present_count ??
    roster.filter(s => s.status === 'PRESENT' || s.status === 'MANUAL_PRESENT').length;
  const proxyFlagsCount = liveData?.counters?.alerts_count || 0;

  // Filtered Roster for interactive preview table
  const displayedRoster = useMemo(() => {
    let list = roster;
    // If roster is empty (e.g. before session start or while fetching), show student cohort awaiting scan
    if (!list || list.length === 0) {
      if (isSessionActive) {
        list = [];
      } else {
        list = [
          { roll_no: 'STU01', name: 'Aarav Sharma', status: 'UNMARKED', verification_method: null, timestamp: null, confidence: null },
          { roll_no: 'STU02', name: 'Ananya Verma', status: 'UNMARKED', verification_method: null, timestamp: null, confidence: null },
          { roll_no: 'STU03', name: 'Rohan Mehta', status: 'UNMARKED', verification_method: null, timestamp: null, confidence: null },
          { roll_no: 'STU04', name: 'Ishita Patel', status: 'UNMARKED', verification_method: null, timestamp: null, confidence: null },
          { roll_no: 'STU05', name: 'Kavya Nair', status: 'UNMARKED', verification_method: null, timestamp: null, confidence: null },
          { roll_no: 'STU06', name: 'Vikram Joshi', status: 'UNMARKED', verification_method: null, timestamp: null, confidence: null },
          { roll_no: 'STU07', name: 'Pooja Iyer', status: 'UNMARKED', verification_method: null, timestamp: null, confidence: null },
          { roll_no: 'STU08', name: 'Aditya Singh', status: 'UNMARKED', verification_method: null, timestamp: null, confidence: null }
        ];
      }
    }

    if (rosterFilter === 'PRESENT') {
      list = list.filter(s => s.status === 'PRESENT' || s.status === 'MANUAL_PRESENT');
    } else if (rosterFilter === 'UNMARKED') {
      list = list.filter(s => s.status !== 'PRESENT' && s.status !== 'MANUAL_PRESENT' && s.status !== 'FLAGGED');
    } else if (rosterFilter === 'FLAGGED') {
      list = list.filter(s => s.status === 'FLAGGED' || s.status === 'PENDING_APPROVAL');
    }

    if (rosterSearch.trim()) {
      const q = rosterSearch.toLowerCase();
      list = list.filter(s =>
        (s.name || s.student_name || '').toLowerCase().includes(q) ||
        (s.roll_no || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [roster, rosterFilter, rosterSearch, isSessionActive]);

  return (
    <div className="w-full px-6 lg:px-8 py-6 space-y-6">
      {/* 1. TOP 4 KPI CARDS: FACULTY ACADEMIC OVERVIEW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Scheduled Classes */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Today's Classes</span>
            <span className="w-8 h-8 rounded-xl bg-emerald-50 text-[#1A4731] flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#111827] tracking-tight">
              {totalClassesCount}
            </span>
            <span className="text-xs font-bold text-slate-400">Lecture Slots</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Assigned from university master schedule
          </p>
        </div>

        {/* Metric 2: Total Students Enrolled */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Students on Roster</span>
            <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#111827] tracking-tight">
              {totalEnrolledCount}
            </span>
            <span className="text-xs font-bold text-slate-400">Total Enrolled</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Across your assigned lecture cohorts
          </p>
        </div>

        {/* Metric 3: Live Session Status */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Attendance Status</span>
            <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              isSessionActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
            }`}>
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-xl font-black tracking-tight ${
              isSessionActive ? 'text-emerald-700' : 'text-slate-800'
            }`}>
              {isSessionActive ? 'Session Active' : 'Ready to Launch'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            {isSessionActive ? `${presentCount} students verified so far` : 'Select a slot and start verification'}
          </p>
        </div>

        {/* Metric 4: Anti-Proxy Geofence & Security */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Anti-Proxy Security</span>
            <span className="w-8 h-8 rounded-xl bg-emerald-50 text-[#1A4731] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black text-[#111827] tracking-tight">
              {proxyFlagsCount === 0 ? 'Zero Fraud Flags' : `${proxyFlagsCount} Discrepancies`}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            150m Campus Geofence &bull; Acoustic Beacon
          </p>
        </div>
      </div>

      {/* 2. MAIN 12-COLUMN WORKSPACE: LEFT 8 COLS + RIGHT 4 COLS */}
      <div className="grid grid-cols-12 gap-6 items-start w-full">
        {/* Left 8 Columns: Hero Class + Today's Schedule + Student Roster Feed */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <DesktopHeroClass
            activeSession={activeSession}
            isSessionActive={isSessionActive}
            highlightedSlot={effectiveSlot}
            todayClasses={todayClasses}
            onSelectSlot={(slot) => setSelectedSlotOverride(slot)}
            liveData={liveData}
            roster={roster}
            starting={starting}
            ending={ending}
            onStartSession={onStartSession}
            onEndSession={onEndSession}
            onOpenProjector={onOpenProjector}
          />

          <DesktopScheduleList
            todayClasses={todayClasses}
            loadingClasses={loadingClasses}
            isSessionActive={isSessionActive}
            onStartSessionForSlot={(slot) => {
              setSelectedSlotOverride(slot);
              onStartSession(slot);
            }}
            onSelectSlot={(slot) => setSelectedSlotOverride(slot)}
            selectedSlot={effectiveSlot}
            onViewAllClasses={onViewAllClasses}
          />

          {/* Student Class Roster & Verification Feed */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-[#111827] tracking-tight flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-[#1A4731]" />
                  <span>Class Roster &amp; Student Verification</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {effectiveSlot?.subject_name || 'Selected Class'} &bull; Section {effectiveSlot?.section || 'A'}
                </p>
              </div>

              {/* Roster Controls: Search + Filter Pills */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    placeholder="Search name or roll no..."
                    className="bg-[#F8FAF9] border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#1A4731] w-48"
                  />
                </div>

                <div className="flex items-center gap-1 bg-[#F8FAF9] p-0.5 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setRosterFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                      rosterFilter === 'ALL'
                        ? 'bg-white text-[#1A4731] shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setRosterFilter('PRESENT')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                      rosterFilter === 'PRESENT'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Present
                  </button>
                  <button
                    type="button"
                    onClick={() => setRosterFilter('UNMARKED')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                      rosterFilter === 'UNMARKED'
                        ? 'bg-slate-200 text-slate-800'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Unmarked
                  </button>
                </div>
              </div>
            </div>

            {/* Roster Table */}
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-white/95 backdrop-blur-xs z-10 border-b border-slate-100">
                  <tr className="text-slate-400 uppercase text-[11px] tracking-wider font-bold">
                    <th className="py-2.5 px-3">Student</th>
                    <th className="py-2.5 px-3">Roll Number</th>
                    <th className="py-2.5 px-3">Verification Method</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedRoster.length > 0 ? (
                    displayedRoster.map((st, i) => {
                      const isPresent = st.status === 'PRESENT' || st.status === 'MANUAL_PRESENT';
                      const isPending = st.status === 'PENDING_APPROVAL' || st.status === 'FLAGGED';

                      return (
                        <tr key={st.roll_no || i} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 min-w-0">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-[#EBF4EE] text-[#1A4731] font-bold text-xs flex items-center justify-center shrink-0">
                                {(st.name || st.student_name || 'S').substring(0, 1)}
                              </div>
                              <span className="font-bold text-slate-800 truncate max-w-[180px]">
                                {st.name || st.student_name || 'Student'}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-500 font-semibold whitespace-nowrap">
                            {st.roll_no}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">
                            {isPresent ? (
                              <span className="inline-flex items-center gap-1.5 text-emerald-800 font-medium text-xs">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>
                                  {st.remarks || 'Dynamic QR + Face Liveness'}
                                  {st.marked_at ? ` • ${new Date(st.marked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                                  {st.distance_meters != null ? ` (±${st.distance_meters}m)` : ''}
                                </span>
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">Awaiting scan</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            {isPresent ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 text-[11px] font-bold">
                                <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                                Verified Present
                              </span>
                            ) : isPending ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 text-[11px] font-bold animate-pulse">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                Requires Review
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-medium">
                                Unmarked
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="4" className="py-8 text-center text-slate-400">
                        <p className="font-bold text-xs text-slate-500">No students match your search / filter</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 4 Columns: System Integrity & Session QR Display */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <DesktopSystemStatus
            activeSession={activeSession}
            isSessionActive={isSessionActive}
            qrData={qrData}
            facultyGps={facultyGps}
            onRecalibrateGps={onRecalibrateGps}
            ultrasonicBeaconActive={ultrasonicBeaconActive}
            onToggleUltrasonic={onToggleUltrasonic}
            onOpenProjector={onOpenProjector}
            alertsCount={proxyFlagsCount}
            roster={roster}
          />
        </div>
      </div>
    </div>
  );
}
