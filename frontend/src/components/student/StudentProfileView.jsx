import React from 'react';
import {
  ArrowLeft, User, ShieldCheck, ChevronRight, FileText, Calendar,
  Camera, Settings, Bell, Edit3, Fingerprint, Lock
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
  onOpenNotifications
}) {
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
    </div>
  );
}
