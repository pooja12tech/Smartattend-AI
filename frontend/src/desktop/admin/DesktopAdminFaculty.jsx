import React, { useState, useMemo } from 'react';
import {
  GraduationCap, Search, Mail, Building2, UserPlus,
  RefreshCw, Trash2, BookOpen
} from 'lucide-react';

export default function DesktopAdminFaculty({
  usersList = [],
  loading = false,
  onOpenAddFaculty,
  onDeleteFaculty,
  onRefresh
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');

  const faculty = useMemo(() => {
    return usersList.filter(u => u.role === 'faculty');
  }, [usersList]);

  const departments = useMemo(() => {
    const set = new Set(faculty.map(f => f.department).filter(Boolean));
    return Array.from(set);
  }, [faculty]);

  const filteredFaculty = useMemo(() => {
    let list = faculty;
    if (selectedDept !== 'ALL') {
      list = list.filter(f => f.department === selectedDept);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(f =>
        (f.name || '').toLowerCase().includes(q) ||
        (f.faculty_id || f.id || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [faculty, selectedDept, searchQuery]);

  return (
    <div className="w-full px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/90">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Academic Roster
            </span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs text-slate-500 font-medium">Teaching Faculty</span>
          </div>
          <h1 className="text-2xl font-black text-[#111827] tracking-tight">
            Faculty Directory &amp; Teaching Staff
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Manage university professors, lecture credentials, department allocations, and teaching modules.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onOpenAddFaculty && (
            <button
              type="button"
              onClick={onOpenAddFaculty}
              className="px-4 py-2 rounded-2xl bg-[#1A4731] hover:bg-[#143826] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Add Teacher</span>
            </button>
          )}

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
              title="Refresh Faculty"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 space-y-4">
        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by faculty name or ID..."
              className="w-full bg-[#F8FAF9] border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-[#111827] placeholder:text-slate-400 focus:outline-none focus:border-[#1A4731]"
            />
          </div>

          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="bg-[#F8FAF9] border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#1A4731]"
          >
            <option value="ALL">All Departments</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-white/95 backdrop-blur-xs z-10 border-b border-slate-100">
              <tr className="text-slate-400 uppercase text-[11px] tracking-wider font-bold">
                <th className="py-3 px-3">Faculty Member</th>
                <th className="py-3 px-3">Faculty ID</th>
                <th className="py-3 px-3">Department</th>
                <th className="py-3 px-3">Official Email</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-slate-200" />
                        <div className="h-4 bg-slate-200 rounded w-28" />
                      </div>
                    </td>
                    <td className="py-3 px-3"><div className="h-4 bg-slate-100 rounded w-16" /></td>
                    <td className="py-3 px-3"><div className="h-4 bg-slate-100 rounded w-36" /></td>
                    <td className="py-3 px-3"><div className="h-4 bg-slate-100 rounded w-32" /></td>
                    <td className="py-3 px-3 text-right"><div className="h-6 bg-slate-100 rounded-xl w-6 ml-auto" /></td>
                  </tr>
                ))
              ) : filteredFaculty.length > 0 ? (
                filteredFaculty.map((f, idx) => (
                  <tr key={f.faculty_id || f.id || idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[#EBF4EE] text-[#1A4731] font-extrabold text-xs flex items-center justify-center shrink-0">
                          {(f.name || 'P').substring(0, 1)}
                        </div>
                        <span className="font-extrabold text-slate-800 truncate max-w-[180px]">{f.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-600 whitespace-nowrap">
                      {f.faculty_id || f.id}
                    </td>
                    <td className="py-3 px-3 text-slate-500 truncate max-w-[200px]">
                      {f.department || 'Computer Science & Engineering'}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-500 truncate max-w-[220px]">
                      {f.email || `${(f.faculty_id || 'faculty').toLowerCase()}@smartattend.edu`}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      {onDeleteFaculty && (
                        <button
                          type="button"
                          onClick={() => onDeleteFaculty(f.faculty_id || f.id, f.name, 'faculty')}
                          className="p-1.5 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                          title={`Delete faculty ${f.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-400 space-y-1">
                    <GraduationCap className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="font-bold text-sm text-slate-600">No faculty members found matching your search</p>
                    <p className="text-xs">Try selecting a different department or clear search</p>
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
