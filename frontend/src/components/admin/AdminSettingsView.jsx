import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Calendar, BookOpen, ShieldCheck, MapPin, Smartphone,
  Bell, Database, History, QrCode, Sun, ChevronRight, X, RefreshCw,
  Lock, CheckCircle2, Sliders
} from 'lucide-react';
import { api } from '../../api';
import InstallAppButton from '../InstallAppButton';

export default function AdminSettingsView({
  onBack,
  onOpenAuditLogs
}) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSettingModal, setSelectedSettingModal] = useState(null);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.getAdminSettings();
      setSettings(data.settings || data);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAuditLogs = async () => {
    setAuditModalOpen(true);
    setLoadingAudit(true);
    try {
      const data = await api.getAuditLogs({ limit: 50 });
      setAuditLogs(data.audit_logs || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  const settingsList = [
    {
      id: 'academic_year',
      icon: Calendar,
      title: 'Academic Year',
      value: settings?.academic_year || '2026 - 2027',
      description: 'Current institution active academic calendar year'
    },
    {
      id: 'semester',
      icon: BookOpen,
      title: 'Semester',
      value: settings?.semester || '6th Semester',
      description: 'Active semester for timetable schedules and class enrolment'
    },
    {
      id: 'attendance_rules',
      icon: ShieldCheck,
      title: 'Attendance Rules',
      value: `${settings?.min_attendance_threshold || 75}% Minimum Criteria`,
      description: 'Institutional threshold below which students are flagged as defaulters'
    },
    {
      id: 'face_verification',
      icon: ShieldCheck,
      title: 'Face Verification Settings',
      value: `InsightFace ArcFace (${settings?.face_match_threshold || 0.60})`,
      description: 'Cosine distance threshold and passive eye blink anti-spoof checks'
    },
    {
      id: 'geofence',
      icon: MapPin,
      title: 'Location & Geofence',
      value: `${settings?.geofence_radius_meters || 150}m Radius`,
      description: 'Haversine GPS boundary enforcement around institute lecture blocks'
    },
    {
      id: 'device_validation',
      icon: Smartphone,
      title: 'Device & Network Validation',
      value: settings?.device_binding_enabled ? 'Strict 1-Phone Lock' : 'Relaxed',
      description: 'Hardware fingerprint binding preventing students from proxy marking'
    },
    {
      id: 'notifications',
      icon: Bell,
      title: 'System Notifications',
      value: 'In-App Alerts',
      description: 'Automated warnings when student attendance drops below 75%'
    },
    {
      id: 'backup',
      icon: Database,
      title: 'Backup & Data Management',
      value: 'PostgreSQL Auto-sync',
      description: 'Database replication and audit trail preservation'
    },
    {
      id: 'audit_logs',
      icon: History,
      title: 'Audit Logs',
      value: 'Security Log >',
      isAction: true,
      onClick: handleOpenAuditLogs,
      description: 'Tamper-evident logs of manual overrides, approvals, and device unlocks'
    },
    {
      id: 'qr_expiry',
      icon: QrCode,
      title: 'Manage QR Expiry',
      value: `${settings?.qr_window_seconds || 20}s Rotation`,
      description: 'Dynamic TOTP session token refresh window preventing photo-sharing'
    },
    {
      id: 'appearance',
      icon: Sun,
      title: 'App Appearance',
      value: 'Light',
      description: 'Theme configured with Forest Green & Warm White palette'
    }
  ];

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
            System Settings
          </h1>
        </div>

        <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-extrabold tracking-wide uppercase">
          Policy (Read-Only)
        </span>
      </div>

      {/* Settings List (Reference Screen 14) */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs divide-y divide-slate-100 overflow-hidden">
        {settingsList.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.id}
              onClick={() => {
                if (item.onClick) item.onClick();
                else setSelectedSettingModal(item);
              }}
              className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-50/80 transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-[#1A4731]" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-[#111827]">
                    {item.title}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-semibold block">
                    {item.description}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-bold text-slate-600 text-[11px] max-w-[110px] truncate text-right">
                  {item.value}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          );
        })}
      </div>

      {/* PWA Install Button (Shown on phone if not installed) */}
      <InstallAppButton variant="profile" />

      {/* Detail / Config Modal */}
      {selectedSettingModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">
                {selectedSettingModal.title}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedSettingModal(null)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Configured Value:</span>
                <span className="font-bold text-[#1A4731]">{selectedSettingModal.value}</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {selectedSettingModal.description}.
              </p>
              <div className="pt-1 border-t border-slate-200/60 text-[10px] text-slate-400 font-semibold">
                🔒 Parameter is read-only and enforced by server environment configuration.
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedSettingModal(null)}
              className="w-full py-2.5 rounded-xl bg-[#1A4731] text-white font-bold text-xs"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Audit Logs Modal */}
      {auditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 space-y-4 border border-slate-200 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#1A4731]" />
                <h3 className="text-sm font-extrabold text-slate-900">
                  Institutional Audit Logs
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAuditModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {loadingAudit ? (
                <div className="py-12 text-center text-xs text-slate-400 font-semibold flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#1A4731]" />
                  Fetching audit trail...
                </div>
              ) : auditLogs.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">No security events logged yet.</p>
              ) : (
                auditLogs.map((log, idx) => (
                  <div
                    key={log.id || idx}
                    className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-900">
                        {log.action || 'ADMIN_ACTION'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        {log.created_at ? new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 font-medium">
                      {log.details || log.reason || log.description || `Executed on target ${log.target_user || 'system'}`}
                    </p>
                    <span className="text-[10px] text-[#1A4731] font-bold block">
                      Actor: {log.user_id || 'admin'}
                    </span>
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => setAuditModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs shrink-0"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
