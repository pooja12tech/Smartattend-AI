import React, { useState, useMemo } from 'react';
import { ArrowLeft, Bell, BookOpen, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

export default function StudentNotificationsView({
  notifications = [],
  onBack,
  onMarkAllRead
}) {
  const [filterTab, setFilterTab] = useState('ALL'); // 'ALL' | 'CLASSES' | 'SYSTEM'

  const filteredNotifs = useMemo(() => {
    if (filterTab === 'ALL') return notifications;
    if (filterTab === 'CLASSES') {
      return notifications.filter(n => (n.title || n.message || '').toLowerCase().includes('class') || (n.title || n.message || '').toLowerCase().includes('session'));
    }
    if (filterTab === 'SYSTEM') {
      return notifications.filter(n => !(n.title || n.message || '').toLowerCase().includes('class') && !(n.title || n.message || '').toLowerCase().includes('session'));
    }
    return notifications;
  }, [notifications, filterTab]);

  return (
    <div className="space-y-4">
      {/* Top Header: < Notifications (Screen 20 Reference) */}
      <div className="sticky top-0 z-20 bg-[#F8FAF9]/95 backdrop-blur-md py-2.5 -mx-4 px-4 flex items-center justify-between border-b border-slate-200/60 select-none">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 min-h-[44px] min-w-[44px] text-[#111827] active:scale-[0.97] font-extrabold text-base focus:outline-none transition"
        >
          <ArrowLeft className="w-5 h-5 text-slate-700" />
          <span>Notifications</span>
        </button>

        {onMarkAllRead && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="min-h-[44px] px-2 text-xs font-semibold text-[#1A4731] hover:underline active:scale-[0.97] transition"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Filter Pills: [ All | Classes | System ] (Screen 20 Reference) */}
      <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
        <button
          type="button"
          onClick={() => setFilterTab('ALL')}
          className={`flex-1 min-h-[44px] py-2 text-xs font-bold rounded-xl transition-all active:scale-[0.97] ${
            filterTab === 'ALL'
              ? 'bg-[#1A4731] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          All
        </button>

        <button
          type="button"
          onClick={() => setFilterTab('CLASSES')}
          className={`flex-1 min-h-[44px] py-2 text-xs font-bold rounded-xl transition-all active:scale-[0.97] ${
            filterTab === 'CLASSES'
              ? 'bg-[#1A4731] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Classes
        </button>

        <button
          type="button"
          onClick={() => setFilterTab('SYSTEM')}
          className={`flex-1 min-h-[44px] py-2 text-xs font-bold rounded-xl transition-all active:scale-[0.97] ${
            filterTab === 'SYSTEM'
              ? 'bg-[#1A4731] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          System
        </button>
      </div>

      {/* Notification Cards List (Screen 20 Reference) */}
      <div className="space-y-2.5">
        {filteredNotifs.length > 0 ? (
          filteredNotifs.map((notif, idx) => {
            const isRead = notif.is_read;
            const timeAgo = notif.created_at
              ? new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '2 min ago';

            return (
              <div
                key={notif.id || idx}
                className={`bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm flex items-start gap-3 transition ${
                  !isRead ? 'ring-1 ring-emerald-300' : ''
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0 mt-0.5">
                  <Bell className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-[#111827] leading-snug">
                      {notif.title || 'Attendance Notification'}
                    </h4>
                    <span className="text-[11px] text-slate-400 shrink-0 whitespace-nowrap">
                      {timeAgo}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {notif.message || notif.details}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/90 text-slate-500 space-y-2">
            <Bell className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-xs font-bold text-slate-700">No notifications</p>
            <p className="text-[11px] text-slate-400">Class alerts and system announcements will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
