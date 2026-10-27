import React, { useState } from 'react';
import {
  User, Mail, Phone, Hash, Building2, Calendar, ShieldCheck,
  Smartphone, GraduationCap, Award, BookOpen, Building, CheckCircle2,
  LogOut, Trash2
} from 'lucide-react';

export default function DesktopStudentProfile({
  dashboard,
  user,
  onLogout
}) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const student = dashboard?.student || user || {};

  const name = student.name || 'Aarav Sharma';
  const rollNo = student.roll_no || '23CSE123';
  const department = student.department || 'Computer Science & Engineering';
  const semester = student.semester || 6;
  const yearText = `${Math.ceil(semester / 2)}rd Year`;
  const section = student.section || 'A';
  const email = user?.email || student.email || `${name.toLowerCase().replace(/\s+/g, '.')}@smartattend.edu`;
  const phone = user?.phone || '+91 98••••••••';
  const cgpa = student.cgpa || '8.75';
  const batch = student.batch || '2023 - 2027';
  const university = 'GGSIPU';

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Personal details matching mobile PWA exactly
  const personalDetails = [
    { label: 'Full Name', value: name, icon: User },
    { label: 'Roll Number', value: rollNo, icon: Hash },
    { label: 'Department', value: department, icon: Building2 },
    { label: 'Academic Year', value: yearText, icon: Calendar },
    { label: 'Class Section', value: section, icon: Hash },
    { label: 'Official Email', value: email, icon: Mail },
    { label: 'Contact Phone', value: phone, icon: Phone },
    { label: 'Bound Mobile Device', value: student.bound_device_id || 'Registered Phone PWA Verified', icon: Smartphone }
  ];

  // Academic details matching mobile PWA exactly
  const academicDetails = [
    { label: 'Degree Program', value: 'B.Tech (Computer Science & Engineering)', icon: GraduationCap },
    { label: 'Matriculation Batch', value: batch, icon: Calendar },
    { label: 'Current Semester', value: `${semester}th Semester`, icon: BookOpen },
    { label: 'Cumulative CGPA', value: `${cgpa} / 10.0`, icon: Award },
    { label: 'Affiliated University', value: university, icon: Building },
    { label: 'Academic Department', value: department, icon: Building2 },
    { label: 'Curriculum Standing', value: 'Active / Regular Matriculated', icon: ShieldCheck }
  ];

  return (
    <div className="space-y-6 w-full">
      {/* Top Profile Header Card */}
      <div className="bg-white rounded-3xl p-7 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-[#1A4731] text-white flex items-center justify-center font-black text-2xl shadow-md border-2 border-emerald-300">
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-black text-[#111827] tracking-tight">
                {name}
              </h1>
              <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-[#EBF4EE] text-[#1A4731] border border-emerald-200 uppercase tracking-wide">
                Verified Student
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Roll No: <span className="font-mono font-bold text-slate-800">{rollNo}</span> &bull; {department} &bull; Semester {semester}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowLogoutConfirm(true)}
          className="px-5 py-2.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-bold text-xs flex items-center gap-2 transition cursor-pointer self-start md:self-auto"
        >
          <LogOut className="w-4 h-4 text-rose-600" />
          <span>Log Out of SmartAttend</span>
        </button>
      </div>

      {/* Two Column Cards Grid: Personal Information + Academic Records */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        {/* Card 1: Personal Information (Matches Mobile Screen 17) */}
        <div className="bg-white rounded-3xl p-7 border border-slate-200/90 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#1A4731] flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-[#111827]">
                  Personal Information
                </h2>
                <p className="text-xs text-slate-400">Institutional registration details</p>
              </div>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
              Verified
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {personalDetails.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="py-3.5 first:pt-1 last:pb-1 flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold text-slate-500 flex items-center gap-2">
                    <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                    {item.label}
                  </span>
                  <span className="text-xs font-bold text-[#111827] text-right truncate max-w-[280px]">
                    {item.value}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-500 text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Official student record verified by Admissions Office.</span>
          </div>
        </div>

        {/* Card 2: Academic Details (Matches Mobile Screen 18) */}
        <div className="bg-white rounded-3xl p-7 border border-slate-200/90 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#1A4731] flex items-center justify-center">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-[#111827]">
                  Academic Details &amp; Standing
                </h2>
                <p className="text-xs text-slate-400">University matriculation record</p>
              </div>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
              Active
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {academicDetails.map((field, idx) => {
              const Icon = field.icon;
              return (
                <div key={idx} className="py-3.5 first:pt-1 last:pb-1 flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold text-slate-500 flex items-center gap-2">
                    <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                    {field.label}
                  </span>
                  <span className="text-xs font-bold text-[#111827] text-right">
                    {field.value}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Minimum 75% aggregate attendance required for semester admit card.</span>
          </div>
        </div>
      </div>

      {/* Logout Confirmation Dialog */}
      {showLogoutConfirm && (
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
                onClick={() => setShowLogoutConfirm(false)}
                className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  if (onLogout) onLogout();
                }}
                className="py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition"
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
