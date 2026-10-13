"use client";

import { useEffect, useRef } from "react";

export type CoreState = "idle" | "listening" | "speaking";

type Props = {
  state: CoreState;
  className?: string;
};

type Rgb = [number, number, number];
type Point = { lat: number; lon: number; land: boolean; seed: number };

const TAU = Math.PI * 2;
const TILT = 0.38;
const FACING = 0.9;
const SPEED: Record<CoreState, number> = { idle: 1, listening: 1.6, speaking: 1.4 };

function hash3(x: number, y: number, z: number, s: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1103515245) + s) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function valueNoise(x: number, y: number, z: number, s: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const zf = smooth(z - zi);
  const h = (a: number, b: number, c: number) => hash3(xi + a, yi + b, zi + c, s);
  return lerp(
    lerp(lerp(h(0, 0, 0), h(1, 0, 0), xf), lerp(h(0, 1, 0), h(1, 1, 0), xf), yf),
    lerp(lerp(h(0, 0, 1), h(1, 0, 1), xf), lerp(h(0, 1, 1), h(1, 1, 1), xf), yf),
    zf,
  );
}

function fbm(x: number, y: number, z: number): number {
  let amp = 0.5;
  let freq = 1;
  let total = 0;
  let norm = 0;
  for (let i = 0; i < 5; i++) {
    total += amp * valueNoise(x * freq, y * freq, z * freq, 11);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return total / norm;
}

function isLand(lat: number, lon: number): boolean {
  return fbm(Math.cos(lat) * Math.cos(lon) * 1.8 + 3, Math.sin(lat) * 1.8 + 1, Math.cos(lat) * Math.sin(lon) * 1.8 + 5) > 0.53;
}

function buildPoints(): Point[] {
  const points: Point[] = [];
  const rows = 46;
  for (let r = 0; r < rows; r++) {
    const lat = ((r + 0.5) / rows) * Math.PI - Math.PI / 2;
    const count = Math.max(4, Math.round(108 * Math.cos(lat)));
    for (let k = 0; k < count; k++) {
      const lon = (k + (r % 2) * 0.5) / count * TAU;
      points.push({ lat, lon, land: isLand(lat, lon), seed: hash3(k, r, 3, 5) });
    }
  }
  return points;
}

function parseColor(value: string, fallback: Rgb): Rgb {
  const hex = value.trim().replace("#", "");
  if (hex.length !== 6) return fallback;
  const n = Number.parseInt(hex, 16);
  if (Number.isNaN(n)) return fallback;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

function glyph(rgb: Rgb, bit: number, px: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const g = canvas.getContext("2d");
  if (g) {
    g.fillStyle = `rgb(${Math.round(rgb[0])},${Math.round(rgb[1])},${Math.round(rgb[2])})`;
    g.font = `700 ${px * 0.95}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(String(bit), px / 2, px / 2 + px * 0.04);
  }
  return canvas;
}

type Look = { sprites: HTMLCanvasElement[][]; glow: string; line: string; dark: boolean };

function readLook(px: number): Look {
  const css = getComputedStyle(document.documentElement);
  const dark = css.colorScheme.includes("dark");
  const glow = parseColor(css.getPropertyValue("--glow"), [93, 255, 176]);
  const accent = parseColor(css.getPropertyValue("--accent"), [31, 191, 122]);
  const bg = parseColor(css.getPropertyValue("--bg"), [5, 9, 7]);
  const hi: Rgb = dark ? mix(glow, [255, 255, 255], 0.6) : mix(glow, [0, 0, 0], 0.25);
  const mid: Rgb = glow;
  const low: Rgb = mix(accent, bg, dark ? 0.5 : 0.15);
  const tones = [hi, mid, low];
  return {
    sprites: tones.map((rgb) => [0, 1].map((bit) => glyph(rgb, bit, px))),
    glow: `${Math.round(glow[0])},${Math.round(glow[1])},${Math.round(glow[2])}`,
    line: `${Math.round(accent[0])},${Math.round(accent[1])},${Math.round(accent[2])}`,
    dark,
  };
}

export default function DigitGlobe({ state, className }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<CoreState>(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const points = buildPoints();
    const start = performance.now();
    let width = 0;
    let height = 0;
    let radius = 0;
    let cx = 0;
    let cy = 0;
    let cell = 10;
    let dpr = 1;
    let look: Look | null = null;
    let lookKey = "";
    let visible = true;
    let raf = 0;
    let clock = 0;
    let last = start;

    const fit = () => {
      const rect = wrap.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      radius = Math.min(width, height) * 0.4;
      cx = width / 2;
      cy = height / 2;
      cell = Math.max(8, radius * 0.052);
      look = null;
    };

    const project = (lat: number, lon: number, rot: number): [number, number, number] => {
      const x = Math.cos(lat) * Math.sin(lon + rot);
      const y = Math.sin(lat);
      const z = Math.cos(lat) * Math.cos(lon + rot);
      const y2 = y * Math.cos(TILT) - z * Math.sin(TILT);
      const z2 = y * Math.sin(TILT) + z * Math.cos(TILT);
      return [cx + x * radius, cy - y2 * radius, z2];
    };

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (!visible || !width) return;
      const css = getComputedStyle(document.documentElement);
      const key = `${css.getPropertyValue("--glow")}|${css.colorScheme}`;
      if (!look || key !== lookKey) {
        look = readLook(Math.ceil(cell * 1.4 * dpr));
        lookKey = key;
      }
      const dt = (now - last) / 1000;
      last = now;
      clock += dt * (reduced ? 0.15 : SPEED[stateRef.current]);
      const rot = -FACING + Math.sin(clock * 0.22) * 0.55;
      const tick = Math.floor(clock * 1.2);
      const { sprites, dark } = look;
      ctx.clearRect(0, 0, width, height);

      const halo = ctx.createRadialGradient(cx, cy, radius * 0.6, cx, cy, radius * 1.35);
      halo.addColorStop(0, `rgba(${look.glow},${dark ? 0.1 : 0.08})`);
      halo.addColorStop(1, `rgba(${look.glow},0)`);
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, width, height);

      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${look.line},0.22)`;
      for (let a = -60; a <= 60; a += 30) {
        ctx.beginPath();
        let on = false;
        for (let k = 0; k <= 90; k++) {
          const p = project((a * Math.PI) / 180, (k / 90) * TAU, rot);
          if (p[2] < 0) {
            on = false;
            continue;
          }
          if (on) ctx.lineTo(p[0], p[1]);
          else ctx.moveTo(p[0], p[1]);
          on = true;
        }
        ctx.stroke();
      }
      ctx.strokeStyle = `rgba(${look.line},0.5)`;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.06, 0, TAU);
      ctx.stroke();
      for (let d = 0; d < 72; d++) {
        const a = (d / 72) * TAU;
        const r1 = radius * 1.06;
        const r2 = radius * (d % 6 ? 1.09 : 1.13);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
        ctx.stroke();
      }

      for (const p of points) {
        const q = project(p.lat, p.lon, rot);
        if (q[2] < -0.02) continue;
        const flip = Math.floor(p.seed * 997 + tick * (p.land ? 0.7 : 0.3)) % (p.land ? 6 : 7) === 0;
        const bit = p.land ? (flip ? 0 : 1) : flip ? 1 : 0;
        const size = cell * (0.6 + 0.5 * Math.max(0, q[2]));
        ctx.globalAlpha = p.land ? 0.3 + 0.7 * Math.max(0, q[2]) : (dark ? 0.12 : 0.2) + 0.34 * Math.max(0, q[2]);
        ctx.drawImage(sprites[p.land ? (q[2] > 0.55 ? 0 : 1) : 2][bit], q[0] - size / 2, q[1] - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
    };

    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
    });
    io.observe(wrap);
    fit();
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <div ref={wrapRef} className={className} style={{ position: "absolute", inset: 0 }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} aria-hidden="true" />
    </div>
  );
}
