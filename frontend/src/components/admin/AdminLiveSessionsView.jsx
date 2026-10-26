import React, { useState, useEffect } from 'react';
import {
  Radio, CheckCircle2, Clock, Users, Search, ChevronRight, ArrowLeft,
  Filter, ShieldAlert, AlertTriangle, UserCheck, BarChart3, RefreshCw
} from 'lucide-react';
import { api } from '../../api';

export default function AdminLiveSessionsView({
  overview,
  onBack,
  onSelectStudent,
  selectedSession: externalSelectedSession,
  onSelectSession: externalOnSelectSession,
  onClearSelectedSession: externalOnClearSelectedSession
}) {
  const [activeTab, setActiveTab] = useState('ongoing'); // 'ongoing' | 'completed'
  const [searchQuery, setSearchQuery] = useState('');
  const [internalSelectedSession, setInternalSelectedSession] = useState(null);

  const selectedSession = externalSelectedSession !== undefined ? externalSelectedSession : internalSelectedSession;
  const setSelectedSession = (val) => {
    const nextVal = typeof val === 'function' ? val(selectedSession) : val;
    setInternalSelectedSession(nextVal);
    if (nextVal) {
      if (externalOnSelectSession) externalOnSelectSession(nextVal);
    } else {
      if (externalOnClearSelectedSession) externalOnClearSelectedSession();
    }
  };
  const [sessionDetailTab, setSessionDetailTab] = useState('students'); // 'students' | 'analytics'
  const [roster, setRoster] = useState([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');

  const sessions = overview?.sessions || [];
  const ongoingSessions = sessions.filter(s => s.status === 'ACTIVE');
  const completedSessions = sessions.filter(s => s.status === 'ENDED' || s.status === 'COMPLETED');

  const displayedSessions = (activeTab === 'ongoing' ? ongoingSessions : completedSessions).filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (s.subject || '').toLowerCase().includes(q) ||
      (s.faculty_name || '').toLowerCase().includes(q) ||
      (s.section || '').toLowerCase().includes(q)
    );
  });

  // Load roster when a session is selected
  useEffect(() => {
    if (selectedSession?.id) {
      loadRoster(selectedSession.id);
    }
  }, [selectedSession]);

  const loadRoster = async (sessionId) => {
    setLoadingRoster(true);
    try {
      const data = await api.getSessionRoster(sessionId);
      setRoster(data.roster || data.students || []);
    } catch (err) {
      console.error('Failed to load session roster:', err);
      // Fallback empty roster if endpoint fails
      setRoster([]);
    } finally {
      setLoadingRoster(false);
    }
  };

  // Screen 5: Session Details View
  if (selectedSession) {
    const totalStudents = selectedSession.total_students || roster.length || 0;
    const presentCount = selectedSession.present_count || roster.filter(r => r.status === 'PRESENT').length || 0;
    const pendingCount = roster.filter(r => r.status === 'PENDING' || r.status === 'PENDING_APPROVAL').length;
    const flaggedCount = roster.filter(r => r.status === 'FLAGGED' || r.flagged).length;

    const filteredRoster = roster.filter(r => {
      if (!rosterSearch.trim()) return true;
      const q = rosterSearch.toLowerCase();
      return (
        (r.name || '').toLowerCase().includes(q) ||
        (r.roll_no || '').toLowerCase().includes(q)
      );
    });

    return (
      <div className="space-y-4 pb-20">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSelectedSession(null)}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#1A4731] transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Live Sessions</span>
          </button>
          {selectedSession.status === 'ACTIVE' && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200/80">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          )}
        </div>

        {/* Session Card Info */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-3">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1A4731] bg-[#1A4731]/10 px-2 py-0.5 rounded-md">
              {selectedSession.section ? `CSE ${selectedSession.section}` : 'General Section'}
            </span>
            <h2 className="text-base font-extrabold text-[#111827] mt-1">
              {selectedSession.subject || 'Subject Session'}
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1 border-t border-slate-100">
            <div>
              <span className="text-slate-400 font-semibold block text-[10px]">Faculty</span>
              <span className="font-bold text-slate-800">{selectedSession.faculty_name || 'Assigned Faculty'}</span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold block text-[10px]">Location</span>
              <span className="font-bold text-slate-800">{selectedSession.room || 'Room not assigned'}</span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold block text-[10px]">Started At</span>
              <span className="font-bold text-slate-800">
                {selectedSession.start_time ? new Date(selectedSession.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not available'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold block text-[10px]">Status</span>
              <span className={`font-bold ${selectedSession.status === 'ACTIVE' ? 'text-emerald-700' : 'text-slate-500'}`}>
                {selectedSession.status === 'ACTIVE' ? 'Ongoing Session' : 'Ended'}
              </span>
            </div>
          </div>
        </div>

        {/* 4 KPI Counters */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white rounded-xl p-2.5 border border-slate-200/70 text-center shadow-xs">
            <span className="text-lg font-black text-slate-800 block leading-tight">{totalStudents}</span>
            <span className="text-[10px] font-semibold text-slate-400">Total</span>
          </div>
          <div className="bg-white rounded-xl p-2.5 border border-emerald-200/80 text-center shadow-xs bg-emerald-50/20">
            <span className="text-lg font-black text-emerald-700 block leading-tight">{presentCount}</span>
            <span className="text-[10px] font-semibold text-emerald-700">Present</span>
          </div>
          <div className="bg-white rounded-xl p-2.5 border border-amber-200/80 text-center shadow-xs bg-amber-50/20">
            <span className="text-lg font-black text-amber-600 block leading-tight">{pendingCount}</span>
            <span className="text-[10px] font-semibold text-amber-600">Pending</span>
          </div>
          <div className="bg-white rounded-xl p-2.5 border border-red-200/80 text-center shadow-xs bg-red-50/20">
            <span className="text-lg font-black text-red-600 block leading-tight">{flaggedCount}</span>
            <span className="text-[10px] font-semibold text-red-600">Review</span>
          </div>
        </div>

        {/* Segmented Detail Toggle */}
        <div className="flex bg-slate-200/70 p-0.5 rounded-xl">
          <button
            type="button"
            onClick={() => setSessionDetailTab('students')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
              sessionDetailTab === 'students' ? 'bg-white text-[#1A4731] shadow-xs' : 'text-slate-600'
            }`}
          >
            Student List
          </button>
          <button
            type="button"
            onClick={() => setSessionDetailTab('analytics')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
              sessionDetailTab === 'analytics' ? 'bg-white text-[#1A4731] shadow-xs' : 'text-slate-600'
            }`}
          >
            Analytics
          </button>
        </div>

        {sessionDetailTab === 'students' ? (
          <div className="space-y-3">
            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name or roll no..."
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1A4731]/20"
              />
            </div>

            {/* Roster List */}
            {loadingRoster ? (
              <div className="py-12 text-center text-xs text-slate-400 font-semibold flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-[#1A4731]" />
                Loading live roster...
              </div>
            ) : filteredRoster.length === 0 ? (
              <div className="py-10 text-center bg-white rounded-2xl border border-dashed border-slate-200 p-6">
                <p className="text-xs font-bold text-slate-700">No student records found</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Students marking attendance will appear here live.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredRoster.map((student, idx) => {
                  const isPresent = student.status === 'PRESENT';
                  const isPending = student.status === 'PENDING' || student.status === 'PENDING_APPROVAL';
                  const isFlagged = student.status === 'FLAGGED' || student.flagged;

                  return (
                    <div
                      key={student.roll_no || idx}
                      onClick={() => onSelectStudent && onSelectStudent(student.roll_no)}
                      className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-2xs flex items-center justify-between cursor-pointer hover:border-slate-300 transition"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-[#1A4731]/10 text-[#1A4731] font-extrabold text-xs flex items-center justify-center ring-1 ring-[#1A4731]/20">
                          {(student.name || 'S').charAt(0)}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 leading-tight">
                            {student.name || 'Student Name'}
                          </h4>
                          <span className="text-[10px] font-semibold text-slate-400">
                            {student.roll_no}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isPresent && (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold border border-emerald-200">
                            Present
                          </span>
                        )}
                        {isPending && (
                          <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-extrabold border border-blue-200">
                            Verifying...
                          </span>
                        )}
                        {isFlagged && (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-extrabold border border-amber-200">
                            Review
                          </span>
                        )}
                        {!isPresent && !isPending && !isFlagged && (
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">
                            Absent
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 space-y-4">
            <h3 className="text-xs font-extrabold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#1A4731]" />
              Session Real-Time Analytics
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-slate-600">Turnout Rate</span>
                  <span className="font-extrabold text-emerald-700">
                    {totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full"
                    style={{ width: `${totalStudents > 0 ? (presentCount / totalStudents) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-[11px] text-slate-600">
                <div className="flex justify-between">
                  <span>Geofence Compliance:</span>
                  <span className="font-bold text-emerald-700">
                    {roster.filter(r => r.distance_meters !== null && r.distance_meters <= 150).length > 0
                      ? `${roster.filter(r => r.distance_meters !== null && r.distance_meters <= 150).length} verified within 150m`
                      : 'Not available'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Biometric Verification:</span>
                  <span className="font-bold text-emerald-700">
                    {roster.filter(r => r.face_status === 'VERIFIED').length > 0
                      ? `${roster.filter(r => r.face_status === 'VERIFIED').length} verified faces`
                      : 'Not available'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Anti-Spoof Policy:</span>
                  <span className="font-bold text-slate-800">Passive Eye-Blink Challenge</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Screen 4: Live Sessions Monitor List
  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-1 -ml-1 text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h1 className="text-base font-extrabold text-[#111827] tracking-tight">
            Live Sessions
          </h1>
        </div>
      </div>

      {/* Segmented Ongoing vs Completed Tabs */}
      <div className="flex bg-slate-200/80 p-0.5 rounded-xl">
        <button
          type="button"
          onClick={() => setActiveTab('ongoing')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
            activeTab === 'ongoing' ? 'bg-[#1A4731] text-white shadow-xs' : 'text-slate-600'
          }`}
        >
          Ongoing ({ongoingSessions.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('completed')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
            activeTab === 'completed' ? 'bg-[#1A4731] text-white shadow-xs' : 'text-slate-600'
          }`}
        >
          Completed ({completedSessions.length})
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search subject, faculty, section..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 bg-white rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1A4731]/20 shadow-2xs"
        />
      </div>

      {/* Sessions Cards */}
      {displayedSessions.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 p-6">
          <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <h3 className="text-xs font-bold text-slate-700">No {activeTab} sessions</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {activeTab === 'ongoing' ? 'No attendance sessions are currently running.' : 'No completed sessions recorded.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedSessions.map((session) => {
            const isLive = session.status === 'ACTIVE';
            const present = session.present_count || 0;
            const total = session.total_students || 0;

            return (
              <div
                key={session.id}
                onClick={() => setSelectedSession(session)}
                className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs hover:shadow-xs hover:border-[#1A4731]/30 transition cursor-pointer space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs ${
                      isLive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {session.subject ? session.subject.substring(0, 2).toUpperCase() : 'OS'}
                    </div>
                    <div>
                      <h3 className="text-xs font-extrabold text-[#111827] leading-tight">
                        {session.subject || 'Lecture Session'}
                      </h3>
                      <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                        {session.section ? `Section ${session.section}` : 'General'} &bull; {session.faculty_name || 'Assigned Faculty'}
                      </p>
                    </div>
                  </div>

                  {isLive && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {session.start_time ? new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Time not specified'}
                    </span>
                  </div>
                  {isLive && (
                    <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      Active Lecture
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-xs font-bold text-slate-700">
                    <span className="text-emerald-700 font-extrabold">{present}</span> {total > 0 ? `/ ${total} present` : 'present'}
                  </span>
                  <div className="flex items-center text-xs font-bold text-[#1A4731] hover:underline">
                    <span>Details</span>
                    <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
