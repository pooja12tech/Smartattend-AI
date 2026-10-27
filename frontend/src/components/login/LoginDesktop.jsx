import React, { useState } from 'react';
import {
  Lock, User, Eye, EyeOff, RefreshCw,
  Fingerprint, AlertTriangle, QrCode, UserCheck, MapPin,
  CheckCircle2, ArrowRight,
  GraduationCap, BookOpen, ShieldCheck
} from 'lucide-react';

export default function LoginDesktop({
  roleTab,
  onRoleTabChange,
  identifier,
  onIdentifierChange,
  password,
  onPasswordChange,
  showPassword,
  onToggleShowPassword,
  rememberMe,
  onRememberMeChange,
  onSubmit,
  loading,
  error,
  infoMessage,
  onForgotPassword,
  onBiometricLogin,
  deviceId,
  onRegenerateDeviceId
}) {
  const [capsLockActive, setCapsLockActive] = useState(false);

  const handleKeyModifierCheck = (e) => {
    if (e.getModifierState) {
      setCapsLockActive(e.getModifierState('CapsLock'));
    }
  };

  const currentYear = new Date().getFullYear();

  const getIdentifierLabel = () => {
    if (roleTab === 'student') return 'University Roll No.';
    if (roleTab === 'faculty') return 'Faculty ID or Email';
    return 'Administrator Username';
  };

  const getIdentifierPlaceholder = () => {
    if (roleTab === 'student') return 'e.g. 23CSE123';
    if (roleTab === 'faculty') return 'e.g. FAC01 or prof@college.edu';
    return 'e.g. admin';
  };

  // Quick demo autofill
  const handleQuickFill = (role) => {
    onRoleTabChange(role);
    if (role === 'student') {
      onIdentifierChange('STU01');
      onPasswordChange('studentpassword');
    } else if (role === 'faculty') {
      onIdentifierChange('faculty');
      onPasswordChange('facultypassword');
    } else if (role === 'admin') {
      onIdentifierChange('admin');
      onPasswordChange('adminpassword');
    }
  };

  return (
    <div className="h-screen w-full relative flex flex-col justify-between font-sans overflow-hidden select-none bg-[#05140b]">
      {/* Cinematic Campus Night Background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{ backgroundImage: "url('/campus_bg.jpg')" }}
      />
      
      {/* Rich Dark Emerald Cinematic Filters Applied Back */}
      <div className="absolute inset-0 bg-[#061d11]/75 mix-blend-multiply pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#031109]/96 via-[#051c10]/85 to-[#020b06]/70 pointer-events-none" />
      <div className="absolute inset-0 bg-radial-gradient from-transparent via-transparent to-black/60 pointer-events-none" />
      
      {/* Ambient Lighting & Glow Waves */}
      <div className="absolute -top-32 right-1/4 w-[700px] h-[700px] bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-2xl pointer-events-none" />

      {/* Main Viewport Shell */}
      <div className="relative z-10 w-full h-full max-h-screen flex flex-col justify-between px-6 sm:px-10 lg:px-14 py-4 lg:py-5 max-w-[1700px] mx-auto min-h-0">
        
        {/* =========================================================================
            HEADER: Real Brand Logo + Status Badge
        ========================================================================= */}
        <header className="w-full flex items-center justify-between shrink-0">
          {/* Authentic SmartAttend Brand Logo */}
          <div className="flex items-center gap-3">
            <img
              src="/smartattend_logo.png"
              alt="SmartAttend Logo"
              className="w-10 h-10 sm:w-11 sm:h-11 object-contain drop-shadow-[0_4px_14px_rgba(16,185,129,0.35)] shrink-0"
            />
            <span className="text-2xl sm:text-[26px] font-black tracking-tight text-white leading-none">
              SmartAttend
            </span>
          </div>

          {/* Top Right Status Badge (Secure, Smart, Campus Ready in white) */}
          <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-black/45 backdrop-blur-md border border-white/10 text-xs text-white font-medium shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse shadow-sm shadow-[#10B981]" />
            <span className="font-semibold text-white">Secure</span>
            <span className="text-white/40 text-[10px]">&bull;</span>
            <span className="text-white">Smart</span>
            <span className="text-white/40 text-[10px]">&bull;</span>
            <span className="text-white font-medium">Campus Ready</span>
          </div>
        </header>

        {/* =========================================================================
            HERO MAIN: Enlarged Left Section + Red-Boundary Sized Spacious Login Box
        ========================================================================= */}
        <main className="w-full flex-1 min-h-0 flex items-center py-2">
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-12 items-center">
            
            {/* Left Hero Column: Open, Airy, Spacious with Relaxed Line-Height */}
            <div className="lg:col-span-6 xl:col-span-6 space-y-6 sm:space-y-7 text-left pr-0 lg:pr-4">
              <div className="space-y-3.5 sm:space-y-4">
                {/* Clean Letter-spaced Kicker */}
                <p className="text-xs sm:text-sm font-semibold tracking-[0.26em] text-emerald-300 uppercase">
                  Smart Attendance for a Smarter Campus
                </p>

                {/* Big, Clean, Spacious Headline with Relaxed Leading */}
                <h1 className="text-4xl sm:text-5xl xl:text-[52px] font-black text-white tracking-tight leading-[1.18]">
                  Seamless Attendance<br />
                  <span className="text-[#10B981]">Effortless Verification</span>
                </h1>

                {/* Natural, Clean Subtitle */}
                <p className="text-sm sm:text-base text-slate-200/90 leading-relaxed font-normal max-w-xl">
                  Biometric face verification dynamic QR rotation and campus geofencing for classroom attendance
                </p>
              </div>

              {/* 3 Spacious, Open Feature Cards */}
              <div className="grid grid-cols-3 gap-4 pt-2 max-w-2xl">
                {/* Feature 1 */}
                <div className="bg-[#0b2417]/75 hover:bg-[#0b2417]/90 transition-all duration-300 backdrop-blur-md border border-emerald-500/25 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xl">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/25 to-emerald-900/50 border border-emerald-400/30 text-emerald-400 flex items-center justify-center shadow-inner">
                    <UserCheck className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-sm sm:text-base tracking-wide">
                      Face Verification
                    </h3>
                    <p className="text-emerald-100/75 text-xs leading-normal mt-1">
                      Real-time liveness check
                    </p>
                  </div>
                </div>

                {/* Feature 2 */}
                <div className="bg-[#0b2417]/75 hover:bg-[#0b2417]/90 transition-all duration-300 backdrop-blur-md border border-emerald-500/25 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xl">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/25 to-emerald-900/50 border border-emerald-400/30 text-emerald-400 flex items-center justify-center shadow-inner">
                    <QrCode className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-sm sm:text-base tracking-wide">
                      Dynamic QR
                    </h3>
                    <p className="text-emerald-100/75 text-xs leading-normal mt-1">
                      Rotates every 20 seconds
                    </p>
                  </div>
                </div>

                {/* Feature 3 */}
                <div className="bg-[#0b2417]/75 hover:bg-[#0b2417]/90 transition-all duration-300 backdrop-blur-md border border-emerald-500/25 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xl">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/25 to-emerald-900/50 border border-emerald-400/30 text-emerald-400 flex items-center justify-center shadow-inner">
                    <MapPin className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-sm sm:text-base tracking-wide">
                      Location Bound
                    </h3>
                    <p className="text-emerald-100/75 text-xs leading-normal mt-1">
                      Campus geofence verified
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Wide, Grand, Spacious White Card (Matching Red Pen Boundary) */}
            <div className="lg:col-span-6 xl:col-span-6 w-full flex justify-center lg:justify-end">
              <div className="w-full max-w-[540px] xl:max-w-[580px] bg-white rounded-[32px] sm:rounded-[36px] p-7 sm:p-8 shadow-2xl shadow-black/60 border border-slate-100 space-y-3.5 text-left transition-all">
                
                {/* Card Header: Welcome back 👋 + Demo Fills */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl sm:text-[30px] font-black text-slate-900 tracking-tight leading-none flex items-center gap-2.5">
                      <span>Welcome back</span>
                      <span className="text-2xl sm:text-3xl animate-waving-hand inline-block">👋</span>
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1.5 font-medium">
                      Sign in to your SmartAttend account
                    </p>
                  </div>

                  {/* Clean Minimal Demo Quick Fill Pills */}
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl p-1 shrink-0">
                    <span className="text-[10px] font-bold text-slate-400 px-1.5 uppercase tracking-wider">Demo</span>
                    <button
                      type="button"
                      onClick={() => handleQuickFill('student')}
                      className="px-2 py-1 rounded-lg bg-white hover:bg-[#EBF4EE] hover:text-[#1A4731] text-[11px] font-bold text-slate-700 shadow-2xs transition cursor-pointer"
                      title="Auto-fill Student credentials"
                    >
                      STU
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickFill('faculty')}
                      className="px-2 py-1 rounded-lg bg-white hover:bg-[#EBF4EE] hover:text-[#1A4731] text-[11px] font-bold text-slate-700 shadow-2xs transition cursor-pointer"
                      title="Auto-fill Faculty credentials"
                    >
                      FAC
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickFill('admin')}
                      className="px-2 py-1 rounded-lg bg-white hover:bg-[#EBF4EE] hover:text-[#1A4731] text-[11px] font-bold text-slate-700 shadow-2xs transition cursor-pointer"
                      title="Auto-fill Admin credentials"
                    >
                      ADM
                    </button>
                  </div>
                </div>

                {/* Role Tabs Segmented Control: Tall, Spacious */}
                <div
                  className="grid grid-cols-3 bg-slate-100/90 p-1 rounded-2xl border border-slate-200/70"
                  role="tablist"
                  aria-label="User Role Selection"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={roleTab === 'student'}
                    onClick={() => onRoleTabChange('student')}
                    className={`py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      roleTab === 'student'
                        ? 'bg-[#133E2B] text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>Student</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={roleTab === 'faculty'}
                    onClick={() => onRoleTabChange('faculty')}
                    className={`py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      roleTab === 'faculty'
                        ? 'bg-[#133E2B] text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Faculty</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={roleTab === 'admin'}
                    onClick={() => onRoleTabChange('admin')}
                    className={`py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      roleTab === 'admin'
                        ? 'bg-[#133E2B] text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Admin</span>
                  </button>
                </div>

                {/* Inline Error Message */}
                {error && (
                  <div
                    role="alert"
                    className="py-1.5 px-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-in fade-in duration-200"
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span className="font-semibold truncate">{error}</span>
                  </div>
                )}

                {/* Inline Info Message */}
                {infoMessage && (
                  <div
                    role="status"
                    className="py-1.5 px-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in duration-200"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="truncate">{infoMessage}</span>
                  </div>
                )}

                {/* Login Form: Clean, Spacious, Tall Inputs */}
                <form onSubmit={onSubmit} className="space-y-3">
                  {/* Identifier Input */}
                  <div>
                    <label
                      htmlFor="desktop-identifier-input"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      {getIdentifierLabel()}
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="desktop-identifier-input"
                        type="text"
                        required
                        autoComplete="username"
                        value={identifier}
                        onChange={(e) => onIdentifierChange(e.target.value)}
                        placeholder={getIdentifierPlaceholder()}
                        className="w-full h-11 sm:h-11.5 bg-white border border-slate-200 rounded-2xl pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#133E2B]/15 focus:border-[#133E2B] transition font-medium"
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        htmlFor="desktop-password-input"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={onForgotPassword}
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold hover:underline cursor-pointer transition"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="desktop-password-input"
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => onPasswordChange(e.target.value)}
                        onKeyDown={handleKeyModifierCheck}
                        onKeyUp={handleKeyModifierCheck}
                        placeholder="••••••••"
                        className="w-full h-11 sm:h-11.5 bg-white border border-slate-200 rounded-2xl pl-11 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#133E2B]/15 focus:border-[#133E2B] transition font-medium"
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={onToggleShowPassword}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {capsLockActive && (
                      <div className="flex items-center gap-1 text-[10px] text-amber-600 font-semibold mt-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Caps Lock is ON</span>
                      </div>
                    )}
                  </div>

                  {/* Remember Me Checkbox */}
                  <div className="flex items-center justify-between pt-0.5">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 text-xs sm:text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => onRememberMeChange(e.target.checked)}
                        className="w-4 h-4 rounded text-[#133E2B] border-slate-300 focus:ring-[#133E2B] accent-[#133E2B] cursor-pointer"
                      />
                      <span>Remember me</span>
                    </label>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11.5 sm:h-12 rounded-2xl font-bold text-sm sm:text-base text-white bg-[#133E2B] hover:bg-[#0c271b] active:scale-[0.99] transition shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Signing in...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In</span>
                        <ArrowRight className="w-4 h-4 stroke-[2.2]" />
                      </>
                    )}
                  </button>
                </form>

                {/* Divider: or continue with */}
                <div className="relative flex items-center justify-center pt-0.5">
                  <div className="w-full border-t border-slate-200" />
                  <span className="bg-white px-3 text-xs text-slate-400 font-medium absolute">
                    or continue with
                  </span>
                </div>

                {/* Biometric Button */}
                <button
                  type="button"
                  onClick={onBiometricLogin}
                  className="w-full h-10.5 sm:h-11 px-4 rounded-2xl bg-white border border-slate-200 hover:bg-[#EBF4EE]/60 hover:border-emerald-300 text-slate-800 text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer group shadow-2xs"
                >
                  <Fingerprint className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                  <span>Face ID / Biometric Login</span>
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* =========================================================================
            FOOTER: Copyright on Left, Social Trust on Right
        ========================================================================= */}
        <footer className="w-full flex items-center justify-between text-xs text-slate-400 shrink-0 pt-2">
          <span>&copy; {currentYear} SmartAttend. All rights reserved.</span>

          {/* Overlapping Trust Avatars + Text */}
          <div className="flex items-center gap-2.5">
            <div className="flex -space-x-1.5 overflow-hidden">
              <span className="inline-block h-5 w-5 rounded-full ring-1.5 ring-slate-900 bg-emerald-700 text-[9px] font-bold text-white flex items-center justify-center">A</span>
              <span className="inline-block h-5 w-5 rounded-full ring-1.5 ring-slate-900 bg-teal-600 text-[9px] font-bold text-white flex items-center justify-center">R</span>
              <span className="inline-block h-5 w-5 rounded-full ring-1.5 ring-slate-900 bg-emerald-800 text-[9px] font-bold text-white flex items-center justify-center">S</span>
              <span className="inline-block h-5 w-5 rounded-full ring-1.5 ring-slate-900 bg-emerald-600 text-[9px] font-bold text-white flex items-center justify-center">M</span>
            </div>
            <span className="text-xs text-slate-300 font-medium">
              Trusted by modern institutions
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
