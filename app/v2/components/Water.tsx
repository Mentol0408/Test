"use client";

/* =====================================================================
   Water3D — a real 3D water surface rendered with a WebGL fragment shader.

   Raw WebGL on purpose: three.js would add ~600KB for one effect. The
   shader raymarches nothing — it projects each pixel onto a perspective
   water plane, sums directional wave trains for height, derives a normal
   and lights it with the same sun direction as the hero bloom. Composited
   with `mix-blend-mode: screen`, so black = invisible and only crests,
   sheen and sun glitter add light on top of the lake in the photo.

   Degrades safely: no WebGL (or reduced motion) → one static frame or
   nothing at all, and the CSS caustics underneath still carry the scene.
   ===================================================================== */

import { useEffect, useRef, type CSSProperties } from "react";
import { cn } from "@/v2/lib/cn";

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform float uShore;   // screen height fraction where the water starts

/* Sum of directional wave trains — long swells first, chop last. */
float waveH(vec2 p, float t) {
  float h = 0.0;
  h += sin(dot(p, vec2( 0.90,  0.50)) * 1.10 + t * 1.00) * 0.55;
  h += sin(dot(p, vec2(-0.60,  0.90)) * 1.70 - t * 0.85) * 0.38;
  h += sin(dot(p, vec2( 0.40, -1.10)) * 2.60 + t * 1.40) * 0.23;
  h += sin(dot(p, vec2( 1.30,  0.20)) * 3.90 - t * 1.90) * 0.13;
  h += sin(dot(p, vec2(-0.90, -0.70)) * 6.20 + t * 2.45) * 0.07;
  return h;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;          // y up, 0 at the bottom

  /* Everything above the shore line stays untouched (black = no-op). */
  if (uv.y > uShore) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }

  /* Perspective: the plane recedes toward the shore line (the horizon). */
  float v     = (uShore - uv.y) / uShore;     // 0 at shore, 1 at bottom
  float depth = 1.0 / (v * v * 0.85 + 0.055); // far away near the horizon
  vec2  plane = vec2((uv.x - 0.5) * depth * 1.7, depth);

  float t = uTime;
  float h = waveH(plane, t);

  /* True slope: divide the forward difference by the step, or the normal
     barely tilts and no specular ever fires. */
  float e    = 0.05 + depth * 0.02;
  float dhdx = (waveH(plane + vec2(e, 0.0), t) - h) / e;
  float dhdy = (waveH(plane + vec2(0.0, e), t) - h) / e;
  vec3  n    = normalize(vec3(-dhdx * 1.5, 1.0, -dhdy * 1.5));

  /* Sun upper-right — matches the hero's warm bloom. */
  vec3 L = normalize(vec3( 0.62, 0.55, -0.56));
  vec3 V = normalize(vec3( 0.00, 0.85, -0.52));
  vec3 H = normalize(L + V);
  float ndh   = max(dot(n, H), 0.0);
  float sheen = pow(ndh, 22.0);    // broad shimmer
  float glint = pow(ndh, 110.0);   // sharp sun glitter

  /* Detail fades out toward the horizon so it reads as distance, not noise. */
  float near = smoothstep(0.00, 0.45, v);
  float edge = smoothstep(0.00, 0.13, v);     // soft blend at the shore

  /* Tropical turquoise body + white foam on the breaking crests. */
  float crest = smoothstep(0.30, 1.05, h);
  float foam  = smoothstep(0.86, 1.32, h) * near;

  vec3 aqua = vec3(0.24, 0.88, 0.90);         // turquoise, not northern blue
  vec3 warm = vec3(1.00, 0.86, 0.60);

  vec3 col = vec3(0.0);
  col += aqua * crest * 0.30 * near;
  col += mix(aqua, vec3(1.0), 0.72) * sheen * 0.60;
  col += warm * glint * 1.30;
  col += vec3(0.95, 1.00, 1.00) * foam * 0.55;
  col *= edge * (0.45 + 0.55 * near);

  /* Opaque black elsewhere: composited with screen blending, black is a no-op. */
  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export function Water3D({
  className,
  style,
  shore = 0.62,
  speed = 0.42,
}: {
  className?: string;
  style?: CSSProperties;
  /** Fraction of the canvas height the water occupies, measured from the bottom. */
  shore?: number;
  speed?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    // Opaque canvas: `mix-blend-mode: screen` makes black invisible, which
    // sidesteps premultiplied-alpha compositing entirely.
    const gl = (canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: "low-power",
    }) || canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return; // no WebGL → CSS caustics still carry the scene

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const prog = vs && fs ? gl.createProgram() : null;
    if (!vs || !fs || !prog) return;

    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    /* Fullscreen triangle */
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "uRes");
    const uTime = gl.getUniformLocation(prog, "uTime");
    const uShore = gl.getUniformLocation(prog, "uShore");
    gl.uniform1f(uShore, shore);

    function resize() {
      const c = ref.current;
      if (!c || !gl) return;
      // Cap DPR: this shader is fill-rate bound, and 2x buys nothing here.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      const w = Math.max(1, Math.round(c.clientWidth * dpr));
      const h = Math.max(1, Math.round(c.clientHeight * dpr));
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
      }
      gl.viewport(0, 0, c.width, c.height);
      gl.uniform2f(uRes, c.width, c.height);
    }

    function draw(tSeconds: number) {
      if (!gl) return;
      gl.uniform1f(uTime, tSeconds);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    resize();

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      draw(0); // one calm frame, no loop
      return () => {
        gl.deleteProgram(prog);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        gl.deleteBuffer(buf);
      };
    }

    let raf = 0;
    let visible = true;
    let start = 0;

    function frame(now: number) {
      if (!start) start = now;
      draw(((now - start) / 1000) * speed);
      raf = requestAnimationFrame(frame);
    }
    function play() {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
    }
    function pause() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    /* Only burn GPU while the hero is actually on screen. */
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        visible ? play() : pause();
      },
      { threshold: 0 },
    );
    io.observe(canvas);

    const onVisibility = () => (document.hidden ? pause() : play());
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", resize);
    play();

    return () => {
      pause();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", resize);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
    };
  }, [shore, speed]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
      style={{ mixBlendMode: "screen", ...style }}
    />
  );
}
