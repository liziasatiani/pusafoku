"use client";

import { useEffect, useRef } from "react";
import styles from "./intro.module.css";

type Props = { onDone: () => void };

type Dot = { hx: number; hy: number; x: number; y: number; vx: number; vy: number; li: number; sd: number; fall: number };
type Stream = { x: number; head: number; speed: number; len: number };

const WORD = "PUSAFOKU";
const ASSEMBLE_AT = 1.0;
const HOLD_UNTIL = 3.7;
const FADE_LENGTH = 0.9;
const END_AT = HOLD_UNTIL + FADE_LENGTH + 0.1;
const MONO = "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace";
const TONES: [number, number, number][] = [
  [70, 255, 170],
  [225, 255, 240],
  [120, 240, 255],
];

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function bitAt(a: number, b: number, tick: number): number {
  return (Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(tick, 83492791)) >>> 31;
}

function makeSprites(cell: number, dpr: number): HTMLCanvasElement[][] {
  const px = Math.ceil(cell * dpr);
  return [0, 1].map((bit) =>
    TONES.map((tone) => {
      const c = document.createElement("canvas");
      c.width = px;
      c.height = px;
      const g = c.getContext("2d");
      if (g) {
        g.fillStyle = `rgb(${tone[0]},${tone[1]},${tone[2]})`;
        g.font = `700 ${px * 0.95}px ${MONO}`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(String(bit), px / 2, px / 2 + px * 0.04);
      }
      return c;
    }),
  );
}

export default function NameIntro({ onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);

  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let cell = 14;
    let glyph = 8;
    let dots: Dot[] = [];
    let streams: Stream[] = [];
    let rainSprites: HTMLCanvasElement[][] = [];
    let wordSprites: HTMLCanvasElement[][] = [];
    let fontSize = 0;
    let start = performance.now();
    let raf = 0;
    let finished = false;
    let cancelled = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      doneRef.current();
    };

    const build = async () => {
      const family = getComputedStyle(canvas).getPropertyValue("--font-display").trim() || "system-ui, sans-serif";
      await document.fonts.load(`800 100px ${family}`).catch(() => undefined);
      if (cancelled) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const off = document.createElement("canvas");
      off.width = Math.round(width);
      off.height = Math.round(height);
      const o = off.getContext("2d");
      if (!o) return;
      o.textBaseline = "middle";
      o.fillStyle = "#000";
      o.font = `800 100px ${family}`;
      const chars = [...WORD];
      const w100 = chars.map((c) => o.measureText(c).width / 100);
      const gap100 = 0.05;
      const rows = width < 640 ? [[0, 1, 2, 3], [4, 5, 6, 7]] : [[0, 1, 2, 3, 4, 5, 6, 7]];
      const rowWidth = (row: number[]) => row.reduce((sum, i) => sum + w100[i], 0) + gap100 * (row.length - 1);
      const widest = Math.max(...rows.map(rowWidth));
      fontSize = Math.min((width * 0.9) / widest, height * (rows.length > 1 ? 0.2 : 0.34));
      o.font = `800 ${fontSize}px ${family}`;
      const bounds: { x0: number; x1: number; cy: number }[] = [];
      rows.forEach((row, ri) => {
        const cy = rows.length > 1 ? height * (0.4 + ri * 0.24) : height * 0.47;
        let x = (width - rowWidth(row) * fontSize) / 2;
        row.forEach((i) => {
          const w = w100[i] * fontSize;
          o.fillText(chars[i], x, cy);
          bounds[i] = { x0: x, x1: x + w, cy };
          x += w + gap100 * fontSize;
        });
      });
      const data = o.getImageData(0, 0, off.width, off.height).data;
      const step = Math.max(7, Math.round(fontSize / 20));
      glyph = step * 1.18;
      cell = Math.max(13, Math.round(step * 1.5));
      rainSprites = makeSprites(cell, dpr);
      wordSprites = makeSprites(glyph, dpr);
      const rand = seeded(23);
      const cols = Math.ceil(width / cell);
      streams = Array.from({ length: cols }, (_, c) => ({ x: c * cell + cell / 2, head: -rand() * height, speed: 150 + rand() * 300, len: 9 + Math.floor(rand() * 18) }));
      const next: Dot[] = [];
      for (let y = 0; y < off.height; y += step) {
        for (let x = 0; x < off.width; x += step) {
          if (data[(y * off.width + x) * 4 + 3] <= 128) continue;
          let li = 0;
          let best = Infinity;
          bounds.forEach((b, k) => {
            if (x >= b.x0 - 2 && x <= b.x1 + 2 && Math.abs(y - b.cy) < best) {
              best = Math.abs(y - b.cy);
              li = k;
            }
          });
          next.push({
            hx: x,
            hy: y,
            x: reduced ? x : Math.floor(rand() * cols) * cell + cell / 2,
            y: reduced ? y : -rand() * height * 0.9,
            vx: 0,
            vy: 0,
            li,
            sd: rand() * 1000,
            fall: 160 + rand() * 260,
          });
        }
      }
      dots = next;
      start = performance.now();
      if (reduced) start -= 3000;
    };

    const skip = () => {
      const t = (performance.now() - start) / 1000;
      if (t < HOLD_UNTIL) start -= (HOLD_UNTIL - t) * 1000;
    };
    overlay.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", skip);

    let last = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!dots.length) return;
      const t = (now - start) / 1000;
      const fadeP = t >= HOLD_UNTIL ? Math.min(1, (t - HOLD_UNTIL) / FADE_LENGTH) : 0;
      overlay.style.opacity = String(1 - fadeP * fadeP);
      if (t >= END_AT) {
        cancelAnimationFrame(raf);
        finish();
        return;
      }
      ctx.clearRect(0, 0, width, height);
      const tick = Math.floor(t * 5);
      const rainA = reduced ? 0 : t < 1.1 ? 1 : Math.max(0.16, 1 - (t - 1.1) * 0.9);

      if (rainA > 0) {
        for (let c = 0; c < streams.length; c++) {
          const s = streams[c];
          s.head += s.speed * dt;
          if (s.head - s.len * cell > height) {
            s.head = -Math.random() * 200;
            s.speed = 150 + Math.random() * 300;
          }
          for (let k = 0; k < s.len; k++) {
            const y = s.head - k * cell;
            if (y < -cell || y > height + cell) continue;
            const a = Math.pow(1 - k / s.len, 1.6) * rainA * (fadeP > 0 ? 1 - fadeP : 1);
            if (a < 0.02) continue;
            ctx.globalAlpha = a;
            const bit = bitAt(c, Math.floor(y / cell), tick);
            ctx.drawImage(rainSprites[bit][k === 0 ? 1 : 0], s.x - cell / 2, y - cell / 2, cell, cell);
          }
        }
      }

      const damp = Math.exp(-dt * 8);
      const sweep = reduced ? -9999 : width * ((t - 2.35) / 1.1) - width * 0.1;
      for (const d of dots) {
        const arrive = ASSEMBLE_AT + d.li * 0.09;
        const settled = t >= arrive;
        if (!reduced) {
          if (!settled) {
            d.y += d.fall * dt;
            if (d.y > height + cell) d.y = -cell;
          } else if (fadeP > 0) {
            const e = fadeP * fadeP;
            d.vy += (d.hy + e * height * 1.1 - d.y) * 40 * dt;
            d.vx += (d.hx - d.x) * 40 * dt;
          } else {
            d.vx += (d.hx + Math.sin(t * 0.9 + d.sd) * 0.8 - d.x) * 70 * dt;
            d.vy += (d.hy + Math.cos(t * 1.1 + d.sd) * 0.8 - d.y) * 70 * dt;
          }
          if (settled) {
            d.vx *= damp;
            d.vy *= damp;
            d.x += d.vx * dt;
            d.y += d.vy * dt;
          }
        }
        const lit = Math.abs(d.hx - sweep) < fontSize * 0.45;
        const bit = settled && fadeP === 0 ? (Math.floor(t * 0.7 + d.sd) + Math.floor(d.sd)) & 1 : bitAt(Math.floor(d.sd), Math.floor(d.y / cell), tick);
        ctx.globalAlpha = (settled ? 0.95 : 0.55 * rainA) * (1 - fadeP);
        if (ctx.globalAlpha < 0.02) continue;
        ctx.drawImage(wordSprites[bit][lit ? 2 : settled ? 1 : 0], d.x - glyph / 2, d.y - glyph / 2, glyph, glyph);
      }
      ctx.globalAlpha = 1;
    };

    build().then(() => {
      if (cancelled) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    });
    const onResize = () => {
      void build();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      overlay.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div ref={overlayRef} className={styles.overlay} role="status" aria-label="Loading PUSAFOKU">
      <canvas ref={canvasRef} className={styles.canvas} />
      <p className={styles.sub}>&gt; private command center</p>
      <span className={styles.skip}>TAP TO SKIP</span>
    </div>
  );
}
