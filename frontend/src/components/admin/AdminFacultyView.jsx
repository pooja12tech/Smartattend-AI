import React, { useState } from 'react';
import {
  ArrowLeft, Search, Filter, Plus, MoreVertical, Building2,
  Mail, Phone, ShieldCheck, CheckCircle2, Trash2, X, RefreshCw, Users
} from 'lucide-react';
import { api } from '../../api';
import Modal from '../ui/Modal';
import { toast } from '../ui/Toast';

export default function AdminFacultyView({
  usersList = [],
  onBack,
  onRefreshUsers,
  onOpenAddFacultyModal
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'dept'
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [facultyToDelete, setFacultyToDelete] = useState(null);

  const faculty = usersList.filter(u => u.role === 'faculty');
  const departments = Array.from(new Set(faculty.map(f => f.department).filter(Boolean)));

  const filteredFaculty = faculty.filter(f => {
    if (activeFilter === 'dept' && selectedDept !== 'ALL' && f.department !== selectedDept) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (f.name || '').toLowerCase().includes(q) ||
      (f.roll_no || '').toLowerCase().includes(q) ||
      (f.department || '').toLowerCase().includes(q)
    );
  });

  const confirmDeleteFaculty = async () => {
    if (!facultyToDelete) return;
    const userToDel = facultyToDelete;
    setDeletingId(userToDel.roll_no);
    try {
      await api.adminDeleteUser(userToDel.roll_no);
      toast.success(`Faculty account ${userToDel.name} removed successfully.`);
      if (onRefreshUsers) onRefreshUsers();
      setFacultyToDelete(null);
    } catch (err) {
      toast.error(`Failed to delete faculty member: ${err.message}`);
    } finally {
      setDeletingId(null);
      setActiveMenuId(null);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Sticky Top App Bar */}
      <div className="sticky top-0 z-20 bg-[#F8FAF9]/95 backdrop-blur-md py-2.5 -mx-3.5 px-3.5 border-b border-slate-200/60 select-none flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1 -ml-1 text-slate-600 hover:text-slate-900 active:scale-[0.97] transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h1 className="text-base font-extrabold text-[#111827] tracking-tight">
            Faculty Directory ({faculty.length})
          </h1>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setActiveFilter('all'); setSelectedDept('ALL'); }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeFilter === 'all'
              ? 'bg-[#1A4731] text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200/80'
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('dept')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeFilter === 'dept'
              ? 'bg-[#1A4731] text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200/80'
          }`}
        >
          By Department
        </button>
      </div>

      {/* Department Dropdown if By Department is selected */}
      {activeFilter === 'dept' && (
        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1A4731]/30"
        >
          <option value="ALL">All Departments</option>
          {departments.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name or employee ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 bg-white rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1A4731]/20 shadow-2xs"
        />
      </div>

      {/* Faculty List */}
      <div className="space-y-2">
        {filteredFaculty.length === 0 ? (
          <div className="py-12 bg-white rounded-2xl border border-dashed border-slate-200 text-center space-y-2 p-6">
            <Users className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-700">No faculty members found</p>
            <p className="text-[11px] text-slate-400">Try adjusting your department filter or search</p>
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setActiveFilter('all'); setSelectedDept('ALL'); }}
              className="mt-2 px-3 py-1.5 rounded-xl bg-slate-100 text-xs font-bold text-[#1A4731] hover:bg-slate-200"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          filteredFaculty.map((item) => (
            <div
              key={item.roll_no}
              className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-2xs flex items-center justify-between relative hover:border-slate-300 active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#1A4731]/10 text-[#1A4731] font-black text-xs flex items-center justify-center ring-1 ring-[#1A4731]/20">
                  {(item.name || 'F').charAt(0)}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 leading-tight">
                    {item.name}
                  </h4>
                  <p className="text-[11px] font-semibold text-slate-400">
                    {item.roll_no} &bull; {item.department ? item.department.replace('Computer Science & Engineering', 'CSE') : 'CSE'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-extrabold border border-emerald-200">
                  Active
                </span>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setActiveMenuId(activeMenuId === item.roll_no ? null : item.roll_no)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition min-w-[36px] min-h-[36px] flex items-center justify-center"
                    aria-label="Faculty actions"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {/* Dropdown Menu */}
                  {activeMenuId === item.roll_no && (
                    <div className="absolute right-0 top-7 z-30 w-36 bg-white rounded-xl shadow-lg border border-slate-200 py-1 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveMenuId(null);
                          setFacultyToDelete(item);
                        }}
                        className="w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50 font-semibold flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Faculty</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Floating Add Faculty Button (Reference Screen 10) */}
      <button
        type="button"
        onClick={onOpenAddFacultyModal}
        className="fixed bottom-20 right-4 z-40 w-12 h-12 rounded-full bg-[#1A4731] text-white shadow-lg shadow-[#1A4731]/40 flex items-center justify-center hover:bg-[#1A4731]/90 active:scale-95 transition min-h-[48px] min-w-[48px]"
        title="Add New Faculty Member"
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </button>

      {/* Delete Confirmation Bottom Sheet */}
      <Modal
        isOpen={Boolean(facultyToDelete)}
        onClose={() => setFacultyToDelete(null)}
        title="Remove Faculty Member"
        subtitle="This action is recorded in the immutable audit log."
        variant="sheet"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Are you sure you want to remove faculty account{' '}
            <strong className="text-slate-900">{facultyToDelete?.name}</strong> ({facultyToDelete?.roll_no})?
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setFacultyToDelete(null)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDeleteFaculty}
              disabled={Boolean(deletingId)}
              className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {deletingId ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              <span>Confirm Delete</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
