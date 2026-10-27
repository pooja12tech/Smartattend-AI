import React, { useState } from 'react';
import {
  BarChart3, Download, TrendingUp, AlertTriangle, CheckCircle2,
  Calendar, FileSpreadsheet, ArrowLeft, ShieldCheck, RefreshCw
} from 'lucide-react';

export default function DesktopFacultyReports({ user, onGoHome }) {
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleExportCsv = () => {
    setDownloading(true);
    setTimeout(() => {
      // Generate realistic CSV client-side
      const csvContent = "data:text/csv;charset=utf-8," +
        "Roll No,Student Name,Department,Subject,Total Classes,Attended,Attendance %,UGC Status\n" +
        "STU01,Aarav Sharma,Computer Science & Engineering,Web Technologies,40,33,82.5%,Eligible\n" +
        "STU02,Ananya Verma,Computer Science & Engineering,Web Technologies,40,36,90.0%,Eligible\n" +
        "STU03,Rohan Mehta,Computer Science & Engineering,Web Technologies,40,27,67.5%,Defaulter\n" +
        "STU04,Ishita Patel,Computer Science & Engineering,Web Technologies,40,24,60.0%,Defaulter\n" +
        "STU05,Kavya Nair,Computer Science & Engineering,Web Technologies,40,32,80.0%,Eligible\n" +
        "STU06,Vikram Joshi,Computer Science & Engineering,Web Technologies,40,30,75.0%,Eligible\n" +
        "STU07,Pooja Iyer,Computer Science & Engineering,Web Technologies,40,35,87.5%,Eligible\n" +
        "STU08,Aditya Singh,Computer Science & Engineering,Web Technologies,40,34,85.0%,Eligible\n";

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `SmartAttend_Attendance_Report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDownloading(false);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    }, 600);
  };

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
          <span className="text-xs font-semibold text-slate-500">Department Average</span>
          <p className="text-2xl font-black text-[#111827]">83.4%</p>
          <span className="text-[11px] text-emerald-700 font-bold">+2.1% higher than minimum UGC standard</span>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-slate-500">Defaulter Rate</span>
          <p className="text-2xl font-black text-rose-600">8.2%</p>
          <span className="text-[11px] text-slate-400">Students requiring recovery lectures</span>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-slate-500">Sessions Conducted</span>
          <p className="text-2xl font-black text-[#1A4731]">48 Lectures</p>
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
              Students falling below the mandatory 75% attendance quota with recovery advice.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {[
            { roll: 'STU03', name: 'Rohan Mehta', currentPct: 67.5, attended: 27, total: 40, needed: 6 },
            { roll: 'STU04', name: 'Ishita Patel', currentPct: 60.0, attended: 24, total: 40, needed: 12 },
            { roll: 'STU06', name: 'Vikram Joshi', currentPct: 74.0, attended: 30, total: 40, needed: 1 }
          ].map((item) => (
            <div
              key={item.roll}
              className="p-4 rounded-2xl bg-[#F8FAF9] border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 font-bold text-xs flex items-center justify-center">
                  {item.roll.slice(-2)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-800 text-xs">{item.name}</span>
                    <span className="font-mono text-[11px] text-slate-400">({item.roll})</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {item.attended} of {item.total} classes attended &bull; Deficit: {(75 - item.currentPct).toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="font-mono text-sm font-black text-rose-600">{item.currentPct}%</span>
                  <span className="text-[11px] text-slate-400 block font-medium">
                    Must attend next <strong>{item.needed} classes</strong>
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold">
                  Deficit Notice
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
