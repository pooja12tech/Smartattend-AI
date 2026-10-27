import React, { useState } from 'react';
import {
  ArrowLeft, Download, Filter, BarChart3, TrendingUp, Users,
  CheckCircle2, AlertTriangle, Calendar, FileText, Info
} from 'lucide-react';
import { toast } from '../ui/Toast';

export default function AdminReportsView({
  overview,
  onBack
}) {
  const [reportType, setReportType] = useState('attendance'); // 'attendance' | 'students' | 'faculty'
  const [exporting, setExporting] = useState(false);

  const counts = overview?.counts || {};
  const totalStudents = counts.students !== undefined ? counts.students : null;
  const overallAvg = overview?.system_average_attendance_pct != null
    ? Math.round(overview.system_average_attendance_pct)
    : null;
  const presentAvg = (totalStudents != null && overallAvg != null)
    ? Math.round(totalStudents * (overallAvg / 100))
    : null;
  const absentAvg = (totalStudents != null && presentAvg != null)
    ? Math.max(0, totalStudents - presentAvg)
    : null;

  // Safe CSV cell escaping adhering to RFC 4180
  const escapeCsvCell = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const handleExportCSV = () => {
    const defaulters = overview?.high_risk_defaulters || [];
    if (!defaulters.length) {
      toast.warning('No high-risk attendance records available to export.');
      return;
    }

    setExporting(true);
    try {
      const headers = ['Roll No', 'Student Name', 'Department', 'Attendance %', 'ML Defaulter Risk %', 'Risk Level'].map(escapeCsvCell).join(',') + '\r\n';
      const rows = defaulters.map(d => [
        escapeCsvCell(d.roll_no),
        escapeCsvCell(d.name),
        escapeCsvCell(d.department),
        escapeCsvCell(d.attendance_pct),
        escapeCsvCell(d.risk_pct),
        escapeCsvCell(d.risk_level)
      ].join(',')).join('\r\n');

      const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `smartattend_defaulters_report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Defaulters CSV report downloaded successfully.');
    } catch (err) {
      toast.error(`Export failed: ${err.message || 'Unknown error occurred while generating CSV'}`);
    } finally {
      setExporting(false);
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
            Reports & Analytics
          </h1>
        </div>

        <button
          type="button"
          disabled={exporting || !overview?.high_risk_defaulters?.length}
          onClick={handleExportCSV}
          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-2xs hover:bg-slate-50 active:scale-[0.97] transition disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5 text-[#1A4731]" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Scope Notice: Institutional Aggregate */}
      <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 text-[11px] text-slate-600 flex items-start gap-2">
        <Info className="w-4 h-4 text-[#1A4731] shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-slate-800">Current Scope: Institutional All-Time Overview</span>
          <p className="text-slate-500 mt-0.5 text-[10px] leading-relaxed">
            Data reflects verified attendances across all lectures in the institutional database. Historical date range and departmental filtering require dedicated backend query endpoints.
          </p>
        </div>
      </div>

      {/* Report Category Segmented Tabs (Reference Screen 13) */}
      <div className="flex bg-slate-200/80 p-0.5 rounded-xl">
        <button
          type="button"
          onClick={() => setReportType('attendance')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
            reportType === 'attendance' ? 'bg-[#1A4731] text-white shadow-xs' : 'text-slate-600'
          }`}
        >
          Attendance
        </button>
        <button
          type="button"
          onClick={() => setReportType('students')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
            reportType === 'students' ? 'bg-[#1A4731] text-white shadow-xs' : 'text-slate-600'
          }`}
        >
          Students
        </button>
        <button
          type="button"
          onClick={() => setReportType('faculty')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
            reportType === 'faculty' ? 'bg-[#1A4731] text-white shadow-xs' : 'text-slate-600'
          }`}
        >
          Faculty
        </button>
      </div>

      {/* Overall Attendance Radial Card (Reference Screen 13) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm text-center space-y-3">
        <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
          {/* Circular Progress Ring */}
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="40"
              className="text-slate-100"
              strokeWidth="9"
              stroke="currentColor"
              fill="transparent"
            />
            <circle
              cx="50"
              cy="50"
              r="40"
              className="text-[#1A4731]"
              strokeWidth="9"
              strokeDasharray={251.2}
              strokeDashoffset={overallAvg != null ? 251.2 * (1 - overallAvg / 100) : 251.2}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-[#111827] tracking-tight">
              {overallAvg != null ? `${overallAvg}%` : 'N/A'}
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Overall Attendance
            </span>
          </div>
        </div>

        {/* 3 Metric Cards Across */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
          <div className="p-2">
            <span className="text-base font-black text-slate-900 block">
              {totalStudents != null ? totalStudents : '—'}
            </span>
            <span className="text-[10px] font-semibold text-slate-400">Total Students</span>
          </div>
          <div className="p-2">
            <span className="text-base font-black text-emerald-700 block">
              {presentAvg != null ? presentAvg : '—'}
            </span>
            <span className="text-[10px] font-semibold text-slate-400">Present (Avg)</span>
          </div>
          <div className="p-2">
            <span className="text-base font-black text-red-600 block">
              {absentAvg != null ? absentAvg : '—'}
            </span>
            <span className="text-[10px] font-semibold text-slate-400">Absent (Avg)</span>
          </div>
        </div>
      </div>

      {/* Department Wise Attendance Section */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-[#111827]">
            Department Wise Attendance
          </h3>
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            Target: 75% Min
          </span>
        </div>

        {/* Honest empty/unavailable state: zero fabricated percentages */}
        <div className="py-6 px-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-1.5">
          <BarChart3 className="w-8 h-8 text-slate-300 mx-auto" />
          <h4 className="text-xs font-bold text-slate-800">
            Department-Wise Percentages Not Available
          </h4>
          <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-relaxed">
            The current backend API provides institutional system averages and student enrollment counts per department, but does not calculate historical attendance percentages split by department.
          </p>
        </div>
      </div>
    </div>
  );
}
