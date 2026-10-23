import React, { useState } from 'react';
import {
  Bell, AlertTriangle, CheckCircle2, X, ChevronRight, ShieldAlert,
  Flame, Clock, Check, Sparkles, Compass, RotateCcw, Target
} from 'lucide-react';
import { api } from '../api';

export default function StudentNotificationCenter({
  studentRollNo,
  notifications = [],
  unreadCount = 0,
  attendanceAlert = null,
  onNotificationUpdate,
  onOpenRecoveryRoadmap
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterUnread, setFilterUnread] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [dismissedAlertId, setDismissedAlertId] = useState(null);

  // Filter list based on toggle
  const displayedNotifications = filterUnread
    ? notifications.filter(n => !n.is_read)
    : notifications;

  const handleMarkAsRead = async (id, e) => {
    e?.stopPropagation();
    try {
      await api.markNotificationRead(studentRollNo, id);
      if (onNotificationUpdate) onNotificationUpdate();
    } catch (err) {
      console.warn('Failed to mark notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setActionLoading(true);
      await api.markAllNotificationsRead(studentRollNo);
      if (onNotificationUpdate) onNotificationUpdate();
    } catch (err) {
      console.warn('Failed to mark all read:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDismiss = async (id, e) => {
    e?.stopPropagation();
    try {
      setDismissedAlertId(id);
      await api.dismissNotification(studentRollNo, id);
      if (onNotificationUpdate) onNotificationUpdate();
    } catch (err) {
      console.warn('Failed to dismiss notification:', err);
    }
  };

  const handleTriggerTestAlert = async () => {
    try {
      setActionLoading(true);
      await api.triggerTestWarningAlert(studentRollNo);
      if (onNotificationUpdate) onNotificationUpdate();
    } catch (err) {
      console.warn('Failed to trigger test alert:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Determine if primary alert banner should show
  const activeAlert = attendanceAlert && attendanceAlert.id !== dismissedAlertId && !attendanceAlert.is_dismissed
    ? attendanceAlert
    : null;

  return (
    <>
      {/* 1. URGENT STICKY ATTENDANCE DEFICIT BANNER (< 74%) */}
      {activeAlert && (
        <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-r from-rose-950/80 via-amber-950/40 to-slate-900 border-2 border-rose-500/60 shadow-xl shadow-rose-950/40 relative overflow-hidden animate-in fade-in slide-in-from-top-3 duration-500">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-2xl pointer-events-none opacity-20 -mr-16 -mt-16 bg-rose-500 animate-pulse" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center shrink-0 mt-0.5 shadow-inner">
                <AlertTriangle className="w-6 h-6 animate-bounce" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500 text-white font-mono shadow-sm">
                    ATTENDANCE WARNING: CRITICAL DEFICIT (&lt; 74%)
                  </span>
                  <span className="text-xs text-rose-300 font-bold font-mono">
                    Current: {activeAlert.current_pct}%
                  </span>
                  <span className="text-[11px] text-slate-400">
                    • University UGC Minimum: 75.0%
                  </span>
                </div>

                <h3 className="text-sm sm:text-base font-extrabold text-white">
                  {activeAlert.subject_name
                    ? `Your attendance in ${activeAlert.subject_code} (${activeAlert.subject_name}) has dropped to ${activeAlert.current_pct}%!`
                    : `Your overall attendance has dropped to ${activeAlert.current_pct}%, falling below the 74.0% threshold!`}
                </h3>

                <p className="text-xs text-rose-200/90 leading-relaxed font-medium">
                  🚨 <strong>Detention Action Required:</strong> You are currently ineligible for exam hall ticket release.
                  You must attend the next <strong className="text-white text-sm underline decoration-rose-400 font-black">{activeAlert.classes_needed} consecutive lecture{activeAlert.classes_needed !== 1 ? 's' : ''}</strong> to recover above the 75.0% criteria.
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2.5 shrink-0 self-stretch md:self-auto justify-end">
              <button
                type="button"
                onClick={() => {
                  if (onOpenRecoveryRoadmap) {
                    onOpenRecoveryRoadmap(activeAlert.subject_code || 'CS301');
                  }
                }}
                className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-black shadow-lg shadow-rose-600/30 active:scale-95 transition flex items-center justify-center gap-2"
              >
                <Compass className="w-4 h-4" />
                <span>Open Recovery Roadmap &rarr;</span>
              </button>

              <button
                type="button"
                onClick={(e) => handleDismiss(activeAlert.id, e)}
                className="px-3 py-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-semibold transition"
                title="Dismiss Banner"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. NOTIFICATION BELL TRIGGER (Rendered in top bar) */}
      <div className="relative inline-block">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition active:scale-95 shadow-inner"
          title="Student Attendance Notifications & Alerts"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white border-2 border-slate-950 animate-pulse shadow-md shadow-rose-500/50">
              {unreadCount}
            </span>
          )}
        </button>

        {/* 3. SLIDE-OVER / MODAL NOTIFICATION DRAWER */}
        {isOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-slate-950 border-l border-slate-800 h-full flex flex-col shadow-2xl relative animate-in slide-in-from-right duration-300">
              {/* Drawer Header */}
              <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Attendance Notifications</h3>
                    <p className="text-[11px] text-slate-400">Automated 74% threshold &amp; recovery alerts</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Sub-bar Controls */}
              <div className="px-4 py-2.5 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFilterUnread(false)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                      !filterUnread ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All ({notifications.length})
                  </button>
                  <button
                    onClick={() => setFilterUnread(true)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                      filterUnread ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Unread ({unreadCount})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      disabled={actionLoading}
                      className="text-[11px] text-indigo-400 hover:underline font-semibold"
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={handleTriggerTestAlert}
                    disabled={actionLoading}
                    className="px-2 py-0.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded text-[10px] font-bold transition"
                    title="Simulate a live < 74% attendance drop alert"
                  >
                    🧪 Test Alert
                  </button>
                </div>
              </div>

              {/* Notifications List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {displayedNotifications.length === 0 ? (
                  <div className="text-center py-16 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-300">No active alerts!</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Your attendance is within safe university benchmarks.</p>
                    </div>
                    <button
                      onClick={handleTriggerTestAlert}
                      className="px-3 py-1.5 bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-semibold hover:bg-indigo-600/30 transition"
                    >
                      Trigger Demo &lt; 74% Alert
                    </button>
                  </div>
                ) : (
                  displayedNotifications.map((notif) => {
                    const isCritical = notif.severity === 'CRITICAL';
                    return (
                      <div
                        key={notif.id}
                        onClick={() => handleMarkAsRead(notif.id)}
                        className={`p-3.5 rounded-2xl border transition relative overflow-hidden cursor-pointer ${
                          !notif.is_read
                            ? isCritical
                              ? 'bg-rose-950/30 border-rose-500/40 shadow-sm'
                              : 'bg-indigo-950/30 border-indigo-500/40 shadow-sm'
                            : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        {/* Unread dot */}
                        {!notif.is_read && (
                          <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                        )}

                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              isCritical
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                            }`}>
                              {isCritical ? '⚠️ DEFICIT ALERT (< 74%)' : 'INFO'}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {notif.created_at ? new Date(notif.created_at).toLocaleDateString() : 'Today'}
                            </span>
                          </div>

                          <div>
                            <h4 className="text-xs font-bold text-white leading-snug">{notif.title}</h4>
                            <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">{notif.message}</p>
                          </div>

                          {/* Attendance Metrics Pill */}
                          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs">
                            <div>
                              <span className="text-[10px] text-slate-400 uppercase font-bold block">Current Standing</span>
                              <span className="font-mono font-bold text-rose-400 text-xs">
                                {notif.current_pct}% (Below 74%)
                              </span>
                            </div>

                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 uppercase font-bold block">Consecutive Recovery</span>
                              <span className="font-mono font-bold text-emerald-400 text-xs">
                                Attend Next {notif.classes_needed} Lectures
                              </span>
                            </div>
                          </div>

                          {/* Action Button */}
                          <div className="flex items-center justify-between pt-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsOpen(false);
                                if (onOpenRecoveryRoadmap) {
                                  onOpenRecoveryRoadmap(notif.subject_code || 'CS301');
                                }
                              }}
                              className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                            >
                              <span>View Recovery Roadmap</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => handleDismiss(notif.id, e)}
                              className="text-[10px] text-slate-500 hover:text-slate-300"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer regulatory rule note */}
              <div className="p-3 border-t border-slate-800 bg-slate-900/40 text-[10px] text-slate-400 text-center">
                Institutional Policy: Automated warning triggers at 74.0% to prevent dropping below the 75.0% UGC criteria.
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
