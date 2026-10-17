import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Play, Users, ShieldAlert, CheckCircle2, XCircle, Clock, AlertTriangle,
  RefreshCw, Smartphone, Search, Check, Sparkles, UserCheck, ShieldCheck
} from 'lucide-react';
import { api } from '../api';

export default function FacultyPortal({ user }) {
  const [subject, setSubject] = useState('CS301 - Operating Systems');
  const [activeSession, setActiveSession] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [starting, setStarting] = useState(false);
  const [searchRoster, setSearchRoster] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [manualSuccessMsg, setManualSuccessMsg] = useState(null);

  // Pre-populated class roster for 1-click manual override
  const [roster, setRoster] = useState([
    { roll_no: 'STU01', name: 'Aarav Sharma', department: 'CSE', status: 'UNMARKED' },
    { roll_no: 'STU02', name: 'Priya Patel', department: 'CSE', status: 'UNMARKED' },
    { roll_no: 'STU03', name: 'Rohan Verma', department: 'CSE', status: 'UNMARKED' },
    { roll_no: 'STU04', name: 'Neha Gupta', department: 'CSE', status: 'UNMARKED' }
  ]);

  // Start lecture session
  const handleStartSession = async () => {
    setStarting(true);
    try {
      const res = await api.startSession({
        subject_name: subject,
        faculty_id: user.faculty_id || 'FAC01',
        class_lat: 19.0760,
        class_lng: 72.8777
      });
      setActiveSession(res.session);
    } catch (err) {
      alert('Error starting session: ' + err.message);
    } finally {
      setStarting(false);
    }
  };

  // Poll dynamic rotating QR code every 1 second
  useEffect(() => {
    let timer;
    if (activeSession?.session_id) {
      const fetchQR = async () => {
        try {
          const data = await api.getSessionQR(activeSession.session_id);
          setQrData(data);
        } catch (err) {
          console.error('Error polling QR:', err);
        }
      };

      const fetchLiveStatus = async () => {
        try {
          const live = await api.getFacultyLiveSession(activeSession.session_id);
          setLiveData(live);
        } catch (err) {
          console.error('Error fetching live session data:', err);
        }
      };

      fetchQR();
      fetchLiveStatus();
      timer = setInterval(() => {
        fetchQR();
        fetchLiveStatus();
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [activeSession?.session_id]);

  // Handle Faculty Manual Override (Phone Dead / Malfunction)
  const handleManualOverride = async (rollNo, studentName) => {
    if (!activeSession) {
      alert('Please start a lecture session first before marking attendance!');
      return;
    }
    setActionLoading(true);
    try {
      await api.facultyManualAttendance({
        session_id: activeSession.session_id,
        roll_no: rollNo,
        status: 'PRESENT',
        faculty_id: user.faculty_id || 'FAC01',
        reason: 'Phone Dead / In-Person Verification by Teacher'
      });

      // Update local roster UI
      setRoster(prev => prev.map(s => s.roll_no === rollNo ? { ...s, status: 'MANUAL_PRESENT' } : s));
      setManualSuccessMsg(`Student ${studentName} (${rollNo}) marked PRESENT (Faculty Override).`);
      setTimeout(() => setManualSuccessMsg(null), 4000);
    } catch (err) {
      alert('Manual override failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Exception Mode Approval/Rejection
  const handleApproveException = async (rollNo, action) => {
    setActionLoading(true);
    try {
      await api.facultyApprove({
        session_id: activeSession.session_id,
        roll_no: rollNo,
        action: action,
        remarks: `Faculty ${action.toLowerCase()}d exception in classroom.`
      });

      // Refresh live feed immediately
      const live = await api.getFacultyLiveSession(activeSession.session_id);
      setLiveData(live);
    } catch (err) {
      alert('Approval action failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredRoster = roster.filter(s =>
    s.name.toLowerCase().includes(searchRoster.toLowerCase()) ||
    s.roll_no.toLowerCase().includes(searchRoster.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-6">

      {/* Top Banner & Session Starter */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              FACULTY CONSOLE
            </span>
            <span className="text-xs text-slate-400">Classroom Lab 302 (GPS: 19.0760, 72.8777)</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white mt-1">Live Lecture & Smart Anti-Proxy Center</h1>
          <p className="text-xs text-slate-400">
            Broadcasting 5-second dynamic encrypted tokens with real-time hardware fraud detection.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={Boolean(activeSession)}
            className="bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-brand-500 disabled:opacity-60"
          >
            <option value="CS301 - Operating Systems">CS301 - Operating Systems</option>
            <option value="CS402 - Machine Learning">CS402 - Machine Learning</option>
            <option value="CS305 - Database Systems">CS305 - Database Systems</option>
          </select>

          {!activeSession ? (
            <button
              onClick={handleStartSession}
              disabled={starting}
              className="px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-500/25 flex items-center gap-2 transition active:scale-95 disabled:opacity-50"
            >
              {starting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
              Start Lecture Session
            </button>
          ) : (
            <div className="px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              SESSION ACTIVE: {activeSession.session_id}
            </div>
          )}
        </div>
      </div>

      {manualSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{manualSuccessMsg}</span>
        </div>
      )}

      {/* Main Grid: Rotating QR Code Panel + Live Counters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Column 1: Rotating 5-Second QR Code Projector View */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="absolute top-3 left-4 flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5 text-brand-400" /> Rotating Token
          </div>

          {activeSession && qrData ? (
            <div className="space-y-4 pt-4 w-full flex flex-col items-center">
              {/* QR Code Container */}
              <div className="p-4 rounded-2xl bg-white shadow-2xl shadow-brand-500/10 border-4 border-slate-800">
                <QRCodeSVG
                  value={qrData.qr_token}
                  size={210}
                  level="H"
                  includeMargin={true}
                />
              </div>

              {/* 5-Second Visual Progress Bar */}
              <div className="w-full max-w-xs space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-400">Refreshes in</span>
                  <span className="text-brand-400 font-mono text-sm">{qrData.expires_in_seconds}s</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-brand-500 to-indigo-400 transition-all duration-300 ease-linear rounded-full"
                    style={{ width: `${(qrData.expires_in_seconds / 5) * 100}%` }}
                  ></div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400 truncate max-w-xs">
                {qrData.qr_token}
              </div>
            </div>
          ) : (
            <div className="py-16 text-slate-500 space-y-2">
              <Play className="w-12 h-12 mx-auto text-slate-600 stroke-1" />
              <p className="text-xs font-medium">Click "Start Lecture Session" to project the rotating dynamic QR code.</p>
            </div>
          )}
        </div>

        {/* Column 2 & 3: Live Counters & Class Roster with 1-Click Manual Override */}
        <div className="lg:col-span-2 space-y-6">

          {/* Counters Row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="glass-card rounded-2xl p-4 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Present in Class</span>
              <p className="text-2xl font-black text-emerald-400 mt-1">
                {liveData?.counters?.present_count || 0}
              </p>
            </div>
            <div className="glass-card rounded-2xl p-4 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Pending Approvals</span>
              <p className="text-2xl font-black text-amber-400 mt-1">
                {liveData?.counters?.pending_count || 0}
              </p>
            </div>
            <div className="glass-card rounded-2xl p-4 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Proxy Alerts Caught</span>
              <p className="text-2xl font-black text-rose-400 mt-1">
                {liveData?.counters?.alerts_count || 0}
              </p>
            </div>
          </div>

          {/* Teacher Manual Attendance Override Panel */}
          <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  Teacher Manual Attendance Override
                </h3>
                <p className="text-[11px] text-slate-400">
                  For students without a phone, battery dead, or screen malfunction. Bypasses 5 gates with teacher signature.
                </p>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchRoster}
                  onChange={(e) => setSearchRoster(e.target.value)}
                  placeholder="Search Roll No..."
                  className="bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            {/* Roster Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                    <th className="py-2.5 px-3">Roll No</th>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">Dept</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredRoster.map((s) => (
                    <tr key={s.roll_no} className="hover:bg-slate-900/40">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-300">{s.roll_no}</td>
                      <td className="py-2.5 px-3 text-slate-200 font-medium">{s.name}</td>
                      <td className="py-2.5 px-3 text-slate-400">{s.department}</td>
                      <td className="py-2.5 px-3 text-right">
                        {s.status === 'MANUAL_PRESENT' ? (
                          <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 font-semibold text-[11px] inline-flex items-center gap-1">
                            <Check className="w-3 h-3" /> Marked Present
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleManualOverride(s.roll_no, s.name)}
                            disabled={actionLoading}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] shadow transition active:scale-95 disabled:opacity-50"
                          >
                            Mark Present Manually
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>

      {/* Exception Approval Queue & Live Security Red Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 1. Exception Approval Queue (Selfies of Borrowed Phones) */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-amber-400" />
              Exception Mode Approval Queue
            </h3>
            <span className="text-xs font-mono font-bold text-amber-400">
              {liveData?.pending_approvals?.length || 0} Pending
            </span>
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {liveData?.pending_approvals?.length ? (
              liveData.pending_approvals.map((req, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-slate-900/90 border border-amber-500/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {req.live_selfie_base64 && (
                      <img
                        src={req.live_selfie_base64}
                        alt="Selfie"
                        className="w-12 h-12 rounded-lg object-cover border border-amber-500/40"
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-white">{req.student_name}</span>
                        <span className="font-mono text-[10px] text-amber-300">({req.roll_no})</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-mono truncate max-w-[180px]">
                        Device: {req.device_id}
                      </p>
                      <p className="text-[10px] text-emerald-400 font-semibold">
                        GPS: {req.distance_meters}m | Face: {req.face_match_score}%
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleApproveException(req.roll_no, 'APPROVE')}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApproveException(req.roll_no, 'REJECT')}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 py-6 text-center">No pending exception requests currently.</p>
            )}
          </div>
        </div>

        {/* 2. Real-Time Anti-Proxy Security Alerts (Red Feed) */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-rose-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              Live Anti-Proxy Security Alerts (Caught Frauds)
            </h3>
            <span className="text-xs font-mono font-bold text-rose-400">
              {liveData?.security_alerts?.length || 0} Alerts
            </span>
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {liveData?.security_alerts?.length ? (
              liveData.security_alerts.map((alert, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-300 font-mono text-[11px]">{alert.failed_gate}</span>
                    <span className="text-[10px] text-slate-400 font-mono">Roll: {alert.roll_no}</span>
                  </div>
                  <p className="text-slate-300 text-[11px]">{alert.reason}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 py-6 text-center">No security alerts or fraud attempts detected in this lecture.</p>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
