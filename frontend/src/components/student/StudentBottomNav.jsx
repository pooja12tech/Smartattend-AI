import React, { useState, useEffect, useRef } from 'react';
import { Home, CalendarDays, QrCode, CheckSquare, User } from 'lucide-react';

export default function StudentBottomNav({ activeTab, onTabChange, onScanClick }) {
  const navContainerRef = useRef(null);
  const [navWidth, setNavWidth] = useState(
    typeof window !== 'undefined' ? Math.min(window.innerWidth, 448) : 390
  );

  // Measure actual width of navigation container for mathematical SVG cutout precision
  useEffect(() => {
    const updateWidth = () => {
      if (navContainerRef.current) {
        setNavWidth(navContainerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);

    let ro = null;
    if (typeof ResizeObserver !== 'undefined' && navContainerRef.current) {
      ro = new ResizeObserver(updateWidth);
      ro.observe(navContainerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateWidth);
      if (ro) ro.disconnect();
    };
  }, []);

  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'classes', label: 'Classes', icon: CalendarDays },
    { id: 'scan', label: 'Scan', isAction: true },
    { id: 'attendance', label: 'Attendance', icon: CheckSquare },
    { id: 'profile', label: 'Profile', icon: User }
  ];

  // Mathematical Bezier Cutout Calculations
  const width = navWidth || 390;
  const cx = width / 2;
  const baseY = 14; // Horizontal top boundary of navigation bar
  const totalHeight = 110; // Covers bar + Android gesture safe-area

  // Symmetrical scoop notch with gentle shoulder crests inspired by native reference app
  const pathD = [
    `M 0 ${baseY}`,
    `L ${cx - 52} ${baseY}`,
    `C ${cx - 42} ${baseY}, ${cx - 36} 6, ${cx - 28} 6`,
    `C ${cx - 16} 6, ${cx - 16} 46, ${cx} 46`,
    `C ${cx + 16} 46, ${cx + 16} 6, ${cx + 28} 6`,
    `C ${cx + 36} 6, ${cx + 42} ${baseY}, ${cx + 52} ${baseY}`,
    `L ${width} ${baseY}`,
    `L ${width} ${totalHeight}`,
    `L 0 ${totalHeight}`,
    'Z'
  ].join(' ');

  const strokeD = [
    `M 0 ${baseY}`,
    `L ${cx - 52} ${baseY}`,
    `C ${cx - 42} ${baseY}, ${cx - 36} 6, ${cx - 28} 6`,
    `C ${cx - 16} 6, ${cx - 16} 46, ${cx} 46`,
    `C ${cx + 16} 46, ${cx + 16} 6, ${cx + 28} 6`,
    `C ${cx + 36} 6, ${cx + 42} ${baseY}, ${cx + 52} ${baseY}`,
    `L ${width} ${baseY}`
  ].join(' ');

  return (
    <nav
      ref={navContainerRef}
      aria-label="Student Navigation"
      className="fixed bottom-0 inset-x-0 z-40 max-w-md mx-auto select-none pointer-events-auto"
      style={{
        transform: 'translateZ(0)',
        willChange: 'transform',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.25rem)'
      }}
    >
      {/* Curved SVG Surface Background with Top Border and Restrained Shadow */}
      <div className="absolute inset-x-0 bottom-0 top-[-6px] pointer-events-none overflow-visible">
        <svg
          width={width}
          height={totalHeight}
          className="w-full drop-shadow-[0_-3px_14px_rgba(0,0,0,0.06)]"
          style={{ display: 'block' }}
        >
          <defs>
            {/* Subtle inner concave scoop depth gradient */}
            <radialGradient id="notchInnerDepth" cx="50%" cy="45%" r="50%">
              <stop offset="0%" stopColor="#1A4731" stopOpacity="0.06" />
              <stop offset="70%" stopColor="#1A4731" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Nav surface shape */}
          <path d={pathD} fill="#FFFFFF" />

          {/* Soft depth shading within concave scoop */}
          <circle cx={cx} cy="26" r="32" fill="url(#notchInnerDepth)" />

          {/* Smooth continuous top border */}
          <path
            d={strokeD}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* 5-Column Navigation Tabs Container */}
      <div className="relative z-10 grid grid-cols-5 h-[64px] items-end pb-1.5 px-1">
        {tabs.map((tab) => {
          if (tab.isAction) {
            return (
              <div key={tab.id} className="flex flex-col items-center justify-end h-full relative">
                {/* Elevated Central Scan Button */}
                <button
                  type="button"
                  id="nav-scan-button"
                  onClick={onScanClick}
                  className="absolute -top-4 w-[52px] h-[52px] rounded-full bg-gradient-to-b from-[#1A4731] to-[#143826] active:scale-95 text-white flex items-center justify-center shadow-[0_6px_16px_rgba(26,71,49,0.36)] ring-[3.5px] ring-[#F8FAF9] transition-transform duration-150 focus:outline-none focus:ring-[#1A4731]/40 cursor-pointer"
                  title="Scan Attendance QR"
                  aria-label="Scan Attendance QR"
                >
                  <QrCode className="w-6 h-6 stroke-[2.2] text-white" />
                </button>

                {/* Harmonized Label matching adjacent baselines */}
                <span className="text-[10px] font-bold text-[#1A4731] tracking-tight pb-0.5">
                  Scan
                </span>
              </div>
            );
          }

          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              id={`nav-tab-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-end h-full pb-0.5 transition-colors duration-150 focus:outline-none cursor-pointer ${
                isActive ? 'text-[#1A4731]' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className="relative flex flex-col items-center">
                <Icon
                  className={`w-5 h-5 transition-transform duration-150 ${
                    isActive ? 'stroke-[2.4] scale-105' : 'stroke-[1.8]'
                  }`}
                />
                {isActive && (
                  <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-[#1A4731]" />
                )}
              </div>
              <span
                className={`text-[10px] mt-1 transition-all ${
                  isActive ? 'font-bold text-[#1A4731]' : 'font-medium text-slate-400'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
