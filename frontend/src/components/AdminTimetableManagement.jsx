import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Clock, Plus, Filter, Search, Edit2, Trash2, Globe, EyeOff,
  AlertTriangle, CheckCircle2, Check, X, Building2, GraduationCap, Users,
  RefreshCw, Layers, BookOpen, AlertCircle, ArrowRight
} from 'lucide-react';
import { api } from '../api';
import Modal from './ui/Modal';
import { toast } from './ui/Toast';
import SmartAttendLoader from './ui/SmartAttendLoader';

const DAYS_OF_WEEK = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const DAY_LABELS = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday'
};

const DEFAULT_ROOMS = ['Room 301', 'Room 302', 'Room 303', 'Room 304', 'Lab 1', 'Lab 2', 'Lab 3', 'Audi-1'];
const SECTIONS = ['A', 'B', 'C', 'D'];

export default function AdminTimetableManagement({
  user,
  facultyList = [],
  subjectsList = [],
  allDepartments = [],
  onTimetableUpdated
}) {
  // View mode: 'weekly' (grid) or 'daily' (chronological timeline)
  const [viewMode, setViewMode] = useState('weekly');
  const [selectedDay, setSelectedDay] = useState('MONDAY');

  // Timetable Entries
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Filters
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [semFilter, setSemFilter] = useState('ALL');
  const [secFilter, setSecFilter] = useState('ALL');
  const [facultyFilter, setFacultyFilter] = useState('ALL');
  const [roomFilter, setRoomFilter] = useState('ALL');
  const [dayFilter, setDayFilter] = useState('ALL');
  const [pubFilter, setPubFilter] = useState('ALL'); // 'ALL' | 'published' | 'draft'
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State for Add / Edit
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [conflictError, setConflictError] = useState(null);
  const [validationError, setValidationError] = useState(null);

  // Form Fields
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formSubjectCode, setFormSubjectCode] = useState('');
  const [formSubjectName, setFormSubjectName] = useState('');
  const [formFacultyId, setFormFacultyId] = useState('');
  const [formFacultyName, setFormFacultyName] = useState('');
  const [formDepartment, setFormDepartment] = useState('Computer Science & Engineering');
  const [formSemester, setFormSemester] = useState(6);
  const [formSection, setFormSection] = useState('A');
  const [formRoomNo, setFormRoomNo] = useState('Room 301');
  const [formDayOfWeek, setFormDayOfWeek] = useState('MONDAY');
  const [formStartTime, setFormStartTime] = useState('09:00');
  const [formEndTime, setFormEndTime] = useState('10:00');
  const [formAcademicYear, setFormAcademicYear] = useState('2025-2026');
  const [formIsPublished, setFormIsPublished] = useState(true);

  // Delete Confirmation Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Batch Publish State
  const [batchActionLoading, setBatchActionLoading] = useState(false);
  const [batchConfirm, setBatchConfirm] = useState(null); // { publish: boolean }

  // Load Timetable Entries from Backend API
  const fetchTimetable = async () => {
    setLoading(true);
    setActionError(null);
    try {
      const filters = {};
      if (deptFilter !== 'ALL') filters.department = deptFilter;
      if (semFilter !== 'ALL') filters.semester = parseInt(semFilter);
      if (secFilter !== 'ALL') filters.section = secFilter;
      if (facultyFilter !== 'ALL') filters.faculty_id = facultyFilter;
      if (roomFilter !== 'ALL') filters.room_no = roomFilter;
      if (dayFilter !== 'ALL') filters.day_of_week = dayFilter;
      if (pubFilter === 'published') filters.is_published = true;
      if (pubFilter === 'draft') filters.is_published = false;

      const data = await api.getAdminTimetable(filters);
      setEntries(data.timetable || []);
    } catch (err) {
      console.error('Failed to fetch timetable:', err);
      setActionError(err.message || 'Failed to fetch timetable entries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimetable();
  }, [deptFilter, semFilter, secFilter, facultyFilter, roomFilter, dayFilter, pubFilter]);

  // Client-side search filtering (by subject name, subject code, room, or faculty name)
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase().trim();
    return entries.filter(e =>
      e.subject_code?.toLowerCase().includes(q) ||
      e.subject_name?.toLowerCase().includes(q) ||
      e.faculty_name?.toLowerCase().includes(q) ||
      e.faculty_id?.toLowerCase().includes(q) ||
      e.room_no?.toLowerCase().includes(q) ||
      e.department?.toLowerCase().includes(q)
    );
  }, [entries, searchQuery]);

  // Group entries by Day for Weekly View
  const entriesByDay = useMemo(() => {
    const map = {
      MONDAY: [],
      TUESDAY: [],
      WEDNESDAY: [],
      THURSDAY: [],
      FRIDAY: [],
      SATURDAY: []
    };
    filteredEntries.forEach(e => {
      const day = (e.day_of_week || '').toUpperCase();
      if (map[day]) {
        map[day].push(e);
      } else {
        map[day] = [e];
      }
    });
    // Sort each day chronologically by start_time
    Object.keys(map).forEach(day => {
      map[day].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
    });
    return map;
  }, [filteredEntries]);

  // Extract unique rooms from entries for filter
  const allAvailableRooms = useMemo(() => {
    const fromEntries = entries.map(e => e.room_no).filter(Boolean);
    const combined = Array.from(new Set([...DEFAULT_ROOMS, ...fromEntries]));
    return combined.sort();
  }, [entries]);

  // Subject Selection Handler: auto-populates code and name
  const handleSubjectSelect = (subId) => {
    setFormSubjectId(subId);
    const sub = subjectsList.find(s => s.id === subId || s.code === subId);
    if (sub) {
      setFormSubjectCode(sub.code);
      setFormSubjectName(sub.name);
      if (sub.department) setFormDepartment(sub.department);
      if (sub.semester) setFormSemester(sub.semester);
      if (sub.faculty_id) {
        setFormFacultyId(sub.faculty_id);
        const fac = facultyList.find(f => f.roll_no === sub.faculty_id);
        if (fac) setFormFacultyName(fac.name);
      }
    }
  };

  // Faculty Selection Handler: auto-populates faculty name
  const handleFacultySelect = (rollNo) => {
    setFormFacultyId(rollNo);
    const fac = facultyList.find(f => f.roll_no === rollNo);
    if (fac) {
      setFormFacultyName(fac.name);
    }
  };

  // Open Create Modal
  const openCreateModal = (day = 'MONDAY', startTime = '09:00', endTime = '10:00') => {
    setModalMode('create');
    setEditingEntryId(null);
    setConflictError(null);
    setValidationError(null);

    // Initial default subject
    const defaultSub = subjectsList[0];
    if (defaultSub) {
      setFormSubjectId(defaultSub.id);
      setFormSubjectCode(defaultSub.code);
      setFormSubjectName(defaultSub.name);
      setFormDepartment(defaultSub.department || (allDepartments[0] || 'Computer Science & Engineering'));
      setFormSemester(defaultSub.semester || 6);
    } else {
      setFormSubjectId('');
      setFormSubjectCode('CS301');
      setFormSubjectName('Operating Systems');
      setFormDepartment(allDepartments[0] || 'Computer Science & Engineering');
      setFormSemester(6);
    }

    const defaultFac = facultyList[0];
    if (defaultFac) {
      setFormFacultyId(defaultFac.roll_no);
      setFormFacultyName(defaultFac.name);
    } else {
      setFormFacultyId('faculty');
      setFormFacultyName('Faculty Teacher');
    }

    setFormSection(secFilter !== 'ALL' ? secFilter : 'A');
    setFormRoomNo(roomFilter !== 'ALL' ? roomFilter : 'Room 301');
    setFormDayOfWeek(day);
    setFormStartTime(startTime);
    setFormEndTime(endTime);
    setFormAcademicYear('2025-2026');
    setFormIsPublished(true);

    setShowModal(true);
  };

  // Open Edit Modal
  const openEditModal = (entry) => {
    setModalMode('edit');
    setEditingEntryId(entry.id);
    setConflictError(null);
    setValidationError(null);

    setFormSubjectId(entry.subject_id || '');
    setFormSubjectCode(entry.subject_code || '');
    setFormSubjectName(entry.subject_name || '');
    setFormFacultyId(entry.faculty_id || '');
    setFormFacultyName(entry.faculty_name || '');
    setFormDepartment(entry.department || 'Computer Science & Engineering');
    setFormSemester(entry.semester || 6);
    setFormSection(entry.section || 'A');
    setFormRoomNo(entry.room_no || 'Room 301');
    setFormDayOfWeek(entry.day_of_week || 'MONDAY');
    setFormStartTime(entry.start_time || '09:00');
    setFormEndTime(entry.end_time || '10:00');
    setFormAcademicYear(entry.academic_year || '2025-2026');
    setFormIsPublished(entry.is_published ?? true);

    setShowModal(true);
  };

  // Save Timetable Entry (Create or Update)
  const handleSaveEntry = async (e) => {
    e.preventDefault();
    setConflictError(null);
    setValidationError(null);

    // Client-side validations
    if (!formSubjectCode.trim()) {
      setValidationError('Subject Code is required.');
      return;
    }
    if (!formSubjectName.trim()) {
      setValidationError('Subject Name is required.');
      return;
    }
    if (!formFacultyId.trim()) {
      setValidationError('Faculty is required.');
      return;
    }
    if (!formRoomNo.trim()) {
      setValidationError('Room identifier is required.');
      return;
    }
    if (!formStartTime || !formEndTime) {
      setValidationError('Both Start Time and End Time are required.');
      return;
    }
    if (formStartTime >= formEndTime) {
      setValidationError(`Start time (${formStartTime}) must be strictly earlier than end time (${formEndTime}).`);
      return;
    }

    setSubmitting(true);

    const payload = {
      subject_id: formSubjectId || null,
      subject_code: formSubjectCode.trim().toUpperCase(),
      subject_name: formSubjectName.trim(),
      faculty_id: formFacultyId.trim(),
      faculty_name: formFacultyName.trim() || formFacultyId.trim(),
      department: formDepartment.trim(),
      semester: parseInt(formSemester) || 6,
      section: formSection.trim().toUpperCase(),
      academic_year: formAcademicYear.trim() || '2025-2026',
      room_no: formRoomNo.trim().toUpperCase(),
      day_of_week: formDayOfWeek.trim().toUpperCase(),
      start_time: formStartTime.trim(),
      end_time: formEndTime.trim(),
      is_published: formIsPublished
    };

    try {
      if (modalMode === 'create') {
        const res = await api.createTimetableEntry(payload);
        setActionSuccess(`Timetable slot for ${payload.subject_code} (${payload.day_of_week} ${payload.start_time}-${payload.end_time}) created successfully!`);
      } else {
        const res = await api.updateTimetableEntry(editingEntryId, payload);
        setActionSuccess(`Timetable slot for ${payload.subject_code} updated successfully!`);
      }

      setShowModal(false);
      setTimeout(() => setActionSuccess(null), 5000);
      await fetchTimetable();
      if (onTimetableUpdated) onTimetableUpdated();
    } catch (err) {
      console.error('Save Timetable Slot Error:', err);
      if (err.status === 409 && err.detail) {
        // Detailed conflict object returned by Phase 2 conflict checking engine
        setConflictError(err.detail);
      } else if (err.status === 422) {
        setValidationError(err.message || 'Invalid parameters supplied to server.');
      } else {
        setValidationError(err.message || 'Failed to save timetable slot.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Toggle Publish / Unpublish on a Slot
  const handleTogglePublish = async (entry) => {
    const nextStatus = !entry.is_published;
    try {
      await api.setTimetablePublishStatus(entry.id, nextStatus);
      const msg = `Slot ${entry.subject_code} (${entry.day_of_week}) ${nextStatus ? 'published live' : 'saved as draft'}.`;
      toast.success(msg);
      setActionSuccess(msg);
      setTimeout(() => setActionSuccess(null), 4000);
      await fetchTimetable();
    } catch (err) {
      toast.error('Failed to change publication status: ' + err.message);
    }
  };

  // Open Delete Confirmation Modal
  const openDeleteConfirmation = (entry) => {
    setEntryToDelete(entry);
    setShowDeleteModal(true);
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!entryToDelete) return;
    setDeleting(true);
    try {
      await api.deleteTimetableEntry(entryToDelete.id);
      const msg = `Timetable slot ${entryToDelete.subject_code} (${entryToDelete.day_of_week} ${entryToDelete.start_time}) permanently deleted.`;
      toast.success(msg);
      setActionSuccess(msg);
      setTimeout(() => setActionSuccess(null), 4000);
      setShowDeleteModal(false);
      setEntryToDelete(null);
      await fetchTimetable();
      if (onTimetableUpdated) onTimetableUpdated();
    } catch (err) {
      toast.error('Failed to delete timetable entry: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  // Batch Publish or Unpublish for selected Department & Semester
  const handleBatchPublish = (publish) => {
    setBatchConfirm({ publish });
  };

  const executeBatchPublish = async (publish) => {
    setBatchActionLoading(true);
    try {
      const res = await api.batchPublishTimetable({
        department: deptFilter !== 'ALL' ? deptFilter : null,
        semester: semFilter !== 'ALL' ? parseInt(semFilter) : null,
        section: secFilter !== 'ALL' ? secFilter : null,
        is_published: publish
      });
      const msg = res.message || `Successfully updated publication status for ${res.updated_count} slots.`;
      toast.success(msg);
      setActionSuccess(msg);
      setTimeout(() => setActionSuccess(null), 5000);
      setBatchConfirm(null);
      await fetchTimetable();
    } catch (err) {
      toast.error('Batch publish failed: ' + err.message);
    } finally {
      setBatchActionLoading(false);
    }
  };

  // Quick stats
  const publishedCount = entries.filter(e => e.is_published).length;
  const draftCount = entries.filter(e => !e.is_published).length;

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Controls & Status Bar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-[#EBF4EE] border border-emerald-200 text-[#1A4731] flex items-center justify-center font-bold text-sm">
                <Calendar className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-[#111827] flex items-center gap-2">
                  <span>Official College Timetable Management</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    {entries.length} slots
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Institutional schedule master. Real-time multi-resource conflict checking for Faculty, Rooms, and Class Cohorts.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('weekly')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${viewMode === 'weekly' ? 'bg-[#1A4731] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Weekly Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('daily')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${viewMode === 'daily' ? 'bg-[#1A4731] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Daily View</span>
              </button>
            </div>

            {/* Refresh */}
            <button
              onClick={fetchTimetable}
              disabled={loading}
              className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition disabled:opacity-50 cursor-pointer shadow-2xs"
              title="Refresh Timetable"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#1A4731]' : ''}`} />
            </button>

            {/* Add Entry Button */}
            <button
              onClick={() => openCreateModal()}
              className="px-4 py-2 rounded-xl bg-[#1A4731] hover:bg-[#143826] text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Create Slot</span>
            </button>
          </div>
        </div>

        {/* Publication Stats & Batch Action Bar */}
        <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{publishedCount} Published</span>
            </span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1.5 text-amber-700 font-bold">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>{draftCount} Drafts</span>
            </span>
            <span className="text-slate-500 text-[11px] hidden sm:inline">
              (Drafts are visible only to Admins)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleBatchPublish(true)}
              disabled={batchActionLoading || draftCount === 0}
              className="px-3 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-semibold text-[11px] flex items-center gap-1 transition disabled:opacity-40 cursor-pointer"
              title="Publish all draft slots in current filter cohort"
            >
              <Globe className="w-3 h-3 text-emerald-600" />
              <span>Publish Cohort ({draftCount} Drafts)</span>
            </button>
            <button
              type="button"
              onClick={() => handleBatchPublish(false)}
              disabled={batchActionLoading || publishedCount === 0}
              className="px-3 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-semibold text-[11px] flex items-center gap-1 transition disabled:opacity-40 cursor-pointer"
              title="Revert all published slots to draft in current filter cohort"
            >
              <EyeOff className="w-3 h-3 text-amber-600" />
              <span>Unpublish Cohort</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
          {/* Department */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Department
            </label>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1A4731]/20 focus:border-[#1A4731]"
            >
              <option value="ALL">All Departments</option>
              {allDepartments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          {/* Semester */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Semester
            </label>
            <select
              value={semFilter}
              onChange={(e) => setSemFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1A4731]/20 focus:border-[#1A4731]"
            >
              <option value="ALL">All Semesters</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                <option key={s} value={s}>Semester {s}</option>
              ))}
            </select>
          </div>

          {/* Section */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Section
            </label>
            <select
              value={secFilter}
              onChange={(e) => setSecFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1A4731]/20 focus:border-[#1A4731]"
            >
              <option value="ALL">All Sections</option>
              {SECTIONS.map(sec => (
                <option key={sec} value={sec}>Section {sec}</option>
              ))}
            </select>
          </div>

          {/* Faculty */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Faculty
            </label>
            <select
              value={facultyFilter}
              onChange={(e) => setFacultyFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1A4731]/20 focus:border-[#1A4731]"
            >
              <option value="ALL">All Teachers</option>
              {facultyList.map(fac => (
                <option key={fac.roll_no} value={fac.roll_no}>
                  {fac.name} ({fac.roll_no})
                </option>
              ))}
            </select>
          </div>

          {/* Room */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Room
            </label>
            <select
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1A4731]/20 focus:border-[#1A4731]"
            >
              <option value="ALL">All Rooms</option>
              {allAvailableRooms.map(rm => (
                <option key={rm} value={rm}>{rm}</option>
              ))}
            </select>
          </div>

          {/* Day */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Day
            </label>
            <select
              value={dayFilter}
              onChange={(e) => setDayFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1A4731]/20 focus:border-[#1A4731]"
            >
              <option value="ALL">All Days</option>
              {DAYS_OF_WEEK.map(d => (
                <option key={d} value={d}>{DAY_LABELS[d]}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Status
            </label>
            <select
              value={pubFilter}
              onChange={(e) => setPubFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1A4731]/20 focus:border-[#1A4731]"
            >
              <option value="ALL">All Statuses</option>
              <option value="published">Published Only</option>
              <option value="draft">Drafts Only</option>
            </select>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search timetable slots by subject code, subject title, teacher name, or room..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-[#111827] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1A4731]/20 focus:border-[#1A4731] transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Global Success Banner */}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Global Error Banner */}
      {actionError && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <SmartAttendLoader
          variant="card"
          portalName="Admin Suite"
          subtitle="Synchronizing institutional master timetable slots..."
          size="sm"
        />
      )}

      {/* Empty State */}
      {!loading && filteredEntries.length === 0 && (
        <div className="bg-white rounded-2xl p-10 border border-slate-200 shadow-xs text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 mx-auto flex items-center justify-center text-slate-400">
            <Calendar className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#111827]">No Timetable Slots Found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              No lecture schedules match the current filters or search query. You can reset filters or create a new official timetable slot.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                setDeptFilter('ALL');
                setSemFilter('ALL');
                setSecFilter('ALL');
                setFacultyFilter('ALL');
                setRoomFilter('ALL');
                setDayFilter('ALL');
                setPubFilter('ALL');
                setSearchQuery('');
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              Reset Filters
            </button>
            <button
              onClick={() => openCreateModal()}
              className="px-4 py-2 rounded-xl bg-[#1A4731] hover:bg-[#143826] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Create First Slot</span>
            </button>
          </div>
        </div>
      )}

      {/* VIEW MODE 1: WEEKLY GRID */}
      {!loading && filteredEntries.length > 0 && viewMode === 'weekly' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {DAYS_OF_WEEK.slice(0, 5).map(day => {
            const dayEntries = entriesByDay[day] || [];
            return (
              <div
                key={day}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col min-h-[400px] overflow-hidden"
              >
                {/* Day Header */}
                <div className="p-3.5 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#1A4731] shadow-2xs" />
                    <span className="text-xs font-black text-[#111827] uppercase tracking-wider">
                      {DAY_LABELS[day]}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200">
                      {dayEntries.length} slots
                    </span>
                    <button
                      onClick={() => openCreateModal(day)}
                      className="p-1 rounded-md text-slate-500 hover:text-[#1A4731] hover:bg-emerald-50 transition cursor-pointer"
                      title={`Add slot on ${DAY_LABELS[day]}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Day Slot Cards List */}
                <div className="p-2.5 space-y-2.5 flex-1 overflow-y-auto max-h-[650px]">
                  {dayEntries.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400 text-xs">
                      <p>No lectures scheduled</p>
                      <button
                        onClick={() => openCreateModal(day)}
                        className="mt-2 text-[#1A4731] hover:underline text-[11px] font-semibold cursor-pointer"
                      >
                        + Add slot
                      </button>
                    </div>
                  ) : (
                    dayEntries.map(entry => (
                      <TimetableSlotCard
                        key={entry.id}
                        entry={entry}
                        onEdit={openEditModal}
                        onDelete={openDeleteConfirmation}
                        onTogglePublish={handleTogglePublish}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW MODE 2: DAILY VIEW */}
      {!loading && filteredEntries.length > 0 && viewMode === 'daily' && (
        <div className="space-y-4">
          {/* Day Navigation Bar */}
          <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 border border-slate-200 overflow-x-auto">
            {DAYS_OF_WEEK.map(d => {
              const count = (entriesByDay[d] || []).length;
              const isSelected = selectedDay === d;
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDay(d)}
                  className={`flex-1 min-w-[110px] py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shrink-0 cursor-pointer ${isSelected ? 'bg-[#1A4731] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'}`}
                >
                  <span>{DAY_LABELS[d]}</span>
                  <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Daily Schedule List */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#1A4731]" />
                <h3 className="text-sm font-bold text-[#111827]">
                  Schedule for {DAY_LABELS[selectedDay]} ({(entriesByDay[selectedDay] || []).length} lectures)
                </h3>
              </div>
              <button
                onClick={() => openCreateModal(selectedDay)}
                className="px-3 py-1.5 rounded-xl bg-[#1A4731] hover:bg-[#143826] text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add {DAY_LABELS[selectedDay]} Lecture</span>
              </button>
            </div>

            {(entriesByDay[selectedDay] || []).length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <p className="text-sm font-medium">No lectures scheduled for {DAY_LABELS[selectedDay]}</p>
                <button
                  onClick={() => openCreateModal(selectedDay)}
                  className="text-xs text-[#1A4731] hover:underline font-semibold cursor-pointer"
                >
                  Click here to schedule a lecture for this day
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(entriesByDay[selectedDay] || []).map(entry => (
                  <TimetableSlotCard
                    key={entry.id}
                    entry={entry}
                    onEdit={openEditModal}
                    onDelete={openDeleteConfirmation}
                    onTogglePublish={handleTogglePublish}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE / EDIT TIMETABLE MODAL */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={modalMode === 'create' ? 'Create Official Timetable Slot' : 'Edit Timetable Slot'}
        subtitle="Real-time validation against conflicting faculty schedules, room occupancy, and student cohort overlaps."
        maxWidth="max-w-2xl"
      >
        {/* Client Validation Error */}
        {validationError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Scheduling Conflict Error Box (HTTP 409 from Backend) */}
        {conflictError && (
          <div className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-rose-700 text-sm">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Scheduling Conflict Detected</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-mono font-bold">
                {conflictError.code || 'CONFLICT'}
              </span>
            </div>
            <p className="text-rose-900 font-medium">
              {conflictError.message}
            </p>
            {conflictError.conflict_with && (
              <div className="mt-2 p-2.5 rounded-lg bg-white border border-rose-200 text-[11px] font-mono text-rose-900 space-y-1">
                <p><strong>Colliding Lecture:</strong> {conflictError.conflict_with.subject_code} - {conflictError.conflict_with.subject_name}</p>
                <p><strong>Faculty:</strong> {conflictError.conflict_with.faculty_name} ({conflictError.conflict_with.faculty_id})</p>
                <p><strong>Room:</strong> {conflictError.conflict_with.room_no}</p>
                <p><strong>Cohort:</strong> {conflictError.conflict_with.department} - Sem {conflictError.conflict_with.semester} Sec {conflictError.conflict_with.section}</p>
                <p><strong>Time Window:</strong> {conflictError.conflict_with.day_of_week} ({conflictError.conflict_with.start_time} - {conflictError.conflict_with.end_time})</p>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSaveEntry} className="space-y-4">
          {/* Row 1: Subject Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Curriculum Subject <span className="text-rose-500">*</span>
              </label>
              <select
                value={formSubjectId}
                onChange={(e) => handleSubjectSelect(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1A4731]/20 focus:border-[#1A4731]"
              >
                <option value="">-- Choose Existing Subject --</option>
                {subjectsList.map(sub => (
                  <option key={sub.id || sub.code} value={sub.id || sub.code}>
                    {sub.code} - {sub.name} (Sem {sub.semester})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subject Code & Title <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Code (e.g. CS301)"
                  value={formSubjectCode}
                  onChange={(e) => setFormSubjectCode(e.target.value.toUpperCase())}
                  className="col-span-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-[#111827] uppercase focus:outline-none focus:ring-2 focus:ring-[#1A4731]/20 focus:border-[#1A4731]"
                  required
                />
                <input
                  type="text"
                  placeholder="Title (e.g. Operating Systems)"
                  value={formSubjectName}
                  onChange={(e) => setFormSubjectName(e.target.value)}
                  className="col-span-2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1A4731]/20 focus:border-[#1A4731]"
                  required
                />
              </div>
            </div>
          </div>

          {/* Row 2: Faculty Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Faculty Teacher <span className="text-rose-500">*</span>
              </label>
              <select
                value={formFacultyId}
                onChange={(e) => handleFacultySelect(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1A4731]/20 focus:border-[#1A4731]"
                required
              >
                <option value="">-- Select Faculty --</option>
                {facultyList.map(fac => (
                  <option key={fac.roll_no} value={fac.roll_no}>
                    {fac.name} ({fac.roll_no}) - {fac.department}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Faculty Display Name
              </label>
              <input
                type="text"
                value={formFacultyName}
                onChange={(e) => setFormFacultyName(e.target.value)}
                placeholder="Dr. Ramesh Sharma"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1A4731]/20 focus:border-[#1A4731]"
              />
            </div>
          </div>

          {/* Row 3: Class Cohort (Department, Semester, Section) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Department <span className="text-rose-500">*</span>
              </label>
              <select
                value={formDepartment}
                onChange={(e) => setFormDepartment(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1A4731]/20 focus:border-[#1A4731]"
              >
                {allDepartments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Semester <span className="text-rose-500">*</span>
              </label>
              <select
                value={formSemester}
                onChange={(e) => setFormSemester(parseInt(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1A4731]/20 focus:border-[#1A4731]"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                  <option key={s} value={s}>Semester {s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Section <span className="text-rose-500">*</span>
              </label>
              <select
                value={formSection}
                onChange={(e) => setFormSection(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1A4731]/20 focus:border-[#1A4731]"
              >
                {SECTIONS.map(sec => (
                  <option key={sec} value={sec}>Section {sec}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 4: Room, Day of Week, Academic Year */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Room / Lab Identifier <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formRoomNo}
                onChange={(e) => setFormRoomNo(e.target.value.toUpperCase())}
                placeholder="Room 301, Lab 2..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1A4731]/20 focus:border-[#1A4731]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Day of Week <span className="text-rose-500">*</span>
              </label>
              <select
                value={formDayOfWeek}
                onChange={(e) => setFormDayOfWeek(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1A4731]/20 focus:border-[#1A4731]"
              >
                {DAYS_OF_WEEK.map(d => (
                  <option key={d} value={d}>{DAY_LABELS[d]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Academic Year
              </label>
              <input
                type="text"
                value={formAcademicYear}
                onChange={(e) => setFormAcademicYear(e.target.value)}
                placeholder="2025-2026"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1A4731]/20 focus:border-[#1A4731]"
              />
            </div>
          </div>

          {/* Row 5: Time Range */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Clock className="w-3.5 h-3.5 text-[#1A4731]" />
              <span>Lecture Timing (24-Hour Format) <span className="text-rose-500">*</span></span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">Start Time</label>
                <input
                  type="time"
                  value={formStartTime}
                  onChange={(e) => setFormStartTime(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1A4731]/20 focus:border-[#1A4731]"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">End Time</label>
                <input
                  type="time"
                  value={formEndTime}
                  onChange={(e) => setFormEndTime(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1A4731]/20 focus:border-[#1A4731]"
                  required
                />
              </div>
            </div>
            {formStartTime && formEndTime && formStartTime >= formEndTime && (
              <p className="text-[11px] text-rose-600 font-medium">
                ⚠️ Invalid duration: Start time must precede end time.
              </p>
            )}
          </div>

          {/* Row 6: Publication Status (Draft vs Published) */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-[#111827] flex items-center gap-1.5">
                {formIsPublished ? (
                  <>
                    <Globe className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Official Published Slot</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                    <span>Draft Slot (Hidden from students & faculty)</span>
                  </>
                )}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {formIsPublished
                  ? 'This timetable slot will be immediately visible on faculty and student portals.'
                  : 'Save as an internal draft while scheduling. Publish later via 1-click or batch publish.'}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formIsPublished}
                onChange={(e) => setFormIsPublished(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1A4731]"></div>
            </label>
          </div>

          {/* Form Action Buttons */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-[#1A4731] hover:bg-[#143826] text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Validating Conflicts & Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{modalMode === 'create' ? 'Schedule Timetable Slot' : 'Save Changes'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={showDeleteModal && !!entryToDelete}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Timetable Entry"
        subtitle="Are you sure you want to permanently remove this scheduled lecture?"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
            <Trash2 className="w-6 h-6" />
          </div>

          {entryToDelete && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 font-medium">
              <div className="flex justify-between text-slate-600">
                <span>Subject:</span>
                <span className="font-bold text-[#111827]">{entryToDelete.subject_code} - {entryToDelete.subject_name}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Day & Time:</span>
                <span className="font-bold text-[#1A4731]">{entryToDelete.day_of_week} ({entryToDelete.start_time} - {entryToDelete.end_time})</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Room:</span>
                <span className="text-slate-800 font-semibold">{entryToDelete.room_no}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Faculty:</span>
                <span className="text-slate-800 font-semibold">{entryToDelete.faculty_name}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Cohort:</span>
                <span className="text-slate-800 font-semibold">Sem {entryToDelete.semester} - Sec {entryToDelete.section}</span>
              </div>
            </div>
          )}

          <p className="text-[11px] text-slate-500 text-center">
            An institutional audit log entry will be permanently recorded for this action.
          </p>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowDeleteModal(false)}
              className="flex-1 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {deleting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Confirm Delete</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Batch Publication Bottom Sheet */}
      <Modal
        isOpen={Boolean(batchConfirm)}
        onClose={() => setBatchConfirm(null)}
        title={batchConfirm?.publish ? 'Publish Selected Cohort Slots' : 'Unpublish Slots to Draft'}
        subtitle="Batch status update for student and faculty timetables"
        variant="sheet"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            {batchConfirm?.publish
              ? `Are you sure you want to PUBLISH all drafts for ${deptFilter === 'ALL' ? 'all departments' : deptFilter} (Semester: ${semFilter}, Section: ${secFilter})? Published slots will immediately appear on faculty & student schedules.`
              : `Are you sure you want to UNPUBLISH all slots for ${deptFilter === 'ALL' ? 'all departments' : deptFilter} (Semester: ${semFilter}, Section: ${secFilter}) to draft mode?`}
          </p>

          <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setBatchConfirm(null)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => executeBatchPublish(batchConfirm?.publish)}
              disabled={batchActionLoading}
              className={`px-4 py-2.5 rounded-xl text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                batchConfirm?.publish ? 'bg-[#1A4731] hover:bg-[#143826]' : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {batchActionLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>{batchConfirm?.publish ? 'Confirm & Publish Live' : 'Revert to Draft'}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Reusable Sub-Component for an individual lecture slot card
function TimetableSlotCard({ entry, onEdit, onDelete, onTogglePublish }) {
  const isPublished = entry.is_published ?? true;

  return (
    <div className={`group rounded-xl p-3 border transition-all duration-200 relative overflow-hidden shadow-2xs ${isPublished ? 'bg-white border-slate-200 hover:border-[#1A4731]/40 hover:shadow-md' : 'bg-amber-50/50 border-amber-200 hover:border-amber-400'}`}>
      {/* Top Bar: Time and Publish Badge */}
      <div className="flex items-center justify-between gap-1.5 mb-2">
        <span className="text-[11px] font-mono font-bold text-[#1A4731] flex items-center gap-1">
          <Clock className="w-3 h-3 text-[#1A4731]" />
          <span>{entry.start_time} - {entry.end_time}</span>
        </span>

        {/* Status Pill */}
        <button
          onClick={() => onTogglePublish(entry)}
          title={`Click to ${isPublished ? 'unpublish' : 'publish'}`}
          className={`px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${isPublished ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100' : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'}`}
        >
          {isPublished ? (
            <>
              <Globe className="w-3 h-3" />
              <span>Live</span>
            </>
          ) : (
            <>
              <EyeOff className="w-3 h-3" />
              <span>Draft</span>
            </>
          )}
        </button>
      </div>

      {/* Subject Info */}
      <div className="space-y-0.5 mb-2">
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-black text-[#111827] group-hover:text-[#1A4731] transition">
            {entry.subject_code}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
            Sem {entry.semester} · {entry.section}
          </span>
        </div>
        <p className="text-[11px] text-slate-600 font-medium line-clamp-1" title={entry.subject_name}>
          {entry.subject_name}
        </p>
      </div>

      {/* Faculty and Room Badges */}
      <div className="space-y-1 text-[11px] text-slate-500 pt-1.5 border-t border-slate-100">
        <div className="flex items-center gap-1.5 truncate" title={entry.faculty_name}>
          <GraduationCap className="w-3.5 h-3.5 text-[#1A4731] shrink-0" />
          <span className="truncate font-medium text-slate-700">{entry.faculty_name || entry.faculty_id}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-[#1A4731] shrink-0" />
            <span className="text-slate-700 font-medium">{entry.room_no}</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {entry.day_of_week?.slice(0, 3)}
          </span>
        </div>
      </div>

      {/* Quick Action Overlay / Buttons */}
      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-end gap-1.5">
        <button
          onClick={() => onEdit(entry)}
          className="p-1.5 rounded-lg text-slate-500 hover:text-[#1A4731] hover:bg-emerald-50 transition cursor-pointer"
          title="Edit Slot"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onDelete(entry)}
          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
          title="Delete Slot"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
