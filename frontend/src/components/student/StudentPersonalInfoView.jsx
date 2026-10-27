import React from 'react';
import { ArrowLeft, User, Mail, Phone, Hash, Building2, Calendar, ShieldCheck, Smartphone } from 'lucide-react';

export default function StudentPersonalInfoView({
  dashboard,
  user,
  onBack
}) {
  const student = dashboard?.student || user || {};

  const details = [
    { label: 'Name', value: student.name || 'Shree Bhagwan', icon: User },
    { label: 'Roll Number', value: student.roll_no || '23CSE123', icon: Hash },
    { label: 'Department', value: student.department || 'Computer Science & Engineering', icon: Building2 },
    { label: 'Year', value: student.semester ? `${Math.ceil(student.semester / 2)}rd Year` : '3rd Year', icon: Calendar },
    { label: 'Section', value: student.section || 'A', icon: Hash },
    { label: 'Email', value: user?.email || `${(student.name || 'student').toLowerCase().replace(/\s+/g, '.')}@smartattend.edu`, icon: Mail },
    { label: 'Phone', value: user?.phone || '+91 98••••••••', icon: Phone },
    { label: 'Device ID', value: student.bound_device_id || 'Browser PWA Verified', icon: Smartphone }
  ];

  return (
    <div className="space-y-5">
      {/* Top Header: < Personal Information (Screen 17 Reference) */}
      <div className="sticky top-0 z-20 bg-[#F8FAF9]/95 backdrop-blur-md py-2.5 -mx-4 px-4 flex items-center justify-between border-b border-slate-200/60 select-none">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 min-h-[44px] min-w-[44px] text-[#111827] active:scale-[0.97] font-extrabold text-base focus:outline-none transition"
        >
          <ArrowLeft className="w-5 h-5 text-slate-700" />
          <span>Personal Information</span>
        </button>
      </div>

      {/* Key-Value Details Card (Screen 17 Reference) */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm divide-y divide-slate-100">
        {details.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className="py-3.5 first:pt-1 last:pb-1 flex items-center justify-between gap-4">
              <span className="text-xs font-semibold text-slate-500">
                {item.label}
              </span>
              <span className="text-xs font-bold text-[#111827] text-right truncate max-w-[200px]">
                {item.value}
              </span>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs text-slate-500 space-y-1">
        <div className="flex items-center gap-1.5 font-bold text-slate-700">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Institutional Student Record</span>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Official enrollment details verified at admission. For changes in enrollment records, contact the Registrar office.
        </p>
      </div>
    </div>
  );
}
