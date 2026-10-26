import React, { useState } from 'react';
import {
  ArrowLeft, Building2, BookOpen, Users, GraduationCap,
  ChevronRight, ChevronDown, Plus, Code, Cpu, Globe, Wrench, Hammer, Zap
} from 'lucide-react';
import { api } from '../../api';

export default function AdminDepartmentsView({
  overview,
  usersList = [],
  subjectsList = [],
  onBack,
  onOpenAddSubjectModal
}) {
  const [expandedDept, setExpandedDept] = useState(null);

  // Standard departments list with iconography and colors
  const baseDepartments = [
    { code: 'CSE', name: 'Computer Science & Engineering', icon: Code, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { code: 'ECE', name: 'Electronics & Communication', icon: Cpu, color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { code: 'IT', name: 'Information Technology', icon: Globe, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    { code: 'ME', name: 'Mechanical Engineering', icon: Wrench, color: 'bg-amber-50 text-amber-700 border-amber-200' },
    { code: 'CE', name: 'Civil Engineering', icon: Hammer, color: 'bg-rose-50 text-rose-700 border-rose-200' },
    { code: 'EE', name: 'Electrical Engineering', icon: Zap, color: 'bg-cyan-50 text-cyan-700 border-cyan-200' }
  ];

  // Calculate actual student and faculty counts per department from usersList
  const deptStats = {};
  usersList.forEach(u => {
    let dCode = 'CSE';
    const dept = (u.department || '').toLowerCase();
    if (dept.includes('electron') || dept.includes('ece')) dCode = 'ECE';
    else if (dept.includes('information') || dept.includes('it')) dCode = 'IT';
    else if (dept.includes('mech') || dept.includes('me')) dCode = 'ME';
    else if (dept.includes('civil') || dept.includes('ce')) dCode = 'CE';
    else if (dept.includes('electr') || dept.includes('ee')) dCode = 'EE';

    if (!deptStats[dCode]) deptStats[dCode] = { students: 0, faculty: 0 };
    if (u.role === 'student') deptStats[dCode].students += 1;
    if (u.role === 'faculty') deptStats[dCode].faculty += 1;
  });

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
            Departments & Subjects
          </h1>
        </div>

        <button
          type="button"
          onClick={onOpenAddSubjectModal}
          className="px-2.5 py-1.5 rounded-xl bg-[#1A4731] text-white text-xs font-bold flex items-center gap-1 shadow-xs hover:bg-[#1A4731]/90 transition"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Add Subject</span>
        </button>
      </div>

      {/* Departments List (Reference Screen 11) */}
      <div className="space-y-3">
        {baseDepartments.map((dept) => {
          const Icon = dept.icon;
          const stats = deptStats[dept.code] || { students: 0, faculty: 0 };
          const studentCount = stats.students || 0;
          const facultyCount = stats.faculty || 0;

          // Associated subjects from database
          const deptSubjects = subjectsList.filter(s =>
            (s.code || '').startsWith(dept.code) ||
            (s.department || '').toLowerCase().includes(dept.code.toLowerCase())
          );

          const isExpanded = expandedDept === dept.code;

          return (
            <div
              key={dept.code}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden transition"
            >
              <div
                onClick={() => setExpandedDept(isExpanded ? null : dept.code)}
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-xs border ${dept.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-slate-900">{dept.code}</span>
                      <span className="text-xs text-slate-400">&bull;</span>
                      <h3 className="text-xs font-extrabold text-[#111827]">
                        {dept.name}
                      </h3>
                    </div>
                    <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                      {studentCount} Students &bull; {facultyCount} Faculty
                    </p>
                  </div>
                </div>

                <div className="text-slate-400">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-600" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Expandable Subjects Listing */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-2 border-t border-slate-100 bg-slate-50/60 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-600">
                    <span>Curriculum Subjects ({deptSubjects.length})</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onOpenAddSubjectModal(); }}
                      className="text-[#1A4731] hover:underline font-bold"
                    >
                      + Add
                    </button>
                  </div>

                  {deptSubjects.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic py-1">No subjects registered for this department.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {deptSubjects.map((sub) => (
                        <div
                          key={sub.code || sub.id}
                          className="bg-white p-2.5 rounded-xl border border-slate-200/70 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-extrabold text-slate-900 block">{sub.name}</span>
                            <span className="text-[10px] font-semibold text-slate-400">Code: {sub.code}</span>
                          </div>
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
                            {sub.credits || 4} Credits
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
