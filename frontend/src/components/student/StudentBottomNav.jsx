import React, { useState, useEffect, useRef } from 'react';
import { Home, CalendarDays, QrCode, CheckSquare, User } from 'lucide-react';
import RocketScanButton from './RocketScanButton';

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
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.5rem)'
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
              <RocketScanButton
                key={tab.id}
                onScanClick={onScanClick}
              />
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
              className={`flex flex-col items-center justify-end h-full min-h-[44px] pb-0.5 transition-all duration-200 focus:outline-none cursor-pointer active:scale-90 ${
                isActive ? 'text-[#1A4731]' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className="relative flex flex-col items-center">
                <Icon
                  className={`w-5 h-5 transition-all duration-200 ${
                    isActive ? 'stroke-[2.5] scale-110 drop-shadow-[0_2px_4px_rgba(26,71,49,0.18)]' : 'stroke-[1.8]'
                  }`}
                />
                {isActive && (
                  <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-[#1A4731] animate-in zoom-in-50 duration-200 shadow-xs" />
                )}
              </div>
              <span
                className={`text-[11px] mt-1 transition-all ${
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
