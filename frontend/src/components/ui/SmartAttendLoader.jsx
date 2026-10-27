import React from 'react';

/**
 * SmartAttend Minimalist Quantum Loader
 * Ultra-fast, clean, and modern loading animation without text clutter or badges.
 */
export default function SmartAttendLoader({
  variant = 'fullscreen', // 'fullscreen' | 'card' | 'inline'
  size = 'md', // 'sm' | 'md' | 'lg'
  className = ''
}) {
  const logoSizes = {
    sm: 'w-14 h-14',
    md: 'w-20 h-20 sm:w-22 sm:h-22',
    lg: 'w-24 h-24 sm:w-28 sm:h-28'
  };

  const ringSizes = {
    sm: 'w-24 h-24',
    md: 'w-36 h-36 sm:w-40 sm:h-40',
    lg: 'w-44 h-44 sm:w-48 sm:h-48'
  };

  const isFullscreen = variant === 'fullscreen';
  const isCard = variant === 'card';

  return (
    <div
      className={`relative flex flex-col items-center justify-center select-none overflow-hidden ${
        isFullscreen
          ? 'min-h-dvh w-full bg-[#F8FAF9] px-4 py-8'
          : isCard
          ? 'min-h-[340px] w-full rounded-3xl bg-white/70 backdrop-blur-md border border-slate-200/80 p-8 shadow-sm my-4'
          : 'min-h-[220px] w-full p-6'
      } ${className}`}
      role="status"
      aria-label="Loading SmartAttend..."
    >
      {/* Ambient soft glow aura */}
      {(isFullscreen || isCard) && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 sm:w-96 sm:h-96 rounded-full bg-emerald-200/35 blur-3xl animate-smart-glow" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-60 h-60 rounded-full bg-teal-100/40 blur-2xl" />
        </div>
      )}

      {/* Center Quantum Bio-Ring Scanner */}
      <div className={`relative flex items-center justify-center ${ringSizes[size]} mb-4.5`}>
        {/* Pulsing Radar Ring */}
        <div className="absolute inset-0 rounded-full border border-emerald-400/40 animate-smart-radar" />

        {/* Outer Orbit Track (Clockwise with glowing satellites) */}
        <div className="absolute inset-0 rounded-full animate-smart-orbit-cw">
          <svg className="w-full h-full" viewBox="0 0 160 160">
            <circle
              cx="80"
              cy="80"
              r="76"
              fill="none"
              stroke="#10B981"
              strokeWidth="1.5"
              strokeDasharray="18 120"
              strokeLinecap="round"
              className="opacity-70"
            />
            {/* Satellite Beacon Node */}
            <circle cx="80" cy="4" r="3.5" fill="#10B981" className="filter drop-shadow-[0_0_6px_#10B981]" />
          </svg>
        </div>

        {/* Inner Counter-Clockwise Dotted Ring */}
        <div className="absolute inset-2 sm:inset-3 rounded-full animate-smart-orbit-ccw">
          <svg className="w-full h-full" viewBox="0 0 140 140">
            <circle
              cx="70"
              cy="70"
              r="66"
              fill="none"
              stroke="#047857"
              strokeWidth="1.5"
              strokeDasharray="4 8"
              className="opacity-45"
            />
            {/* Small opposite node */}
            <circle cx="70" cy="4" r="2.5" fill="#047857" className="filter drop-shadow-[0_0_4px_#047857]" />
          </svg>
        </div>

        {/* Core Frosted Glass Hub */}
        <div className="relative z-10 w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-white/90 backdrop-blur-md shadow-lg shadow-emerald-900/10 border border-emerald-100/80 flex items-center justify-center p-3 overflow-hidden">
          {/* Sweeping Laser Scan Line */}
          <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#10B981] animate-smart-laser pointer-events-none" />

          {/* Official 3D Green Logo with breathing float */}
          <img
            src="/smartattend_logo.png"
            alt="SmartAttend"
            className={`${logoSizes[size]} object-contain animate-ambient-float transition-all`}
          />
        </div>
      </div>

      {/* Brand Title (Clean, no lines, no badges, no extra text) */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-xs px-2">
        <h2 className="text-xl sm:text-2xl font-black text-[#111827] tracking-tight">
          SmartAttend
        </h2>
      </div>
    </div>
  );
}
