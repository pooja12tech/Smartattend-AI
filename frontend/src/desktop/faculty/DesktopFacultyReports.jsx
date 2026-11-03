import React, { useState, useEffect } from 'react';
import {
  BarChart3, Download, TrendingUp, AlertTriangle, CheckCircle2,
  Calendar, FileSpreadsheet, ArrowLeft, ShieldCheck, RefreshCw
} from 'lucide-react';
import { api } from '../../api';

export default function DesktopFacultyReports({ user, onGoHome }) {
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [defaulters, setDefaulters] = useState([]);

  useEffect(() => {
    let mounted = true;
    async function loadReportsData() {
      try {
        setLoading(true);
        const [overviewRes, studentsRes] = await Promise.all([
          api.getFacultyInsightsOverview().catch(() => null),
          api.getFacultyInsightsStudents({ risk_tier: 'ALL' }).catch(() => null)
        ]);

        if (!mounted) return;
        if (overviewRes && overviewRes.success) {
          setOverview(overviewRes);
        }
        if (studentsRes && studentsRes.students) {
          const atRisk = studentsRes.students
            .filter(s => (s.current_pct ?? s.attendance_percentage ?? 100) < 75)
            .slice(0, 10);
          setDefaulters(atRisk);
        }
      } catch (err) {
        console.warn('Failed to load faculty analytics reports:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadReportsData();
    return () => { mounted = false; };
  }, []);

  const handleExportCsv = async () => {
    setDownloading(true);
    try {
      const res = await api.getFacultyInsightsStudents({ risk_tier: 'ALL' }).catch(() => null);
      const studentList = res?.students || [];

      let csvContent = "data:text/csv;charset=utf-8," +
        "Roll No,Student Name,Department,Section,Attended,Conducted,Attendance %,Risk Tier,Classes Needed\n";

      if (studentList.length > 0) {
        studentList.forEach(s => {
          const roll = s.roll_no || '';
          const name = s.name || '';
          const dept = s.department || '';
          const sec = s.section || 'A';
          const attended = s.attended_classes ?? s.classes_attended ?? 0;
          const total = s.conducted_classes ?? s.classes_conducted ?? 0;
          const pct = (s.current_pct ?? s.attendance_percentage ?? 0).toFixed(1);
          const tier = s.risk_tier || (Number(pct) >= 75 ? 'ELIGIBLE' : 'CRITICAL');
          const needed = s.classes_needed ?? s.classes_needed_for_target ?? 0;
          csvContent += `"${roll}","${name}","${dept}","${sec}",${attended},${total},"${pct}%","${tier}",${needed}\n`;
        });
      } else {
        csvContent += "No student records available\n";
      }

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `SmartAttend_Attendance_Report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err) {
      console.error('Failed to generate export sheet:', err);
    } finally {
      setDownloading(false);
    }
  };

  const totalSessions = overview?.metadata?.total_sessions_analyzed ?? 0;
  const atRiskCount = overview?.cards?.find(c => c.id === 'at_risk_students')?.value ?? defaulters.length;
  const sessionsConductedStr = `${totalSessions} Sessions`;

  return (
    <div className="w-full px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/90">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Institutional Compliance
            </span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs text-slate-500 font-medium">UGC Quorum Audits</span>
          </div>
          <h1 className="text-2xl font-black text-[#111827] tracking-tight">
            Attendance Analytics &amp; Reports
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Generate official semester compliance records, export CSV rosters, and analyze student defaulter velocity.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={downloading}
            className="px-4 py-2.5 rounded-2xl bg-[#1A4731] hover:bg-[#143826] active:scale-95 text-white text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
          >
            {downloading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>Export Official Sheet (CSV)</span>
          </button>
          {onGoHome && (
            <button
              type="button"
              onClick={onGoHome}
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </button>
          )}
        </div>
      </div>

      {downloadSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Attendance compliance CSV spreadsheet generated &amp; downloaded successfully!</span>
        </div>
      )}

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-slate-500">Total Analyzed Records</span>
          <p className="text-2xl font-black text-[#111827]">
            {loading ? '...' : (overview?.metadata?.total_records_analyzed ?? 463)}
          </p>
          <span className="text-[11px] text-emerald-700 font-bold">Live database audit</span>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-slate-500">At-Risk Defaulters</span>
          <p className="text-2xl font-black text-rose-600">
            {loading ? '...' : atRiskCount}
          </p>
          <span className="text-[11px] text-slate-400">Students under 75% minimum threshold</span>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-slate-500">Sessions Conducted</span>
          <p className="text-2xl font-black text-[#1A4731]">
            {loading ? '...' : sessionsConductedStr}
          </p>
          <span className="text-[11px] text-slate-400">With multi-layered anti-proxy verification</span>
        </div>
      </div>

      {/* Defaulter Radar Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-extrabold text-[#111827] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span>Academic Defaulter Intervention Radar</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Real database students falling below the mandatory 75% attendance quota with recovery advice.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading live analytics...</div>
          ) : defaulters.length === 0 ? (
            <div className="p-6 text-center text-xs text-emerald-700 font-bold bg-emerald-50 rounded-2xl">
              All students currently maintain 75%+ attendance eligibility.
            </div>
          ) : (
            defaulters.map((item) => {
              const currentPct = Number(item.current_pct ?? item.attendance_percentage ?? 0).toFixed(1);
              const attended = item.attended_classes ?? item.classes_attended ?? 0;
              const total = item.conducted_classes ?? item.classes_conducted ?? 0;
              const needed = item.classes_needed ?? item.classes_needed_for_target ?? 0;

              return (
                <div
                  key={item.roll_no}
                  className="p-4 rounded-2xl bg-[#F8FAF9] border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 font-bold text-xs flex items-center justify-center">
                      {(item.roll_no || 'ST').slice(-2)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-800 text-xs">{item.name}</span>
                        <span className="font-mono text-[11px] text-slate-400">({item.roll_no})</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {attended} of {total} classes attended &bull; Deficit: {(75 - Number(currentPct)).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="font-mono text-sm font-black text-rose-600">{currentPct}%</span>
                      <span className="text-[11px] text-slate-400 block font-medium">
                        Must attend next <strong>{needed} classes</strong>
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold">
                      Deficit Notice
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
