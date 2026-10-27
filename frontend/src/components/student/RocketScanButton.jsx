
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { QrCode } from 'lucide-react';

/**
 * RocketScanButton
 * 
 * Refinements:
 * 1. Button shape remains a 100% PERFECT CIRCLE (never morphs into pill/capsule).
 * 2. Thrusters are positioned strictly UNDERNEATH the circle (z-index behind circle, top: 50px).
 *    NEVER cuts through or overlaps the QR code in the middle.
 * 3. Thruster nozzles & flames are sleek and compact ("jada bade nhi dikhne chahiye").
 * 4. High-performance particle rendering: Pre-rendered offscreen sprite cache for zero-hang 60fps translation.
 * 5. Full viewport canvas blur filter removed to eliminate GPU compositing stalls.
 * 6. Smooth scanner reveal as rocket ascends towards the top.
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
  const spriteCacheRef = useRef(null);

  // Check prefers-reduced-motion
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Initialize pre-rendered offscreen canvas sprites once (hardware-accelerated blitting)
  const getSprites = () => {
    if (spriteCacheRef.current) return spriteCacheRef.current;

    // 1. Volumetric White/Cloud Cauliflower Puff Sprite
    const whiteCanvas = document.createElement('canvas');
    whiteCanvas.width = 128;
    whiteCanvas.height = 128;
    const wCtx = whiteCanvas.getContext('2d');
    if (wCtx) {
      const grad = wCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
      grad.addColorStop(0.35, 'rgba(250, 252, 250, 0.92)');
      grad.addColorStop(0.68, 'rgba(226, 232, 240, 0.65)');
      grad.addColorStop(0.88, 'rgba(167, 243, 208, 0.22)');
      grad.addColorStop(1, 'rgba(167, 243, 208, 0)');
      wCtx.fillStyle = grad;
      wCtx.beginPath();
      wCtx.arc(64, 64, 64, 0, Math.PI * 2);
      wCtx.fill();
    }

    // 2. Soft Mint-Tinted Ambient Cloud Sprite
    const mintCanvas = document.createElement('canvas');
    mintCanvas.width = 128;
    mintCanvas.height = 128;
    const mCtx = mintCanvas.getContext('2d');
    if (mCtx) {
      const mGrad = mCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
      mGrad.addColorStop(0, 'rgba(240, 253, 244, 0.95)');
      mGrad.addColorStop(0.35, 'rgba(209, 250, 229, 0.82)');
      mGrad.addColorStop(0.70, 'rgba(167, 243, 208, 0.45)');
      mGrad.addColorStop(1, 'rgba(167, 243, 208, 0)');
      mCtx.fillStyle = mGrad;
      mCtx.beginPath();
      mCtx.arc(64, 64, 64, 0, Math.PI * 2);
      mCtx.fill();
    }

    spriteCacheRef.current = { white: whiteCanvas, mint: mintCanvas };
    return spriteCacheRef.current;
  };

  // Spawns wide rolling ground smoke bank across bottom
  const spawnRollingSmokeBank = (cx, cy) => {
    const screenW = typeof window !== 'undefined' ? window.innerWidth : 390;
    const maxSpread = Math.min(screenW * 0.9, 380);

    // 36 dense, large rolling puffs (lightweight on CPU, visually full & majestic)
    for (let i = 0; i < 36; i++) {
      const isMint = Math.random() > 0.65;
      const angle = Math.PI * (0.8 + Math.random() * 1.4);
      const speed = 1.0 + Math.random() * 3.5;

      particlesRef.current.push({
        x: cx + (Math.random() - 0.5) * maxSpread,
        y: cy + (Math.random() - 0.5) * 16,
        vx: Math.cos(angle) * speed * 2.0,
        vy: (Math.random() - 0.5) * 0.8,
        size: 38 + Math.random() * 34,
        maxSize: 125 + Math.random() * 80,
        growRate: 2.2 + Math.random() * 1.8,
        alpha: 0.98,
        decay: 0.007 + Math.random() * 0.006,
        isMint,
        curlAngle: Math.random() * Math.PI * 2,
        curlSpeed: 0.02 + Math.random() * 0.03,
        curlRadius: 0.8 + Math.random() * 1.0
      });
    }
  };

  // Trailing Twin Jet Plumes: Compact, smooth emission that increases with altitude
  const spawnJetSmokePuffs = (leftX, rightX, rocketY, intensity = 1.0) => {
    const nozzles = [leftX, rightX];
    nozzles.forEach((nx) => {
      // 1-2 puffs per nozzle per pulse for lightweight 60fps performance
      const count = intensity > 2.5 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const lateralSpread = (Math.random() - 0.5) * (24 * Math.min(intensity, 2.0));
        particlesRef.current.push({
          x: nx + lateralSpread,
          y: rocketY + 28 + Math.random() * 8,
          vx: (Math.random() - 0.5) * (3.0 * intensity),
          vy: 2.0 + Math.random() * 3.0,
          size: (30 + Math.random() * 24) * Math.min(intensity * 0.75, 1.4),
          maxSize: (85 + Math.random() * 65) * Math.min(intensity * 0.8, 1.8),
          growRate: 2.4 + Math.random() * 2.0,
          alpha: Math.min(0.96, 0.85 + intensity * 0.04),
          decay: 0.012 + Math.random() * 0.008,
          isMint: Math.random() > 0.7,
          curlAngle: Math.random() * Math.PI * 2,
          curlSpeed: 0.025 + Math.random() * 0.035,
          curlRadius: 0.7 + Math.random() * 1.1
        });
      }

      // 1 quick spark beneath nozzle
      particlesRef.current.push({
        x: nx + (Math.random() - 0.5) * 6,
        y: rocketY + 30 + Math.random() * 6,
        vx: (Math.random() - 0.5) * 4.0,
        vy: 6.0 + Math.random() * 7.0,
        size: 2.5 + Math.random() * 2.0,
        alpha: 1,
        decay: 0.08 + Math.random() * 0.04,
        isSpark: true
      });
    });
  };

  // Synchronized 60fps Animation Loop (Optimized for buttery smooth translation without hangs)
  const startLaunchAnimation = (startScreenX, startScreenY) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const sprites = getSprites();

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    particlesRef.current = [];
    scanTriggeredRef.current = false;

    // Initial rolling ground cloud bank across bottom
    spawnRollingSmokeBank(startScreenX, startScreenY);

    const startTime = performance.now();
    const ignitionDuration = 260;
    const flightDuration = 2200;
    const totalDuration = 3200;
    let frameCount = 0;

    const loop = (now) => {
      frameCount++;
      const elapsed = now - startTime;

      let rocketScale = 1.0;
      let currentOffsetY = 0;
      let opacity = 1.0;

      if (elapsed < ignitionDuration) {
        // Step 1: Ignition - Button expands smoothly in size from 1.0 to 1.15
        const ignProgress = elapsed / ignitionDuration;
        rocketScale = 1.0 + ignProgress * 0.15;
        currentOffsetY = Math.sin(ignProgress * Math.PI) * 1.2;
      } else {
        // Step 2: Smooth calm ascent
        const flightProgress = Math.min((elapsed - ignitionDuration) / flightDuration, 1.0);
        const easeCurve = Math.pow(flightProgress, 1.85);
        const totalDist = startScreenY + 220;
        currentOffsetY = -easeCurve * totalDist;

        // Button continues expanding into prominent circle craft (scales up to 1.22x)
        rocketScale = 1.15 + flightProgress * 0.07;

        if (flightProgress > 0.88) {
          opacity = Math.max(0, 1 - (flightProgress - 0.88) / 0.12);
        }

        // Step 3: Trigger camera scanner as rocket reaches upper quarter
        if (flightProgress >= 0.80 && !scanTriggeredRef.current) {
          scanTriggeredRef.current = true;
          // Defer call slightly to prevent React render frame spikes
          if (onScanClick) {
            requestAnimationFrame(() => onScanClick());
          }
        }

        // Step 4: Smoke emission - throttled every 2 frames for silky smooth 60fps
        if (flightProgress < 0.98 && frameCount % 2 === 0) {
          const intensity = 1.0 + Math.pow(flightProgress, 1.25) * 3.2;
          const currentRocketScreenY = startScreenY + currentOffsetY;
          const nozzleOffset = 14 * rocketScale;
          const leftNozzleX = startScreenX - nozzleOffset;
          const rightNozzleX = startScreenX + nozzleOffset;

          spawnJetSmokePuffs(leftNozzleX, rightNozzleX, currentRocketScreenY, intensity);
        }
      }

      // Update circular rocket craft DOM node via GPU transform
      if (rocketCraftRef.current) {
        rocketCraftRef.current.style.transform = `translate3d(0, ${currentOffsetY}px, 0) scale(${rocketScale})`;
        rocketCraftRef.current.style.opacity = `${opacity}`;
      }

      // Smoothly fade smoke canvas as scanner reveals underneath
      if (canvasRef.current) {
        let canvasOpacity = 1.0;
        if (elapsed > 1700) {
          canvasOpacity = Math.max(0, 1.0 - (elapsed - 1700) / 700);
        }
        canvasRef.current.style.opacity = `${canvasOpacity}`;
      }

      // Clear & render canvas clouds using pre-rendered texture blits
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const active = [];
      const len = particlesRef.current.length;

      for (let i = 0; i < len; i++) {
        const p = particlesRef.current[i];

        // Curl-noise vortex physics: authentic rolling mushroom / cauliflower curls
        p.curlAngle += p.curlSpeed;
        p.x += p.vx + Math.cos(p.curlAngle) * p.curlRadius;
        p.y += p.vy - Math.sin(p.curlAngle) * p.curlRadius * 0.4;

        if (p.growRate) {
          p.size = Math.min(p.size + p.growRate, p.maxSize);
        }
        p.alpha -= p.decay;

        if (p.alpha > 0.02) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);

          if (p.isSpark) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Hardware-accelerated image blit: ultra-fast, zero GC allocations
            const sprite = p.isMint ? sprites.mint : sprites.white;
            ctx.drawImage(sprite, p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
          }

          ctx.restore();
          active.push(p);
        }
      }

      // Keep active array bounded (prevent memory spikes)
      if (active.length > 70) {
        active.splice(0, active.length - 70);
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
          {/* 1. Full-Viewport Volumetric Cloud Smoke Canvas (rendered behind rocket craft, NO laggy CSS filter blur) */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ width: '100vw', height: '100vh', zIndex: 1 }}
          />

          {/* 
            2. Scaled Rocket Craft:
            - EXACT SAME CIRCULAR SHAPE as the navbar button (w-[52px] h-[52px] rounded-full aspect-square).
            - Thrusters are strictly UNDER the circle (never overlapping QR code).
            - Sleek, compact size ("jada bade nhi dikhne chahiye").
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
            <div className="relative z-10 w-[52px] h-[52px] min-w-[52px] min-h-[52px] rounded-full aspect-square bg-gradient-to-b from-[#10B981] via-[#15803D] to-[#1A4731] text-white flex items-center justify-center shadow-[0_8px_24px_rgba(16,185,129,0.5)] ring-3 ring-white">
              {/* Subtle glass reflection sheen */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/25 to-transparent pointer-events-none" />

              {/* Centered QR Code Icon: Completely pristine and clean */}
              <QrCode className="w-6 h-6 stroke-[2.2] text-white relative z-2" />
            </div>

            {/* 
              Sleek, Miniature Thruster Pods - Positioned strictly UNDER the circle 
              - Placed at top: 49px (emerges from bottom rim of the 52px circle)
              - Small & sleek ("jada bade nhi dikhne chahiye")
              - Positioned behind the circle white ring (z-0 behind z-10)
              - ZERO thrusters on or inside the QR code face
            */}
            <div className="absolute top-[49px] inset-x-0 flex justify-between px-3.5 pointer-events-none z-0">
              {/* Left Thruster Pod & Flame */}
              <div className="flex flex-col items-center">
                <span className="w-2 h-1 rounded-b-xs bg-[#092215] border-t border-emerald-400/80 shadow-xs" />
                <span className="w-1.5 h-4.5 -mt-0.5 rounded-b-full bg-gradient-to-b from-white via-emerald-300 to-transparent shadow-[0_0_8px_#10B981]" />
              </div>
              {/* Right Thruster Pod & Flame */}
              <div className="flex flex-col items-center">
                <span className="w-2 h-1 rounded-b-xs bg-[#092215] border-t border-emerald-400/80 shadow-xs" />
                <span className="w-1.5 h-4.5 -mt-0.5 rounded-b-full bg-gradient-to-b from-white via-emerald-300 to-transparent shadow-[0_0_8px_#10B981]" />
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
