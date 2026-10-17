import React, { useState, useEffect } from 'react';
import {
  Users, ShieldAlert, Award, Smartphone, RefreshCw, UserPlus, Download,
  CheckCircle2, AlertTriangle, TrendingUp, Search, Plus, X
} from 'lucide-react';
import { api } from '../api';

export default function AdminPortal({ user }) {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [resettingRoll, setResettingRoll] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Add User Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRole, setNewRole] = useState('student');
  const [newRoll, setNewRoll] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('stu123');
  const [newDept, setNewDept] = useState('Computer Science & Engineering');
  const [newInitAtt, setNewInitAtt] = useState(82.0);
  const [creatingUser, setCreatingUser] = useState(false);

  // Pre-loaded student list for device management
  const [studentList, setStudentList] = useState([
    { roll_no: 'STU01', name: 'Aarav Sharma', email: 'aarav@smartattend.edu', bound_device_id: 'DEV-AARAV-PHONE-01', status: 'LOCKED' },
    { roll_no: 'STU02', name: 'Priya Patel', email: 'priya@smartattend.edu', bound_device_id: 'DEV-PRIYA-PHONE-02', status: 'LOCKED' },
    { roll_no: 'STU03', name: 'Rohan Verma', email: 'rohan@smartattend.edu', bound_device_id: 'DEV-ROHAN-PHONE-03', status: 'LOCKED' }
  ]);

  const fetchOverview = async () => {
    try {
      const data = await api.getAdminOverview();
      setOverview(data);
    } catch (err) {
      console.error('Failed to load admin overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  // 1-Click Hardware Device Reset
  const handleResetDevice = async (rollNo) => {
    setResettingRoll(rollNo);
    try {
      await api.adminResetDevice(rollNo);
      setStudentList(prev => prev.map(s => s.roll_no === rollNo ? { ...s, bound_device_id: 'UNBOUND', status: 'UNBOUND' } : s));
      setActionSuccess(`Hardware device lock successfully reset for student ${rollNo}.`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchOverview();
    } catch (err) {
      alert('Failed to reset device: ' + err.message);
    } finally {
      setResettingRoll(null);
    }
  };

  // Add user handler
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreatingUser(true);
    try {
      await api.adminCreateUser({
        role: newRole,
        roll_no: newRoll.trim(),
        name: newName.trim(),
        email: newEmail.trim(),
        password: newPassword.trim(),
        department: newDept,
        semester: 6,
        initial_attendance_pct: parseFloat(newInitAtt) || 80.0
      });

      if (newRole === 'student') {
        setStudentList(prev => [...prev, {
          roll_no: newRoll,
          name: newName,
          email: newEmail,
          bound_device_id: 'UNBOUND',
          status: 'UNBOUND'
        }]);
      }

      setShowAddModal(false);
      setActionSuccess(`New ${newRole} account created for ${newName} (${newRoll}).`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchOverview();

      // Reset form
      setNewRoll('');
      setNewName('');
      setNewEmail('');
    } catch (err) {
      alert('Error creating user: ' + err.message);
    } finally {
      setCreatingUser(false);
    }
  };

  // 1-Click CSV Export for Defaulters
  const handleExportDefaultersCSV = () => {
    if (!overview?.high_risk_defaulters?.length) {
      alert('No defaulters to export.');
      return;
    }

    const headers = 'Roll No,Student Name,Department,Attendance %,ML Defaulter Risk %,Risk Level\n';
    const rows = overview.high_risk_defaulters.map(d =>
      `${d.roll_no},"${d.name}","${d.department}",${d.attendance_pct}%,${d.risk_pct}%,${d.risk_level}`
    ).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `smartattend_defaulters_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && !overview) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
        <p className="text-sm font-medium">Loading SmartAttend Admin Console...</p>
      </div>
    );
  }

  const counts = overview?.counts || {};
  const defaulters = overview?.high_risk_defaulters || [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-6">

      {/* Top Banner */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              ADMINISTRATOR CONSOLE
            </span>
            <span className="text-xs text-slate-400">Institutional Governance & Anti-Proxy Security</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white mt-1">SmartAttend System & Retention Management</h1>
          <p className="text-xs text-slate-400">
            Monitor college-wide attendance health, reset student device bindings, and export AI risk reports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-500/25 flex items-center gap-2 transition active:scale-95"
          >
            <UserPlus className="w-4 h-4" /> Add User
          </button>
          <button
            type="button"
            onClick={handleExportDefaultersCSV}
            className="px-4 py-2.5 rounded-xl font-bold text-xs text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700 flex items-center gap-2 transition active:scale-95"
          >
            <Download className="w-4 h-4 text-purple-400" /> Export Defaulters (CSV)
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Institution Overview KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Enrolled Students</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-3xl font-black text-white mt-2">{counts.students || 3}</p>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Active Faculty</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-3xl font-black text-white mt-2">{counts.faculty || 1}</p>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>System Average Attendance</span>
            <TrendingUp className="w-4 h-4 text-teal-400" />
          </div>
          <p className="text-3xl font-black text-teal-300 mt-2">
            {overview?.system_average_attendance_pct || 75.5}%
          </p>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Blocked Proxy Attempts</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-3xl font-black text-rose-400 mt-2">{counts.total_alerts || 4}</p>
        </div>
      </div>

      {/* User & Device Management Table */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-indigo-400" />
              Student Hardware Device Binding & Reset Manager
            </h3>
            <p className="text-[11px] text-slate-400">
              When a student purchases a new phone or breaks their device, admin can instantly reset the hardware lock.
            </p>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student or device..."
              className="bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                <th className="py-2.5 px-3">Roll No</th>
                <th className="py-2.5 px-3">Student Name</th>
                <th className="py-2.5 px-3">Email</th>
                <th className="py-2.5 px-3">Bound Hardware Device ID</th>
                <th className="py-2.5 px-3 text-right">Device Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {studentList.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.roll_no.toLowerCase().includes(searchQuery.toLowerCase())).map((stu) => (
                <tr key={stu.roll_no} className="hover:bg-slate-900/40">
                  <td className="py-3 px-3 font-mono font-bold text-slate-200">{stu.roll_no}</td>
                  <td className="py-3 px-3 font-semibold text-white">{stu.name}</td>
                  <td className="py-3 px-3 text-slate-400">{stu.email}</td>
                  <td className="py-3 px-3 font-mono">
                    {stu.bound_device_id === 'UNBOUND' ? (
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-bold">UNBOUND (Ready for New Phone)</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold">{stu.bound_device_id}</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleResetDevice(stu.roll_no)}
                      disabled={resettingRoll === stu.roll_no || stu.bound_device_id === 'UNBOUND'}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[11px] font-bold transition active:scale-95 disabled:opacity-40"
                    >
                      {resettingRoll === stu.roll_no ? 'Resetting...' : 'Reset Bound Device'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Defaulter Watchlist Table (Random Forest High Risk Radar) */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              Machine Learning Defaulter Watchlist (Random Forest Radar)
            </h3>
            <p className="text-[11px] text-slate-400">
              Students identified by AI as high risk of dropping below 75% attendance before semester end.
            </p>
          </div>
          <button
            onClick={handleExportDefaultersCSV}
            className="text-xs text-purple-400 hover:text-purple-300 font-semibold underline flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" /> Download Full Report (.csv)
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                <th className="py-2.5 px-3">Roll No</th>
                <th className="py-2.5 px-3">Student Name</th>
                <th className="py-2.5 px-3">Dept</th>
                <th className="py-2.5 px-3">Attendance %</th>
                <th className="py-2.5 px-3">AI Defaulter Risk %</th>
                <th className="py-2.5 px-3">Risk Category</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {defaulters.map((d) => (
                <tr key={d.roll_no} className="hover:bg-slate-900/40">
                  <td className="py-3 px-3 font-mono font-bold text-slate-200">{d.roll_no}</td>
                  <td className="py-3 px-3 font-semibold text-white">{d.name}</td>
                  <td className="py-3 px-3 text-slate-400">{d.department}</td>
                  <td className="py-3 px-3 font-mono font-bold text-slate-200">{d.attendance_pct}%</td>
                  <td className="py-3 px-3 font-mono font-black text-rose-400">{d.risk_pct}%</td>
                  <td className="py-3 px-3">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      {d.risk_level}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 border border-slate-700 shadow-2xl relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-1">Create New Account</h3>
            <p className="text-xs text-slate-400 mb-4">Provision a new student, faculty, or administrator user.</p>

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => {
                    setNewRole(e.target.value);
                    setNewPassword(e.target.value === 'faculty' ? 'fac123' : e.target.value === 'admin' ? 'admin123' : 'stu123');
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="student">Student</option>
                  <option value="faculty">Faculty</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {newRole === 'student' ? 'Roll Number' : newRole === 'faculty' ? 'Faculty ID' : 'Admin ID'}
                </label>
                <input
                  type="text"
                  required
                  value={newRoll}
                  onChange={(e) => setNewRoll(e.target.value)}
                  placeholder={newRole === 'student' ? 'e.g. STU05' : 'e.g. FAC02'}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Siddharth Joshi"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. siddharth@smartattend.edu"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              {newRole === 'student' && (
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Initial Attendance %</label>
                  <input
                    type="number"
                    min="20"
                    max="100"
                    value={newInitAtt}
                    onChange={(e) => setNewInitAtt(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
                >
                  {creatingUser ? 'Creating...' : 'Create Account'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
