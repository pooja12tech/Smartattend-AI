import React from 'react';
import { ArrowLeft, GraduationCap, Award, BookOpen, Building } from 'lucide-react';

export default function StudentAcademicDetailsView({
  dashboard,
  user,
  onBack
}) {
  const student = dashboard?.student || user || {};

  const academicFields = [
    { label: 'Program', value: 'B.Tech (CSE)' },
    { label: 'Batch', value: student.batch || '2023 - 2027' },
    { label: 'Current Semester', value: student.semester ? `${student.semester}th Semester` : '6th Semester' },
    { label: 'CGPA', value: student.cgpa || '8.75' },
    { label: 'University', value: 'GGSIPU' },
    { label: 'Department', value: student.department || 'Computer Science & Engineering' },
    { label: 'Academic Standing', value: 'Active / Regular' }
  ];

  return (
    <div className="space-y-5">
      {/* Top Header: < Academic Details (Screen 18 Reference) */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-[#111827] font-extrabold text-base focus:outline-none"
        >
          <ArrowLeft className="w-5 h-5 text-slate-700" />
          <span>Academic Details</span>
        </button>
      </div>

      {/* Key-Value Details Card (Screen 18 Reference) */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm divide-y divide-slate-100">
        {academicFields.map((field, idx) => (
          <div key={idx} className="py-3.5 first:pt-1 last:pb-1 flex items-center justify-between gap-4">
            <span className="text-xs font-semibold text-slate-500">
              {field.label}
            </span>
            <span className="text-xs font-bold text-[#111827] text-right">
              {field.value}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 text-xs text-emerald-800 space-y-1">
        <div className="flex items-center gap-1.5 font-bold">
          <GraduationCap className="w-4 h-4 text-emerald-700" />
          <span>Semester Progression Verified</span>
        </div>
        <p className="text-[11px] text-emerald-900/80 leading-relaxed">
          Curriculum matriculation status is current. Minimum 75% aggregate class attendance required to generate semester end examination admit card.
        </p>
      </div>
    </div>
  );
}
