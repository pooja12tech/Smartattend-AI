import React, { useState } from 'react';
import {
  ArrowLeft, User, ShieldCheck, ChevronRight, FileText, Calendar,
  Camera, Settings, Bell, Edit3, Fingerprint, Lock, LogOut, AlertTriangle
} from 'lucide-react';

export default function StudentProfileView({
  dashboard,
  user,
  onBack,
  onOpenPersonalInfo,
  onOpenAcademicDetails,
  onOpenAttendanceReport,
  onOpenTimetable,
  onOpenFaceEnroll,
  onOpenSettings,
  onOpenNotifications,
  onLogout
}) {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const student = dashboard?.student || user || {};
  const isEnrolled = student.has_registered_face ?? user?.has_registered_face ?? true;

  const menuItems = [
    {
      id: 'personal',
      label: 'Personal Information',
      icon: User,
      action: onOpenPersonalInfo
    },
    {
      id: 'academic',
      label: 'Academic Details',
      icon: FileText,
      action: onOpenAcademicDetails
    },
    {
      id: 'attendance',
      label: 'Attendance Report',
      icon: ShieldCheck,
      action: onOpenAttendanceReport
    },
    {
      id: 'timetable',
      label: 'My Timetable',
      icon: Calendar,
      action: onOpenTimetable
    },
    {
      id: 'biometric',
      label: 'Face ID / Biometric',
      icon: Camera,
      action: onOpenFaceEnroll,
      badge: isEnrolled ? 'Enrolled' : 'Not Enrolled',
      badgeColor: isEnrolled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      action: onOpenSettings
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      action: onOpenNotifications
    }
  ];

  const handleConfirmLogout = () => {
    setShowLogoutModal(false);
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header: < My Profile & Edit button (Screen 16 Reference) */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-[#111827] font-extrabold text-base focus:outline-none"
        >
          <ArrowLeft className="w-5 h-5 text-slate-700" />
          <span>My Profile</span>
        </button>

        <button
          type="button"
          onClick={onOpenPersonalInfo}
          className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 flex items-center gap-1.5 hover:bg-emerald-100 transition"
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>Edit</span>
        </button>
      </div>

      {/* Student Profile Card (Screen 16 Reference) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm text-center space-y-3">
        <div className="relative inline-block mx-auto">
          <div className="w-20 h-20 rounded-full bg-slate-100 border-4 border-emerald-100 flex items-center justify-center overflow-hidden shadow-sm">
            <User className="w-10 h-10 text-slate-600" />
          </div>
          <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-white" />
        </div>

        <div>
          <h3 className="text-lg font-black text-[#111827]">
            {student.name || 'Shree Bhagwan'}
          </h3>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            {student.roll_no || '23CSE123'}
          </p>
          <p className="text-xs text-slate-600 font-medium mt-1">
            {student.department || 'CSE'} - {student.semester ? `${Math.ceil(student.semester / 2)}th Year` : '3rd Year'} ({student.batch || '2023-2027'})
          </p>
        </div>
      </div>

      {/* Navigation Menu List (Screen 16 Reference) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden divide-y divide-slate-100">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.action}
              className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition focus:outline-none"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-sm font-semibold text-[#111827]">
                  {item.label}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {item.badge && (
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Account Section & Logout Button (Phase 2 Requirement) */}
      <div className="pt-1">
        <button
          type="button"
          id="btn-profile-logout"
          onClick={() => setShowLogoutModal(true)}
          className="w-full py-3.5 px-4 rounded-2xl bg-white border border-rose-200/90 hover:bg-rose-50/60 active:scale-[0.99] text-rose-600 font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition"
        >
          <LogOut className="w-4 h-4 text-rose-600" />
          <span>Log Out of SmartAttend</span>
        </button>
      </div>

      {/* Logout Confirmation Dialog Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm border border-slate-200 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <LogOut className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-extrabold text-[#111827]">
                Log Out of SmartAttend?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Are you sure you want to sign out? You will need your roll number and password to sign back in.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition focus:outline-none"
              >
                Cancel
              </button>

              <button
                type="button"
                id="btn-confirm-logout"
                onClick={handleConfirmLogout}
                className="py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition focus:outline-none"
              >
                Yes, Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
