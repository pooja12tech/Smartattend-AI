import React, { useState, useEffect } from 'react';
import { ShieldCheck, Smartphone, Lock, User, ArrowRight, AlertTriangle, KeyRound, Sparkles, RefreshCw } from 'lucide-react';
import { api, getDeviceId, setCustomDeviceId } from '../api';

export default function LoginView({ onLoginSuccess }) {
  const [roleTab, setRoleTab] = useState('student'); // 'student' | 'faculty' | 'admin'
  const [identifier, setIdentifier] = useState('student');
  const [password, setPassword] = useState('studentpassword');
  const [deviceId, setDeviceIdState] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setDeviceIdState(getDeviceId());
  }, []);

  const handleRoleTabChange = (newRole) => {
    setRoleTab(newRole);
    setError(null);
    if (newRole === 'student') {
      setIdentifier('student');
      setPassword('studentpassword');
    } else if (newRole === 'faculty') {
      setIdentifier('faculty');
      setPassword('facultypassword');
    } else if (newRole === 'admin') {
      setIdentifier('admin');
      setPassword('adminpassword');
    }
  };

  const handleQuickFill = (id, pass, role) => {
    setRoleTab(role);
    setIdentifier(id);
    setPassword(pass);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.login({
        roll_no: identifier.trim(),
        password: password.trim(),
        device_id: deviceId
      });

      if (res.success) {
        onLoginSuccess(res.user, res.binding_status);
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const regenerateDeviceId = () => {
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newId = `DEV-${navigator.platform.includes('Win') ? 'WIN' : 'MOB'}-${rand}`;
    setCustomDeviceId(newId);
    setDeviceIdState(newId);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-brand-600/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 shadow-xl shadow-brand-500/25 mb-3">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">SmartAttend-AI</h1>
          <p className="text-xs text-slate-400 mt-1">
            Production-grade Anti-Proxy Attendance & Predictive Retention Engine
          </p>
        </div>

        {/* Card */}
        <div className="glass-panel rounded-2xl p-6 sm:p-8 shadow-2xl border border-slate-800">
          
          {/* 3-Tab Role Selector */}
          <div className="flex bg-slate-900/90 p-1.5 rounded-xl border border-slate-800 mb-6">
            <button
              type="button"
              onClick={() => handleRoleTabChange('student')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                roleTab === 'student'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span>👨‍🎓</span> Student
            </button>
            <button
              type="button"
              onClick={() => handleRoleTabChange('faculty')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                roleTab === 'faculty'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span>👨‍🏫</span> Faculty
            </button>
            <button
              type="button"
              onClick={() => handleRoleTabChange('admin')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                roleTab === 'admin'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span>👨‍💼</span> Admin
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-shake">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-200">Authentication Blocked</p>
                <p className="mt-0.5 text-rose-300/90">{error}</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {roleTab === 'student' ? 'Student Roll Number' : roleTab === 'faculty' ? 'Faculty ID' : 'Admin ID'}
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={roleTab === 'student' ? 'e.g. STU01' : roleTab === 'faculty' ? 'e.g. FAC01' : 'e.g. ADM01'}
                  className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition"
                />
              </div>
            </div>

            {/* Student Hardware Device Binding Info */}
            {roleTab === 'student' && (
              <div className="pt-1">
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
                      <Smartphone className="w-3.5 h-3.5 text-indigo-400" /> Hardware Device Binding
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">Paused for Testing</span>
                    </span>
                    <button
                      type="button"
                      onClick={regenerateDeviceId}
                      title="Simulate switching to a different phone"
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 hover:underline"
                    >
                      <RefreshCw className="w-2.5 h-2.5" /> New Device
                    </button>
                  </div>
                  <div className="font-mono text-[11px] text-indigo-300 bg-slate-950/80 px-2 py-1 rounded border border-slate-800/80 truncate">
                    {deviceId}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Device restriction is paused for testing. Any device or browser can authenticate.
                  </p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 active:scale-[0.99] transition shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Authenticating...
                </>
              ) : (
                <>
                  Sign In to {roleTab === 'student' ? 'Student PWA' : roleTab === 'faculty' ? 'Faculty Portal' : 'Admin Portal'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Fill Demo Pills */}
          <div className="mt-6 pt-5 border-t border-slate-800/80">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-2.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>1-Click Quick Fill Credentials:</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickFill('student', 'studentpassword', 'student')}
                className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-brand-500/50 text-left transition text-slate-300"
              >
                <div className="font-bold text-brand-300">👨‍🎓 Student</div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">student</div>
                <div className="text-[9px] text-emerald-400 mt-1 font-semibold truncate">studentpassword</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('faculty', 'facultypassword', 'faculty')}
                className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 text-left transition text-slate-300"
              >
                <div className="font-bold text-emerald-300">👨‍🏫 Teacher</div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">faculty</div>
                <div className="text-[9px] text-emerald-400 mt-1 font-semibold truncate">facultypassword</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('admin', 'adminpassword', 'admin')}
                className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-purple-500/50 text-left transition text-slate-300"
              >
                <div className="font-bold text-purple-300">👨‍💼 Admin</div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">admin</div>
                <div className="text-[9px] text-emerald-400 mt-1 font-semibold truncate">adminpassword</div>
              </button>
            </div>
          </div>

        </div>

        {/* Footer Note */}
        <p className="text-center text-[11px] text-slate-500 mt-4">
          Protected by SmartAttend 5-Gate Anti-Proxy Hardware & AI Lock
        </p>

      </div>
    </div>
  );
}
