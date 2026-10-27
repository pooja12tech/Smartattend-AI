import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Calendar, Clock, BookOpen, Users, MapPin,
  ChevronRight, RefreshCw, Plus, Filter
} from 'lucide-react';
import { api } from '../../api';

export default function AdminTimetableMobileView({
  onBack,
  onOpenFullManagement
}) {
  const [roleView, setRoleView] = useState('faculty'); // 'faculty' | 'student'
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [timetableSlots, setTimetableSlots] = useState([]);
  const [loading, setLoading] = useState(true);

  // 5 Working days
  const days = [
    { day: 'Mon', date: '20' },
    { day: 'Tue', date: '21' },
    { day: 'Wed', date: '22' },
    { day: 'Thu', date: '23' },
    { day: 'Fri', date: '24' }
  ];

  const fetchTimetable = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminTimetable();
      setTimetableSlots(data.entries || data.timetable || []);
    } catch (err) {
      console.error('Failed to load timetable:', err);
      setTimetableSlots([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimetable();
  }, []);

  // Filter slots for the selected day of week
  const selectedDayName = days[selectedDayIndex].day;
  const daySlots = timetableSlots.filter(s => {
    const slotDay = (s.day_of_week || '').substring(0, 3).toLowerCase();
    return slotDay === selectedDayName.toLowerCase();
  });

  const displaySlots = daySlots;

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
            Timetable
          </h1>
        </div>

        {onOpenFullManagement && (
          <button
            type="button"
            onClick={onOpenFullManagement}
            className="text-xs font-bold text-[#1A4731] hover:underline"
          >
            Manage Matrix &gt;
          </button>
        )}
      </div>

      {/* Segmented Toggle: Faculty vs Student (Reference Screen 12) */}
      <div className="flex bg-slate-200/80 p-0.5 rounded-xl">
        <button
          type="button"
          onClick={() => setRoleView('faculty')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
            roleView === 'faculty' ? 'bg-[#1A4731] text-white shadow-xs' : 'text-slate-600'
          }`}
        >
          Faculty
        </button>
        <button
          type="button"
          onClick={() => setRoleView('student')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
            roleView === 'student' ? 'bg-[#1A4731] text-white shadow-xs' : 'text-slate-600'
          }`}
        >
          Student
        </button>
      </div>

      {/* Horizontal Day Selector Pills (Reference Screen 12) */}
      <div className="grid grid-cols-5 gap-1 min-[360px]:gap-1.5 bg-white p-1.5 min-[360px]:p-2 rounded-2xl border border-slate-200/80 shadow-2xs">
        {days.map((item, idx) => {
          const isSelected = selectedDayIndex === idx;
          return (
            <button
              key={item.day}
              type="button"
              onClick={() => setSelectedDayIndex(idx)}
              className={`flex flex-col items-center py-1.5 min-[360px]:py-2 px-0.5 rounded-xl transition active:scale-[0.97] ${
                isSelected
                  ? 'bg-[#1A4731] text-white font-extrabold shadow-xs'
                  : 'text-slate-500 hover:bg-slate-50 font-bold'
              }`}
            >
              <span className="text-[11px] uppercase font-bold">{item.day}</span>
              <span className="text-xs min-[360px]:text-sm font-black mt-0.5">{item.date}</span>
            </button>
          );
        })}
      </div>

      {/* Timetable Slots Chronological List (Reference Screen 12) */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-start gap-3 animate-pulse">
                <div className="w-16 shrink-0 pt-1 space-y-1">
                  <div className="h-3 w-12 bg-slate-200 rounded ml-auto" />
                  <div className="h-3 w-10 bg-slate-100 rounded ml-auto" />
                </div>
                <div className="flex-1 bg-white rounded-2xl p-3.5 border border-slate-200/90 space-y-2">
                  <div className="h-4 w-32 bg-slate-200 rounded" />
                  <div className="h-3 w-24 bg-slate-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : displaySlots.length === 0 ? (
          <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 p-6 space-y-1">
            <Clock className="w-8 h-8 text-slate-300 mx-auto mb-1" />
            <p className="text-xs font-bold text-slate-700">No Timetable Slots</p>
            <p className="text-[11px] text-slate-400">No lectures scheduled for {selectedDayName}.</p>
          </div>
        ) : (
          displaySlots.map((slot) => (
            <div
              key={slot.id || `${slot.start_time}-${slot.subject}`}
              className="flex items-start gap-3"
            >
              {/* Time Column */}
              <div className="w-16 shrink-0 pt-1 text-right">
                <span className="text-[11px] font-black text-slate-800 block leading-tight">
                  {slot.start_time || '09:00 AM'}
                </span>
                <span className="text-[11px] font-semibold text-slate-400 block mt-0.5">
                  {slot.end_time || '10:00 AM'}
                </span>
              </div>

              {/* Subject Card */}
              <div className="flex-1 bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs space-y-1 hover:border-slate-300 transition">
                <h3 className="text-xs font-extrabold text-[#111827]">
                  {slot.subject || 'Subject Lecture'}
                </h3>
                <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                  <span>{slot.section ? `CSE ${slot.section}` : 'CSE 5A'}</span>
                  <span>&bull;</span>
                  <span>{slot.faculty_name || 'Prof. Sharma'}</span>
                </p>
                <div className="flex items-center gap-1 text-[11px] text-slate-400 font-semibold pt-0.5">
                  <MapPin className="w-3 h-3 text-[#1A4731]" />
                  <span>{slot.room || 'CSE Block, Room 304'}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
