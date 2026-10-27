import React, { useState, useMemo } from 'react';
import {
  BookOpen, Search, Plus, RefreshCw, Building2, Award
} from 'lucide-react';

export default function DesktopAdminSubjects({
  subjectsList = [],
  loading = false,
  onOpenAddSubject,
  onRefresh
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSubjects = useMemo(() => {
    if (!searchQuery.trim()) return subjectsList;
    const q = searchQuery.toLowerCase();
    return subjectsList.filter(s =>
      (s.code || s.subject_code || '').toLowerCase().includes(q) ||
      (s.name || s.subject_name || '').toLowerCase().includes(q) ||
      (s.department || '').toLowerCase().includes(q)
    );
  }, [subjectsList, searchQuery]);

  return (
    <div className="w-full px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/90">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Curriculum Master
            </span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs text-slate-500 font-medium">Academic Offerings</span>
          </div>
          <h1 className="text-2xl font-black text-[#111827] tracking-tight">
            Curriculum &amp; Course Modules
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Manage degree course modules, credit weights, and assigned department faculty.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onOpenAddSubject && (
            <button
              type="button"
              onClick={onOpenAddSubject}
              className="px-4 py-2 rounded-2xl bg-[#1A4731] hover:bg-[#143826] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Course</span>
            </button>
          )}

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
              title="Refresh Courses"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 space-y-4">
        <div className="relative max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by code, title, or department..."
            className="w-full bg-[#F8FAF9] border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-[#111827] placeholder:text-slate-400 focus:outline-none focus:border-[#1A4731]"
          />
        </div>

        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-white/95 backdrop-blur-xs z-10 border-b border-slate-100">
              <tr className="text-slate-400 uppercase text-[11px] tracking-wider font-bold">
                <th className="py-3 px-3">Subject Code</th>
                <th className="py-3 px-3">Course Title</th>
                <th className="py-3 px-3">Department</th>
                <th className="py-3 px-3">Credits</th>
                <th className="py-3 px-3 text-right">Faculty Lead</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-3 px-3"><div className="h-6 bg-slate-100 rounded-lg w-16" /></td>
                    <td className="py-3 px-3"><div className="h-4 bg-slate-200 rounded w-44" /></td>
                    <td className="py-3 px-3"><div className="h-4 bg-slate-100 rounded w-36" /></td>
                    <td className="py-3 px-3"><div className="h-4 bg-slate-100 rounded w-16" /></td>
                    <td className="py-3 px-3 text-right"><div className="h-4 bg-slate-100 rounded w-24 ml-auto" /></td>
                  </tr>
                ))
              ) : filteredSubjects.length > 0 ? (
                filteredSubjects.map((sub, idx) => (
                  <tr key={sub.code || sub.subject_code || idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-[#1A4731] whitespace-nowrap">
                      <span className="bg-[#EBF4EE] px-2 py-0.5 rounded-lg border border-emerald-200">
                        {sub.code || sub.subject_code}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-extrabold text-slate-800 truncate max-w-[240px]">
                      {sub.name || sub.subject_name}
                    </td>
                    <td className="py-3 px-3 text-slate-500 truncate max-w-[200px]">
                      {sub.department || 'Computer Science & Engineering'}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-700 whitespace-nowrap">
                      {sub.credits || 4} Credits
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600 font-medium whitespace-nowrap">
                      {sub.faculty_name || sub.faculty_id || 'Prof. Faculty'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-400 space-y-1">
                    <BookOpen className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="font-bold text-sm text-slate-600">No courses match your search</p>
                    <p className="text-xs">Try searching by course code or department</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
