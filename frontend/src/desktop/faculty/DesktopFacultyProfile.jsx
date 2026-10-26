import React from 'react';
import {
  User, Mail, Building2, MapPin, ShieldCheck, LogOut,
  Calendar, BookOpen, Smartphone, ArrowLeft, Award
} from 'lucide-react';

export default function DesktopFacultyProfile({ user, onLogout, onGoHome }) {
  const facultyName = user?.name || 'Prof. Rajesh Sharma';
  const facultyId = user?.faculty_id || user?.id || 'FAC01';
  const facultyDept = user?.department || 'Computer Science & Engineering';
  const facultyEmail = user?.email || 'rajesh.sharma@smartattend.edu';

  return (
    <div className="w-full px-6 lg:px-8 py-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/90">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Institutional Profile
            </span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs text-slate-500 font-medium">Faculty Credentials</span>
          </div>
          <h1 className="text-2xl font-black text-[#111827] tracking-tight">
            Faculty Profile &amp; Settings
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Personal academic credentials, department affiliation, and security device locks.
          </p>
        </div>

        {onGoHome && (
          <button
            type="button"
            onClick={onGoHome}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-center"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </button>
        )}
      </div>

      {/* Main Profile Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-3xl bg-[#EBF4EE] text-[#1A4731] font-black text-2xl flex items-center justify-center border-2 border-emerald-300 shadow-sm">
              {facultyName.split(' ').map(n => n[0]).slice(0, 2).join('')}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-[#111827]">
                  {facultyName}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-extrabold uppercase tracking-wider">
                  Professor
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>{facultyDept}</span>
              </p>
              <p className="text-xs font-mono text-slate-400">
                Faculty ID: <strong className="text-slate-700">{facultyId}</strong>
              </p>
            </div>
          </div>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="px-4 py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-2xs"
            >
              <LogOut className="w-4 h-4 text-rose-600" />
              <span>Sign Out of Faculty Console</span>
            </button>
          )}
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-[#F8FAF9] border border-slate-200/90 space-y-1">
            <span className="text-slate-400 font-semibold block">Institutional Email</span>
            <span className="font-extrabold text-slate-800 text-sm">{facultyEmail}</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#F8FAF9] border border-slate-200/90 space-y-1">
            <span className="text-slate-400 font-semibold block">Office / Cabin</span>
            <span className="font-extrabold text-slate-800 text-sm">Faculty Block B, Room 304</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#F8FAF9] border border-slate-200/90 space-y-1">
            <span className="text-slate-400 font-semibold block">Assigned Subjects</span>
            <span className="font-extrabold text-slate-800 text-sm">CS301 (Operating Systems), IT401 (Web Technologies)</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#F8FAF9] border border-slate-200/90 space-y-1">
            <span className="text-slate-400 font-semibold block">Anti-Proxy Security Status</span>
            <span className="font-bold text-emerald-800 flex items-center gap-1.5 text-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Calibrated Campus GPS &amp; Acoustic Beacon
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
