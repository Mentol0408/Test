"use client";

/* =====================================================================
   Ambient hero effects — floating fire embers + god-ray beams.
   Positions are deterministic (seeded by index) so server and client
   render identically (no hydration mismatch). Motion is CSS-driven and
   auto-disabled under prefers-reduced-motion via v2.css.
   ===================================================================== */

import { cn } from "@/v2/lib/cn";
import type { CSSProperties } from "react";

/** Deterministic pseudo-random in [0,1) from an index + salt. */
function rng(i: number, salt: number) {
  const x = Math.sin((i + 1) * salt) * 43758.5453;
  return x - Math.floor(x);
}

export function Embers({ count = 40, className }: { count?: number; className?: string }) {
  const items = Array.from({ length: count }, (_, i) => ({
    top: 3 + rng(i, 12.9898) * 90,
    left: 2 + rng(i, 78.233) * 95,
    size: 3 + rng(i, 39.42) * 7,
    delay: rng(i, 27.16) * 9,
    dur: 5 + rng(i, 63.7) * 7,
    drift: (rng(i, 51.31) - 0.5) * 44,
    rise: 30 + rng(i, 91.2) * 80,
    op: 0.55 + rng(i, 5.7) * 0.45,
  }));

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      {items.map((e, i) => (
        <span
          key={i}
          className="rw-ember"
          style={
            {
              top: `${e.top}%`,
              left: `${e.left}%`,
              width: e.size,
              height: e.size,
              "--delay": `${e.delay}s`,
              "--dur": `${e.dur}s`,
              "--drift": `${e.drift}px`,
              "--rise": `${e.rise}px`,
              "--op": e.op,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** A plume of sparks rising from a source point (x/y in % of the parent). */
export function EmberStream({
  x,
  y,
  count = 20,
  className,
}: {
  x: number;
  y: number;
  count?: number;
  className?: string;
}) {
  const sparks = Array.from({ length: count }, (_, i) => ({
    startX: (rng(i, 11.13) - 0.5) * 16, // small spread at the base
    size: 2 + rng(i, 22.71) * 4,
    delay: rng(i, 33.19) * 4,
    dur: 3 + rng(i, 44.27) * 3.6,
    sx: 24 + rng(i, 55.31) * 78, // drift up-right (with the smoke)
    sy: 180 + rng(i, 66.42) * 260,
    op: 0.6 + rng(i, 77.53) * 0.4,
  }));

  return (
    <div
      className={cn("pointer-events-none absolute", className)}
      style={{ left: `${x}%`, top: `${y}%` }}
      aria-hidden
    >
      {/* fire glow at the source */}
      <span className="rw-fire-glow" style={{ left: 0, top: 0, width: 130, height: 130 }} />
      {sparks.map((s, i) => (
        <span
          key={i}
          className="rw-spark"
          style={
            {
              left: s.startX,
              bottom: 0,
              width: s.size,
              height: s.size,
              "--delay": `${s.delay}s`,
              "--dur": `${s.dur}s`,
              "--sx": `${s.sx}px`,
              "--sy": `${s.sy}px`,
              "--op": s.op,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/**
 * Full-page ambient backdrop: drifting molten glows + a masked grid + a sparse
 * ember field spread down the whole page. Sits behind every section so the
 * atmosphere continues as you scroll. Place as the first child of an
 * `isolate`d, `relative` container that spans the full page height.
 */
export function PageAtmosphere() {
  const GLOWS = 7;
  const glows = Array.from({ length: GLOWS }, (_, i) => {
    const side = i % 2 === 0 ? "left" : "right";
    return {
      top: 5 + (i * 90) / (GLOWS - 1),
      side,
      off: -10 + rng(i, 13.7) * 8,
      size: 380 + rng(i, 27.3) * 300,
      warm: i % 2 === 0,
      dur: 16 + rng(i, 44.1) * 12,
      delay: rng(i, 55.9) * 6,
      op: 0.1 + rng(i, 66.2) * 0.09,
    };
  });

  const EMBERS = 54;
  const embers = Array.from({ length: EMBERS }, (_, i) => ({
    top: rng(i, 12.9898) * 100,
    left: 2 + rng(i, 78.233) * 96,
    size: 2 + rng(i, 39.42) * 4,
    delay: rng(i, 27.16) * 10,
    dur: 6 + rng(i, 63.7) * 8,
    drift: (rng(i, 51.31) - 0.5) * 40,
    rise: 30 + rng(i, 91.2) * 70,
    op: 0.28 + rng(i, 5.7) * 0.4,
  }));

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
      <div
        className="rw-grid absolute inset-0 opacity-40"
        style={{
          WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 6%, #000 94%, transparent)",
          maskImage: "linear-gradient(to bottom, transparent, #000 6%, #000 94%, transparent)",
        }}
      />
      {glows.map((g, i) => {
        const color = g.warm ? `rgba(255,106,26,${g.op})` : `rgba(255,60,30,${g.op})`;
        const pos: CSSProperties = g.side === "left" ? { left: `${g.off}%` } : { right: `${g.off}%` };
        return (
          <div
            key={`g${i}`}
            className="rw-drift-glow absolute rounded-full blur-3xl"
            style={
              {
                top: `${g.top}%`,
                ...pos,
                width: g.size,
                height: g.size,
                background: `radial-gradient(circle, ${color}, transparent 66%)`,
                "--dur": `${g.dur}s`,
                "--delay": `${g.delay}s`,
              } as CSSProperties
            }
          />
        );
      })}
      {embers.map((e, i) => (
        <span
          key={`e${i}`}
          className="rw-ember"
          style={
            {
              top: `${e.top}%`,
              left: `${e.left}%`,
              width: e.size,
              height: e.size,
              "--delay": `${e.delay}s`,
              "--dur": `${e.dur}s`,
              "--drift": `${e.drift}px`,
              "--rise": `${e.rise}px`,
              "--op": e.op,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function LightBeams({ className }: { className?: string }) {
  const beams = [
    { left: "18%", width: 120, rot: "16deg", delay: "0s" },
    { left: "44%", width: 90, rot: "12deg", delay: "2.5s" },
    { left: "70%", width: 150, rot: "18deg", delay: "1.2s" },
  ];
  return (
    <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-[70%] overflow-hidden", className)} aria-hidden>
      {/* Bright "cloud gap" the rays break through */}
      <div
        className="absolute left-1/2 top-[-14%] h-[46%] w-[64%] -translate-x-1/2 blur-3xl"
        style={{ background: "radial-gradient(ellipse 60% 50% at 50% 30%, rgba(255,255,255,0.28), rgba(255,250,240,0.08) 45%, transparent 72%)", mixBlendMode: "screen" }}
      />
      {beams.map((b, i) => (
        <span
          key={i}
          className="rw-beam"
          style={
            {
              left: b.left,
              width: b.width,
              top: "-20%",
              height: "140%",
              animationDelay: b.delay,
              "--rot": b.rot,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
