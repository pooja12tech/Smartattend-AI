import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { QrCode } from 'lucide-react';

/**
 * RocketScanButton
 * 
 * Final Refinement matching user specifications & feedback:
 * 1. Button shape remains a 100% PERFECT CIRCLE (never morphs into an oblong pill/capsule).
 * 2. Size expands smoothly (scale: 1.0 -> 1.22) on liftoff.
 * 3. Thrusters are sleek, miniature, and elegant (no large bulky rectangular blocks).
 * 4. Massive billowing volumetric smoke matching reference photo:
 *    - Rolling cauliflower/mushroom curls with volumetric white & pale cloud shading.
 *    - Escalates heavily as rocket climbs ("jaise jaise rocket upar jayega waise waise smoke badhega").
 * 5. Rocket and canvas are driven in the exact same requestAnimationFrame loop for 100% precision.
 * 6. Smooth scanner reveal as rocket reaches top.
 */
export default function RocketScanButton({ onScanClick, disabled = false }) {
  const [animState, setAnimState] = useState('idle'); // 'idle' | 'launching'
  const [buttonOrigin, setButtonOrigin] = useState(null);
  const canvasRef = useRef(null);
  const rocketCraftRef = useRef(null);
  const animFrameRef = useRef(null);
  const isLaunchingRef = useRef(false);
  const scanTriggeredRef = useRef(false);
  const particlesRef = useRef([]);

  // Check prefers-reduced-motion
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Spawns wide rolling cauliflower/mushroom ground smoke bank (matching user reference image)
  const spawnRollingSmokeBank = (cx, cy, count = 110) => {
    const screenW = typeof window !== 'undefined' ? window.innerWidth : 390;
    const maxSpread = Math.min(screenW * 0.92, 400);

    for (let i = 0; i < count; i++) {
      const isPureWhite = Math.random() > 0.28;
      const angle = Math.PI * (0.8 + Math.random() * 1.4); // Wide lateral roll
      const speed = 1.2 + Math.random() * 4.6;

      particlesRef.current.push({
        x: cx + (Math.random() - 0.5) * maxSpread,
        y: cy + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed * 2.4,
        vy: (Math.random() - 0.5) * 1.2,
        size: 32 + Math.random() * 30,
        maxSize: 110 + Math.random() * 85, // huge billowing cauliflower cloud puffs
        growRate: 2.2 + Math.random() * 2.2,
        alpha: 0.98,
        decay: 0.0035 + Math.random() * 0.0035, // dense, lingers majestically
        colorR: isPureWhite ? 255 : 242,
        colorG: isPureWhite ? 255 : 248,
        colorB: isPureWhite ? 255 : 244,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.035,
        curlAngle: Math.random() * Math.PI * 2,
        curlSpeed: 0.02 + Math.random() * 0.035,
        curlRadius: 0.8 + Math.random() * 1.2
      });
    }
  };

  // Trailing Twin Jet Plumes: Spawns dense curling smoke that INCREASES with altitude
  const spawnJetSmokePuffs = (leftX, rightX, rocketY, intensity = 1.0) => {
    // Number of particles increases heavily as rocket climbs ("jaise jaise rocket upar jayega waise waise smoke badhega")
    const pCount = Math.round(6 * intensity);

    const nozzles = [leftX, rightX];
    nozzles.forEach((nx) => {
      for (let i = 0; i < pCount; i++) {
        const isPureWhite = Math.random() > 0.25;
        const lateralSpread = (Math.random() - 0.5) * (45 * intensity);
        const lateralVel = (Math.random() - 0.5) * (5.5 * intensity);

        particlesRef.current.push({
          x: nx + lateralSpread,
          y: rocketY + 22 + Math.random() * 12,
          vx: lateralVel,
          vy: (2.0 + Math.random() * 3.8) * Math.min(intensity * 0.75, 1.8), // downward exhaust plume
          size: (28 + Math.random() * 26) * Math.min(intensity * 0.7, 1.6),
          maxSize: (90 + Math.random() * 80) * Math.min(intensity * 0.8, 2.2),
          growRate: 2.2 + Math.random() * 2.2,
          alpha: Math.min(0.98, 0.90 + intensity * 0.03),
          decay: 0.005 + Math.random() * 0.0045,
          colorR: isPureWhite ? 255 : 242,
          colorG: isPureWhite ? 255 : 248,
          colorB: isPureWhite ? 255 : 244,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.04,
          curlAngle: Math.random() * Math.PI * 2,
          curlSpeed: 0.025 + Math.random() * 0.04,
          curlRadius: 0.8 + Math.random() * 1.4
        });
      }

      // Bright fiery thrust sparks for energetic liftoff
      for (let i = 0; i < 2; i++) {
        particlesRef.current.push({
          x: nx + (Math.random() - 0.5) * 12,
          y: rocketY + 24 + Math.random() * 8,
          vx: (Math.random() - 0.5) * 5.5,
          vy: 8.0 + Math.random() * 9.0,
          size: 3.5 + Math.random() * 2.5,
          maxSize: 6,
          growRate: 0,
          alpha: 1,
          decay: 0.05 + Math.random() * 0.04,
          isSpark: true
        });
      }
    });
  };

  // Full-screen Smoke & Rocket Physics Loop (100% synchronized at 60fps)
  const startLaunchAnimation = (startScreenX, startScreenY) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    particlesRef.current = [];
    scanTriggeredRef.current = false;

    // Initial rolling ground cloud bank across bottom
    spawnRollingSmokeBank(startScreenX, startScreenY, 110);

    const startTime = performance.now();
    const ignitionDuration = 260; // Button scale expansion & thruster ignition buildup
    const flightDuration = 2200; // Calmer, smoother ascent duration (2.2s)
    const totalDuration = 3400; // Lingering clouds time

    const loop = (now) => {
      const elapsed = now - startTime;

      let rocketScale = 1.0;
      let currentOffsetY = 0;
      let opacity = 1.0;

      if (elapsed < ignitionDuration) {
        // Step 1: Ignition - Button expands smoothly in size from 1.0 to 1.15
        const ignProgress = elapsed / ignitionDuration;
        rocketScale = 1.0 + ignProgress * 0.15;
        currentOffsetY = Math.sin(ignProgress * Math.PI) * 1.5; // slight engine prep rumble
      } else {
        // Step 2: Smooth calm ascent ("aram se jayega thoda", "speed thoda km kr")
        const flightProgress = Math.min((elapsed - ignitionDuration) / flightDuration, 1.0);
        // Calm ease-in curve: gentle liftoff accelerating smoothly upwards
        const easeCurve = Math.pow(flightProgress, 1.85);
        const totalDist = startScreenY + 220; // from bottom all the way off top
        currentOffsetY = -easeCurve * totalDist;

        // Button continues expanding into prominent circle craft (scales up to 1.22x)
        rocketScale = 1.15 + flightProgress * 0.07;

        if (flightProgress > 0.88) {
          // Softly fade rocket as it exits beyond the top
          opacity = Math.max(0, 1 - (flightProgress - 0.88) / 0.12);
        }

        // Step 3: Reveal Camera Scanner as rocket reaches upper quarter (~78% of climb)
        if (flightProgress >= 0.78 && !scanTriggeredRef.current) {
          scanTriggeredRef.current = true;
          if (onScanClick) onScanClick();
        }

        // Step 4: Smoke escalates heavily as rocket climbs ("jaise jaise rocket upar jayega waise waise smoke badhega")
        if (flightProgress < 0.98) {
          const intensity = 1.0 + Math.pow(flightProgress, 1.25) * 3.6;
          const currentRocketScreenY = startScreenY + currentOffsetY;
          const nozzleOffset = 15 * rocketScale;
          const leftNozzleX = startScreenX - nozzleOffset;
          const rightNozzleX = startScreenX + nozzleOffset;

          spawnJetSmokePuffs(leftNozzleX, rightNozzleX, currentRocketScreenY, intensity);
        }
      }

      // Update circular rocket craft DOM node directly in sync with smoke particles
      if (rocketCraftRef.current) {
        rocketCraftRef.current.style.transform = `translate3d(0, ${currentOffsetY}px, 0) scale(${rocketScale})`;
        rocketCraftRef.current.style.opacity = `${opacity}`;
      }

      // Smoothly fade smoke canvas as scanner reveals underneath
      if (canvasRef.current) {
        let canvasOpacity = 1.0;
        if (elapsed > 1850) {
          canvasOpacity = Math.max(0, 1.0 - (elapsed - 1850) / 750);
        }
        canvasRef.current.style.opacity = `${canvasOpacity}`;
      }

      // Clear & render canvas clouds
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const active = [];

      for (let i = 0; i < particlesRef.current.length; i++) {
        const p = particlesRef.current[i];

        // Curl-noise vortex physics: authentic rolling mushroom / cauliflower curls
        p.curlAngle += p.curlSpeed;
        p.x += p.vx + Math.cos(p.curlAngle) * p.curlRadius;
        p.y += p.vy - Math.sin(p.curlAngle) * p.curlRadius * 0.45;

        p.size = Math.min(p.size + p.growRate, p.maxSize);
        p.alpha -= p.decay;
        if (p.rotation !== undefined) p.rotation += p.rotSpeed;

        if (p.alpha > 0.01) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);

          if (p.isSpark) {
            // Bright white-hot fiery spark core
            ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Volumetric billowing cauliflower puff (matching reference photo: white/cloud body with soft contours)
            ctx.translate(p.x, p.y);
            if (p.rotation) ctx.rotate(p.rotation);

            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
            // Core highlight (pure cloud white)
            grad.addColorStop(0, `rgba(${p.colorR}, ${p.colorG}, ${p.colorB}, 0.98)`);
            // Inner cloud body (bright cloud white)
            grad.addColorStop(0.35, `rgba(252, 253, 252, 0.95)`);
            // Volumetric 3D cauliflower contour shadow (giving natural curl definition)
            grad.addColorStop(0.68, `rgba(226, 232, 240, 0.65)`);
            // Ambient fresh mint rim glow
            grad.addColorStop(0.88, `rgba(167, 243, 208, 0.22)`);
            // Soft transparent edge
            grad.addColorStop(1, `rgba(167, 243, 208, 0)`);

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

      if (elapsed < totalDuration || active.length > 0) {
        animFrameRef.current = requestAnimationFrame(loop);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setAnimState('idle');
        setButtonOrigin(null);
        isLaunchingRef.current = false;
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);
  };

  const handleLaunch = useCallback((e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (disabled || isLaunchingRef.current) return;

    if (prefersReducedMotion) {
      if (onScanClick) onScanClick();
      return;
    }

    isLaunchingRef.current = true;
    setAnimState('launching');

    // Get exact button position on screen for portal coordinates
    const btnEl = document.getElementById('nav-scan-button');
    let rect = { left: window.innerWidth / 2 - 26, top: window.innerHeight - 70, width: 52, height: 52 };
    if (btnEl) {
      const r = btnEl.getBoundingClientRect();
      rect = { left: r.left, top: r.top, width: r.width, height: r.height };
    }
    setButtonOrigin(rect);

    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;

    requestAnimationFrame(() => {
      startLaunchAnimation(startX, startY);
    });
  }, [disabled, onScanClick, prefersReducedMotion]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const isLaunching = animState === 'launching';

  return (
    <>
      {/* 
        DOCUMENT.BODY PORTAL:
        Renders the full-screen smoke canvas & circular rocket craft directly in document.body.
      */}
      {isLaunching && buttonOrigin && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 9999 }}>
          {/* 1. Full-Viewport Volumetric Cloud Smoke Canvas (rendered behind rocket craft) */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ width: '100vw', height: '100vh', zIndex: 1, filter: 'blur(1.5px)' }}
          />

          {/* 
            2. Scaled Rocket Craft:
            - EXACT SAME CIRCULAR SHAPE as the navbar button (w-[52px] h-[52px] rounded-full aspect-square).
            - NO weird pill/capsule oval distortion.
            - Sleek, tiny thruster nozzles (no huge bulky blocks).
          */}
          <div
            ref={rocketCraftRef}
            className="absolute flex flex-col items-center pointer-events-none"
            style={{
              left: `${buttonOrigin.left}px`,
              top: `${buttonOrigin.top}px`,
              width: `${buttonOrigin.width}px`,
              height: `${buttonOrigin.height}px`,
              zIndex: 10,
              transformOrigin: '50% 50%',
              willChange: 'transform, opacity'
            }}
          >
            {/* The Perfect Circle Rocket Button Body */}
            <div className="relative w-[52px] h-[52px] min-w-[52px] min-h-[52px] rounded-full aspect-square bg-gradient-to-b from-[#10B981] via-[#15803D] to-[#1A4731] text-white flex items-center justify-center shadow-[0_8px_24px_rgba(16,185,129,0.5)] ring-3 ring-white">
              {/* Subtle glass reflection sheen */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/25 to-transparent pointer-events-none" />

              {/* Centered QR Code Icon */}
              <QrCode className="w-6 h-6 stroke-[2.2] text-white" />

              {/* 
                Sleek, Tiny Thruster Pods (Nestled under the bottom curve of the circle)
                - Tiny: only 9px wide by 5px high
                - No giant black rectangular blocks!
              */}
              <div className="absolute -bottom-1 inset-x-0 flex justify-between px-3 pointer-events-none">
                {/* Left Pod */}
                <div className="flex flex-col items-center">
                  <span className="w-2.5 h-1.5 rounded-b-xs bg-[#0b2416] border-t border-emerald-400/80 shadow-xs" />
                  <span className="w-2 h-7 -mt-0.5 rounded-b-full bg-gradient-to-b from-white via-emerald-300 to-transparent shadow-[0_0_12px_#10B981] animate-pulse" />
                </div>
                {/* Right Pod */}
                <div className="flex flex-col items-center">
                  <span className="w-2.5 h-1.5 rounded-b-xs bg-[#0b2416] border-t border-emerald-400/80 shadow-xs" />
                  <span className="w-2 h-7 -mt-0.5 rounded-b-full bg-gradient-to-b from-white via-emerald-300 to-transparent shadow-[0_0_12px_#10B981] animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* NAVBAR MOUNTED BUTTON */}
      <div className="flex flex-col items-center justify-end h-full relative">
        {/* Idle Breathing Aura behind elevated button (Only in normal resting state) */}
        {!isLaunching && (
          <div className="absolute -top-3.5 w-13 h-13 rounded-full bg-emerald-500/20 animate-pulse pointer-events-none" />
        )}

        {/* 
          Resting Scan Button:
          - Simple, clean 52px elevated circular button.
          - 100% perfect circle (rounded-full aspect-square).
          - NO thrusters visible in navbar resting state.
          - Smoothly hidden during launch as portal craft takes over.
        */}
        <div
          className={`absolute -top-3.5 z-20 flex flex-col items-center transition-opacity duration-150 ${
            isLaunching ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <button
            type="button"
            id="nav-scan-button"
            onClick={handleLaunch}
            disabled={disabled || isLaunching}
            className="group relative w-[52px] h-[52px] min-w-[52px] min-h-[52px] rounded-full aspect-square bg-gradient-to-b from-[#10B981] via-[#15803D] to-[#1A4731] text-white flex items-center justify-center shadow-[0_6px_18px_rgba(16,185,129,0.38)] ring-3 ring-white focus:outline-none cursor-pointer overflow-visible hover:scale-105 active:scale-95 transition-all duration-200"
            title="Scan Attendance QR"
            aria-label="Scan Attendance QR"
          >
            {/* Subtle glass reflection sheen */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/25 to-transparent pointer-events-none" />

            {/* Normal QR Icon */}
            <QrCode className="w-6 h-6 stroke-[2.2] text-white group-hover:scale-110 transition-transform duration-200" />
          </button>
        </div>

        {/* Clean Scan Label matching adjacent navbar labels */}
        <span
          className={`text-[11px] font-bold tracking-tight pb-0.5 transition-opacity duration-150 ${
            isLaunching ? 'opacity-0' : 'text-[#1A4731]'
          }`}
        >
          Scan
        </span>
      </div>
    </>
  );
}
