import React, { useState, useEffect, useRef } from 'react';
import {
  GraduationCap, Lock, User, Eye, EyeOff, ArrowRight,
  AlertTriangle, RefreshCw, Smartphone, Sparkles, Fingerprint
} from 'lucide-react';
import { api, getDeviceId, setCustomDeviceId } from '../api';

export default function LoginView({ onLoginSuccess }) {
  // Splash Screen State (Screen 1 Reference)
  const [showSplash, setShowSplash] = useState(() => {
    try {
      return !sessionStorage.getItem('smartattend_splash_dismissed');
    } catch {
      return true;
    }
  });

  const [roleTab, setRoleTab] = useState('student'); // 'student' | 'faculty' | 'admin'
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [deviceId, setDeviceIdState] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [infoMessage, setInfoMessage] = useState(null);

  const [exitToast, setExitToast] = useState(false);
  const lastBackPressRef = useRef(0);
  const exitTimeoutRef = useRef(null);

  // Initialize PWA root history state on login view
  useEffect(() => {
    try {
      if (!window.history.state || !window.history.state.smartattend) {
        window.history.replaceState({ smartattend: true, view: 'login_root' }, '');
        window.history.pushState({ smartattend: true, view: 'login' }, '');
      }
    } catch (e) {}

    const handlePopState = () => {
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) {
        setExitToast(false);
        window.history.back();
      } else {
        lastBackPressRef.current = now;
        setExitToast(true);
        if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
        exitTimeoutRef.current = setTimeout(() => setExitToast(false), 2000);
        try {
          window.history.pushState({ smartattend: true, view: 'login' }, '');
        } catch (err) {}
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
    };
  }, []);

  // Splash auto-dismiss timer
  useEffect(() => {
    if (showSplash) {
      const timer = setTimeout(() => {
        handleDismissSplash();
      }, 1400);
      return () => clearTimeout(timer);
    }
  }, [showSplash]);

  const handleDismissSplash = () => {
    setShowSplash(false);
    try {
      sessionStorage.setItem('smartattend_splash_dismissed', 'true');
    } catch {}
  };

  useEffect(() => {
    setDeviceIdState(getDeviceId());
  }, []);

  const handleRoleTabChange = (newRole) => {
    setRoleTab(newRole);
    setError(null);
    setInfoMessage(null);
    setIdentifier('');
    setPassword('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfoMessage(null);

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

  const handleBiometricLoginSimulation = () => {
    if (!identifier) {
      setError('Please enter your University Roll No. or Faculty ID first.');
      return;
    }
    setInfoMessage('Face ID biometric sensor ready. Enter password to authorize hardware passkey.');
  };

  const regenerateDeviceId = () => {
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newId = `DEV-${navigator.platform.includes('Win') ? 'WIN' : 'MOB'}-${rand}`;
    setCustomDeviceId(newId);
    setDeviceIdState(newId);
  };

  // SCREEN 1: SPLASH SCREEN (Screen 1 Reference)
  if (showSplash) {
    return (
      <div
        onClick={handleDismissSplash}
        className="fixed inset-0 z-50 bg-[#F8FAF9] flex flex-col justify-between items-center px-6 py-12 cursor-pointer select-none animate-in fade-in duration-300"
      >
        <div className="w-full flex justify-between items-center text-xs text-slate-400 font-mono">
          <span>9:41</span>
          <div className="w-16 h-4" />
        </div>

        {/* Center: SmartAttend Logo & Icon */}
        <div className="flex flex-col items-center justify-center space-y-4">
          <img
            src="/smartattend_logo.png"
            alt="SmartAttend Logo"
            className="w-32 h-32 sm:w-36 sm:h-36 object-contain animate-ambient-float"
          />
          <h1 className="text-3xl font-extrabold text-[#111827] tracking-tight">
            SmartAttend
          </h1>
          <div className="w-12 h-1 rounded-full bg-[#1A4731]/30 animate-pulse mt-2" />
        </div>

        {/* Bottom indicator */}
        <div className="w-32 h-1 rounded-full bg-slate-300" />
      </div>
    );
  }

  // SCREEN 2: LOGIN SCREEN (Screen 2 Reference)
  return (
    <div className="min-h-screen bg-[#F8FAF9] text-[#111827] flex flex-col justify-center items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-sm sm:max-w-md space-y-6">
        
        {/* Header (Screen 2 Reference) */}
        <div className="text-left space-y-2">
          <img
            src="/smartattend_logo.png"
            alt="SmartAttend Logo"
            className="w-14 h-14 object-contain mb-1 hover:scale-105 transition-transform"
          />
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#111827] tracking-tight">
              Welcome Back
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Sign in to your SmartAttend account
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-sm space-y-5">
          
          {/* Role Selector Tabs (Preserves Faculty & Admin access) */}
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => handleRoleTabChange('student')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                roleTab === 'student'
                  ? 'bg-[#1A4731] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Student
            </button>
            <button
              type="button"
              onClick={() => handleRoleTabChange('faculty')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                roleTab === 'faculty'
                  ? 'bg-[#1A4731] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Faculty
            </button>
            <button
              type="button"
              onClick={() => handleRoleTabChange('admin')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                roleTab === 'admin'
                  ? 'bg-[#1A4731] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Admin
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Authentication Failed</p>
                <p className="mt-0.5 text-rose-600/90">{error}</p>
              </div>
            </div>
          )}

          {/* Info Toast */}
          {infoMessage && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <Fingerprint className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{infoMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {roleTab === 'student' ? 'University Roll No.' : roleTab === 'faculty' ? 'Faculty ID' : 'Admin ID'}
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={roleTab === 'student' ? '23CSE123' : roleTab === 'faculty' ? 'FAC01' : 'ADM01'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-sm text-[#111827] placeholder-slate-400 focus:outline-none focus:border-[#1A4731] focus:ring-1 focus:ring-[#1A4731] transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-10 py-3 text-sm text-[#111827] placeholder-slate-400 focus:outline-none focus:border-[#1A4731] focus:ring-1 focus:ring-[#1A4731] transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password (Screen 2 Reference) */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-[#1A4731] border-slate-300 focus:ring-[#1A4731]"
                />
                <span>Remember me</span>
              </label>

              <button
                type="button"
                onClick={() => setInfoMessage('For password assistance, please contact the campus administrator or registrar desk.')}
                className="text-[#1A4731] font-semibold hover:underline"
              >
                Forgot password?
              </button>
            </div>

            {/* Primary Sign In Button (Screen 2 Reference) */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-2xl font-bold text-sm text-white bg-[#1A4731] hover:bg-[#143826] active:scale-[0.99] transition shadow-md shadow-emerald-950/20 flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          {/* Divider "or continue with" (Screen 2 Reference) */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-slate-400">or continue with</span>
            </div>
          </div>

          {/* Face ID / Biometric Login Button (Screen 2 Reference) */}
          <button
            type="button"
            onClick={handleBiometricLoginSimulation}
            className="w-full py-3 px-4 rounded-2xl bg-white border border-slate-200/90 hover:bg-slate-50 text-[#111827] text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
          >
            <Fingerprint className="w-4 h-4 text-[#1A4731]" />
            <span>Face ID / Biometric Login</span>
          </button>

          {/* Hardware Device Fingerprint Badge (testing mode) */}
          {roleTab === 'student' && (
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[10px] font-semibold flex items-center gap-1 text-slate-700">
                  <Smartphone className="w-3 h-3 text-emerald-700" /> Device Binding (Test Mode)
                </span>
                <button
                  type="button"
                  onClick={regenerateDeviceId}
                  className="text-[10px] text-emerald-800 hover:underline flex items-center gap-1 font-semibold"
                >
                  <RefreshCw className="w-2.5 h-2.5" /> New Device
                </button>
              </div>
              <div className="font-mono text-[10px] text-slate-600 truncate bg-white p-1 rounded border border-slate-200">
                {deviceId}
              </div>
            </div>
          )}

          {/* Campus IT Support Notice */}
          <div className="pt-3 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400">
              Institutional portal protected by multi-factor identity verification &amp; device hardware lock.
            </p>
          </div>

        </div>

        {/* Footer (Screen 2 Reference) */}
        <p className="text-center text-xs text-slate-400">
          New here? Contact your administration.
        </p>
      </div>

      {/* Android Exit Confirmation Toast */}
      {exitToast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-[#111827]/95 text-white text-xs font-semibold shadow-xl border border-slate-700/80 animate-in fade-in slide-in-from-bottom-2 duration-150 pointer-events-none">
          Press back again to exit SmartAttend
        </div>
      )}
    </div>
  );
}
