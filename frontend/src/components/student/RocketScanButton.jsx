import React, { useState, useRef, useEffect, useCallback } from 'react';
import { QrCode, Sparkles } from 'lucide-react';

/**
 * RocketScanButton
 * Transforms the PWA mobile bottom-nav Scan button into a rocket launch
 * animation inspired by React Bits FlyingButton, with thruster flames,
 * volumetric billowing smoke (badal/dhua particles), and seamless camera trigger.
 */
export default function RocketScanButton({ onScanClick, disabled = false }) {
  const [animState, setAnimState] = useState('idle'); // 'idle' | 'igniting' | 'launching'
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const isLaunchingRef = useRef(false);
  const particlesRef = useRef([]);

  // Check prefers-reduced-motion
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Particle system for smoke and thruster fire
  const spawnGroundSmoke = (x, y, count = 12) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 2.2;
      particlesRef.current.push({
        x: x + (Math.random() - 0.5) * 24,
        y: y + (Math.random() - 0.5) * 8,
        vx: Math.cos(angle) * speed * 1.8,
        vy: -Math.abs(Math.sin(angle)) * speed * 0.8 - 0.3,
        size: 10 + Math.random() * 14,
        maxSize: 34 + Math.random() * 26,
        growRate: 0.8 + Math.random() * 1.2,
        alpha: 0.75 + Math.random() * 0.2,
        decay: 0.016 + Math.random() * 0.018,
        color: Math.random() > 0.4 ? 'rgba(235, 244, 238, ' : 'rgba(209, 250, 229, ', // emerald-tinted cloud
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.06
      });
    }
  };

  const spawnTrailParticles = (x, y) => {
    // 2-3 trailing smoke puffs per frame
    for (let i = 0; i < 3; i++) {
      particlesRef.current.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y + 8 + Math.random() * 6,
        vx: (Math.random() - 0.5) * 1.4,
        vy: 1.2 + Math.random() * 2.2, // downward exhaust velocity
        size: 8 + Math.random() * 8,
        maxSize: 26 + Math.random() * 16,
        growRate: 0.6 + Math.random() * 0.8,
        alpha: 0.8,
        decay: 0.024 + Math.random() * 0.02,
        color: Math.random() > 0.3 ? 'rgba(240, 248, 243, ' : 'rgba(167, 243, 208, ',
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.08
      });
    }

    // Bright fiery thrust sparks
    for (let i = 0; i < 2; i++) {
      particlesRef.current.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + 6 + Math.random() * 4,
        vx: (Math.random() - 0.5) * 2.5,
        vy: 3.5 + Math.random() * 3.5,
        size: 3 + Math.random() * 3,
        maxSize: 4,
        growRate: 0,
        alpha: 1,
        decay: 0.07 + Math.random() * 0.05,
        color: Math.random() > 0.5 ? 'rgba(52, 211, 153, ' : 'rgba(251, 191, 36, ', // mint / flame gold
        isSpark: true
      });
    }
  };

  // Run particle canvas animation loop
  const runParticleLoop = (startTime, duration = 1200) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const originX = width / 2;
    const originY = height - 50;

    let lastTime = performance.now();

    const loop = (now) => {
      const elapsed = now - startTime;
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      // Calculate approximate rocket position for trail emission
      let rocketProgress = 0;
      if (elapsed > 120) {
        rocketProgress = Math.min((elapsed - 120) / 600, 1);
      }
      // ease-in acceleration curve
      const rocketY = originY - Math.pow(rocketProgress, 2.2) * 220;

      // Spawn trail while launching
      if (elapsed > 100 && elapsed < 700) {
        spawnTrailParticles(originX, rocketY);
      }

      ctx.clearRect(0, 0, width, height);

      // Render & update particles
      const active = [];
      for (let i = 0; i < particlesRef.current.length; i++) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.size = Math.min(p.size + p.growRate, p.maxSize);
        p.alpha -= p.decay;
        if (p.rotation !== undefined) {
          p.rotation += p.rotSpeed;
        }

        if (p.alpha > 0.01) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);

          if (p.isSpark) {
            ctx.fillStyle = p.color + p.alpha + ')';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Soft billowing cloud particle with radial gradient
            ctx.translate(p.x, p.y);
            if (p.rotation) ctx.rotate(p.rotation);

            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
            grad.addColorStop(0, p.color + '0.95)');
            grad.addColorStop(0.6, p.color + '0.55)');
            grad.addColorStop(1, p.color + '0)');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, p.size, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
          active.push(p);
        }
      }
      particlesRef.current = active;

      if (elapsed < duration || active.length > 0) {
        animFrameRef.current = requestAnimationFrame(loop);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);
  };

  const handleLaunch = useCallback(() => {
    if (disabled || isLaunchingRef.current) return;

    // Accessibility check: Reduced motion bypasses animation immediately
    if (prefersReducedMotion) {
      if (onScanClick) onScanClick();
      return;
    }

    isLaunchingRef.current = true;
    setAnimState('igniting');

    // Canvas coordinate setup
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = 280;
      canvas.height = 360;
      particlesRef.current = [];
      // Ground explosion of billowing smoke puffs
      spawnGroundSmoke(140, 310, 16);
      runParticleLoop(performance.now(), 1400);
    }

    // Step 2: Transition from ignition rumble to upward rocket launch at 120ms
    const launchTimer = setTimeout(() => {
      setAnimState('launching');
    }, 120);

    // Step 3: Trigger the QR scanner camera after the rocket disappears into smoke (750ms)
    const triggerTimer = setTimeout(() => {
      if (onScanClick) {
        onScanClick();
      }
    }, 750);

    // Step 4: Reset state cleanly so button returns to resting state
    const resetTimer = setTimeout(() => {
      setAnimState('idle');
      isLaunchingRef.current = false;
    }, 1100);

    return () => {
      clearTimeout(launchTimer);
      clearTimeout(triggerTimer);
      clearTimeout(resetTimer);
    };
  }, [disabled, onScanClick, prefersReducedMotion]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  const isIgniting = animState === 'igniting';
  const isLaunching = animState === 'launching';
  const isFlying = isIgniting || isLaunching;

  return (
    <div className="flex flex-col items-center justify-end h-full relative">
      {/* Particle Canvas Overlay for volumetric smoke & flames */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute -bottom-3 left-1/2 -translate-x-1/2 z-20"
        style={{
          width: '280px',
          height: '360px',
          opacity: isFlying ? 1 : 0,
          transition: 'opacity 0.2s ease-in'
        }}
        aria-hidden="true"
      />

      {/* Ambient breathing ring aura behind elevated Scan button (visible when idle) */}
      {!isFlying && (
        <div className="absolute -top-4 w-[52px] h-[52px] rounded-full bg-emerald-500/25 animate-ring-expand pointer-events-none" />
      )}

      {/* Elevated Rocket Scan Button Container */}
      <div
        className="absolute -top-4 z-10 transition-transform"
        style={{
          transform: isLaunching
            ? 'translate3d(0, -220px, 0) scale(0.65) rotate(-5deg)'
            : isIgniting
            ? 'translate3d(0, 2px, 0) scale(0.96)'
            : 'translate3d(0, 0, 0) scale(1)',
          opacity: isLaunching ? 0 : 1,
          transition: isLaunching
            ? 'transform 0.65s cubic-bezier(0.32, 0, 0.67, 0), opacity 0.55s cubic-bezier(0.4, 0, 1, 1)'
            : isIgniting
            ? 'transform 0.12s ease-out'
            : 'transform 0.25s ease-out, opacity 0.2s ease-out',
          willChange: 'transform, opacity'
        }}
      >
        {/* Dual Thruster Pods (Left & Right) inspired by React Bits FlyingButton */}
        <div
          className="absolute -bottom-1.5 inset-x-0 flex justify-between px-2.5 pointer-events-none transition-opacity duration-150"
          style={{ opacity: isFlying ? 1 : 0 }}
        >
          {/* Left Thruster Pod */}
          <div className="relative flex flex-col items-center">
            <span className="w-2.5 h-1.5 rounded-b-sm bg-[#123323] border-t border-emerald-400/40" />
            {isFlying && (
              <span className="w-2 h-5 rounded-b-full bg-gradient-to-b from-white via-emerald-300 to-transparent shadow-[0_0_8px_#10B981] animate-pulse" />
            )}
          </div>

          {/* Right Thruster Pod */}
          <div className="relative flex flex-col items-center">
            <span className="w-2.5 h-1.5 rounded-b-sm bg-[#123323] border-t border-emerald-400/40" />
            {isFlying && (
              <span className="w-2 h-5 rounded-b-full bg-gradient-to-b from-white via-emerald-300 to-transparent shadow-[0_0_8px_#10B981] animate-pulse" />
            )}
          </div>
        </div>

        {/* Central Core Button */}
        <button
          type="button"
          id="nav-scan-button"
          onClick={handleLaunch}
          disabled={disabled || isFlying}
          className={`group w-[52px] h-[52px] rounded-full bg-gradient-to-b from-[#1A4731] via-[#163f2b] to-[#102c1e] text-white flex items-center justify-center shadow-[0_8px_20px_rgba(26,71,49,0.38)] ring-[3.5px] ring-[#F8FAF9] focus:outline-none cursor-pointer overflow-hidden ${
            !isFlying ? 'hover:scale-105 active:scale-90 transition-all duration-200' : ''
          }`}
          title="Scan Attendance QR"
          aria-label="Scan Attendance QR"
        >
          {/* Subtle glass reflection sheen */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

          {/* Icon with aerodynamic forward tilt during launch */}
          <QrCode
            className={`w-6 h-6 stroke-[2.2] text-white transition-transform duration-200 ${
              isLaunching
                ? 'rotate-12 scale-110'
                : isIgniting
                ? '-rotate-6 scale-95'
                : 'group-active:rotate-12'
            }`}
          />
        </button>
      </div>

      {/* Label matching adjacent baselines */}
      <span className="text-[11px] font-bold text-[#1A4731] tracking-tight pb-0.5">
        Scan
      </span>
    </div>
  );
}
