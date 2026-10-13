"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type Ref, type WheelEvent } from "react";
import { decodeCountries, type Country, type Topology } from "@/lib/geo/topo";
import { MAX_ZOOM, baseScale, clampView, gridStep, panBy, project, unproject, zoomAt, type View } from "@/lib/geo/view";
import { nightPolygon, subsolar } from "@/lib/geo/sun";
import { useTr } from "./lang";
import styles from "./map.module.css";

export type Pin = { id?: string; name: string; latitude: number; longitude: number };

export type MapHandle = { flyTo: (latitude: number, longitude: number, zoom?: number) => void };

type Props = { home: Pin; pins: Pin[]; handle?: Ref<MapHandle> };

const START: View = { lon: 0, lat: 15, k: 1 };

function palette() {
  const css = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return { bg: read("--panel-solid", "#08120e"), line: read("--line", "#2a6b50"), ink: read("--ink", "#d3f3e2"), muted: read("--muted", "#78a08c"), glow: read("--glow", "#5dffb0") };
}

const unwrapped = new WeakMap<Float32Array, Float32Array | null>();

function unwrap(ring: Float32Array): Float32Array | null {
  const known = unwrapped.get(ring);
  if (known !== undefined) return known;
  let shift = 0;
  let jumped = false;
  const out = new Float32Array(ring.length);
  for (let i = 0; i < ring.length; i += 2) {
    if (i > 0) {
      const delta = ring[i] - ring[i - 2];
      if (delta > 180) {
        shift -= 360;
        jumped = true;
      } else if (delta < -180) {
        shift += 360;
        jumped = true;
      }
    }
    out[i] = ring[i] + shift;
    out[i + 1] = ring[i + 1];
  }
  const result = jumped ? out : null;
  unwrapped.set(ring, result);
  return result;
}

function format(value: number, positive: string, negative: string): string {
  return `${Math.abs(value).toFixed(2)}° ${value >= 0 ? positive : negative}`;
}

export default function WorldMap({ home, pins, handle }: Props) {
  const tr = useTr();
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const size = useRef({ width: 0, height: 0 });
  const view = useRef<View>(START);
  const countries = useRef<Country[]>([]);
  const frame = useRef(0);
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ moved: 0, distance: 0 });
  const fly = useRef(0);
  const [ready, setReady] = useState(false);
  const [readout, setReadout] = useState({ lon: START.lon, lat: START.lat, k: START.k });
  const [picked, setPicked] = useState<Pin | null>(null);

  const draw = useCallback(() => {
    frame.current = 0;
    const el = canvas.current;
    const { width, height } = size.current;
    if (!el || width === 0 || height === 0) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const colors = palette();
    const v = view.current;
    const at = (lon: number, lat: number) => project(v, width, height, lon, lat);
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, width, height);

    const [west, north] = unproject(v, width, height, 0, 0);
    const [east, south] = unproject(v, width, height, width, height);

    const [left, top] = at(-180, 90);
    const [right, bottom] = at(180, -90);
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, right - left, bottom - top);
    ctx.clip();

    ctx.lineWidth = 1;
    ctx.strokeStyle = colors.line;
    ctx.globalAlpha = 0.35;
    const step = gridStep(v.k);
    ctx.beginPath();
    for (let lon = Math.ceil(west / step) * step; lon <= east; lon += step) {
      const [x] = at(lon, 0);
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let lat = Math.ceil(south / step) * step; lat <= north; lat += step) {
      const [, y] = at(0, lat);
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = colors.glow;
    ctx.strokeStyle = colors.glow;
    for (const country of countries.current) {
      if (country.east < west || country.west > east || country.south > north || country.north < south) continue;
      ctx.beginPath();
      for (const rings of country.polygons) {
        for (const ring of rings) {
          const wrapped = unwrap(ring);
          const points = wrapped ?? ring;
          for (const shift of wrapped ? [0, -360, 360] : [0]) {
            for (let i = 0; i < points.length; i += 2) {
              const [x, y] = at(points[i] + shift, points[i + 1]);
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.closePath();
          }
        }
      }
      ctx.globalAlpha = 0.12;
      ctx.fill("evenodd");
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const night = nightPolygon(Date.now());
    ctx.beginPath();
    night.forEach(([lon, lat], i) => {
      const [x, y] = at(lon, lat);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = "#000";
    ctx.globalAlpha = 0.32;
    ctx.fill();
    ctx.globalAlpha = 1;

    const sun = subsolar(Date.now());
    const [sx, sy] = at(sun.lon, sun.lat);
    ctx.fillStyle = colors.glow;
    ctx.beginPath();
    ctx.arc(sx, sy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.font = '10px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
    ctx.fillStyle = colors.muted;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    const pixels = step * baseScale(width, height) * v.k;
    const stride = Math.max(1, Math.ceil(52 / Math.max(1, pixels)));
    for (let lon = Math.ceil(west / step) * step; lon <= east; lon += step) {
      if (lon < -180 || lon > 180 || Math.round(lon / step) % stride !== 0) continue;
      const [x] = at(lon, 0);
      ctx.fillText(`${Math.abs(lon)}°${lon < 0 ? "W" : lon > 0 ? "E" : ""}`, Math.max(left, x) + 3, Math.max(top, 0) + 3);
    }
    ctx.textBaseline = "bottom";
    for (let lat = Math.ceil(south / step) * step; lat <= north; lat += step) {
      if (lat < -90 || lat > 90 || Math.round(lat / step) % stride !== 0) continue;
      const [, y] = at(0, lat);
      ctx.fillText(`${Math.abs(lat)}°${lat < 0 ? "S" : lat > 0 ? "N" : ""}`, Math.max(left, 0) + 3, y - 2);
    }

    const mark = (pin: Pin, color: string, label: boolean) => {
      const [x, y] = at(pin.longitude, pin.latitude);
      if (x < -20 || y < -20 || x > width + 20 || y > height + 20) return;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.moveTo(x - 11, y);
      ctx.lineTo(x - 3, y);
      ctx.moveTo(x + 3, y);
      ctx.lineTo(x + 11, y);
      ctx.moveTo(x, y - 11);
      ctx.lineTo(x, y - 3);
      ctx.moveTo(x, y + 3);
      ctx.lineTo(x, y + 11);
      ctx.stroke();
      if (label) {
        ctx.font = '11px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
        ctx.textBaseline = "middle";
        ctx.fillStyle = colors.ink;
        const flip = x > width - 120;
        ctx.textAlign = flip ? "right" : "left";
        ctx.fillText(pin.name, flip ? x - 14 : x + 14, y);
      }
    };
    pins.forEach((pin) => mark(pin, colors.glow, true));
    mark(home, colors.ink, true);
    if (picked) mark(picked, colors.glow, true);
  }, [home, pins, picked]);

  const schedule = useCallback(() => {
    if (frame.current === 0) frame.current = requestAnimationFrame(draw);
  }, [draw]);

  const commit = useCallback(
    (next: View) => {
      view.current = next;
      setReadout({ lon: next.lon, lat: next.lat, k: next.k });
      schedule();
    },
    [schedule],
  );

  const flyTo = useCallback(
    (latitude: number, longitude: number, zoom = 8) => {
      cancelAnimationFrame(fly.current);
      const { width, height } = size.current;
      const from = view.current;
      const to = clampView({ lon: longitude, lat: latitude, k: zoom }, width, height);
      const started = performance.now();
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const tick = (now: number) => {
        const t = reduce ? 1 : Math.min(1, (now - started) / 700);
        const e = 1 - Math.pow(1 - t, 3);
        commit({ lon: from.lon + (to.lon - from.lon) * e, lat: from.lat + (to.lat - from.lat) * e, k: from.k * Math.pow(to.k / from.k, e) });
        if (t < 1) fly.current = requestAnimationFrame(tick);
      };
      fly.current = requestAnimationFrame(tick);
    },
    [commit],
  );

  useImperativeHandle(handle, () => ({ flyTo }), [flyTo]);

  useEffect(() => {
    let alive = true;
    void import("@/lib/geo/countries-50m.json").then((mod) => {
      if (!alive) return;
      countries.current = decodeCountries(mod.default as unknown as Topology);
      setReady(true);
      schedule();
    });
    return () => {
      alive = false;
    };
  }, [schedule]);

  useEffect(() => {
    const host = box.current;
    const el = canvas.current;
    if (!host || !el) return;
    const fit = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      const ratio = window.devicePixelRatio || 1;
      size.current = { width, height };
      el.width = Math.round(width * ratio);
      el.height = Math.round(height * ratio);
      view.current = clampView(view.current, width, height);
      schedule();
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(host);
    const theme = new MutationObserver(schedule);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class", "style"] });
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", schedule);
    const clock = window.setInterval(schedule, 60_000);
    return () => {
      observer.disconnect();
      theme.disconnect();
      scheme.removeEventListener("change", schedule);
      window.clearInterval(clock);
      cancelAnimationFrame(frame.current);
      cancelAnimationFrame(fly.current);
    };
  }, [schedule]);

  useEffect(() => {
    schedule();
  }, [home, pins, picked, schedule]);

  function local(event: { clientX: number; clientY: number }) {
    const rect = canvas.current?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
  }

  function onWheel(event: WheelEvent) {
    const { x, y } = local(event);
    const { width, height } = size.current;
    commit(zoomAt(view.current, width, height, x, y, Math.exp(-event.deltaY * 0.0018)));
  }

  function onDown(event: PointerEvent) {
    canvas.current?.setPointerCapture(event.pointerId);
    cancelAnimationFrame(fly.current);
    touches.current.set(event.pointerId, local(event));
    gesture.current = { moved: 0, distance: 0 };
    if (touches.current.size === 2) {
      const [a, b] = [...touches.current.values()];
      gesture.current.distance = Math.hypot(a.x - b.x, a.y - b.y);
    }
  }

  function onMove(event: PointerEvent) {
    const { width, height } = size.current;
    const point = local(event);
    const before = touches.current.get(event.pointerId);
    if (!before) return;
    if (touches.current.size === 1) {
      gesture.current.moved += Math.abs(point.x - before.x) + Math.abs(point.y - before.y);
      touches.current.set(event.pointerId, point);
      commit(panBy(view.current, width, height, point.x - before.x, point.y - before.y));
      return;
    }
    touches.current.set(event.pointerId, point);
    const [a, b] = [...touches.current.values()];
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    gesture.current.moved += 10;
    if (gesture.current.distance > 0 && distance > 0) {
      commit(zoomAt(view.current, width, height, (a.x + b.x) / 2, (a.y + b.y) / 2, distance / gesture.current.distance));
    }
    gesture.current.distance = distance;
  }

  function onUp(event: PointerEvent) {
    const wasTap = touches.current.size === 1 && gesture.current.moved < 6;
    touches.current.delete(event.pointerId);
    if (!wasTap) return;
    const { x, y } = local(event);
    const { width, height } = size.current;
    let best: Pin | null = null;
    let bestDistance = 22;
    for (const pin of [...pins, home]) {
      const [px, py] = project(view.current, width, height, pin.longitude, pin.latitude);
      const distance = Math.hypot(px - x, py - y);
      if (distance < bestDistance) {
        best = pin;
        bestDistance = distance;
      }
    }
    if (best) {
      setPicked(best);
      return;
    }
    const [lon, lat] = unproject(view.current, width, height, x, y);
    setPicked({ name: `${format(lat, "N", "S")}, ${format(lon, "E", "W")}`, latitude: lat, longitude: lon });
  }

  function onDouble(event: MouseEvent) {
    const { x, y } = local(event);
    const { width, height } = size.current;
    commit(zoomAt(view.current, width, height, x, y, 2.2));
  }

  function zoomCenter(factor: number) {
    const { width, height } = size.current;
    commit(zoomAt(view.current, width, height, width / 2, height / 2, factor));
  }

  function onKey(event: KeyboardEvent) {
    const { width, height } = size.current;
    const move = 60;
    if (event.key === "ArrowLeft") commit(panBy(view.current, width, height, move, 0));
    else if (event.key === "ArrowRight") commit(panBy(view.current, width, height, -move, 0));
    else if (event.key === "ArrowUp") commit(panBy(view.current, width, height, 0, move));
    else if (event.key === "ArrowDown") commit(panBy(view.current, width, height, 0, -move));
    else if (event.key === "+" || event.key === "=") zoomCenter(1.5);
    else if (event.key === "-" || event.key === "_") zoomCenter(1 / 1.5);
    else if (event.key === "0") commit(clampView(START, width, height));
    else return;
    event.preventDefault();
  }

  return (
    <div className={styles.wrap}>
      <div ref={box} className={styles.stage}>
        <canvas
          ref={canvas}
          className={styles.canvas}
          tabIndex={0}
          role="application"
          aria-label={tr("World map. Drag to move, pinch or scroll to zoom, arrow keys and plus or minus on a keyboard.")}
          onWheel={onWheel}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onDoubleClick={onDouble}
          onKeyDown={onKey}
        />
        {ready ? null : <p className={styles.loading}>{tr("Loading the map...")}</p>}
        <div className={styles.zoom}>
          <button type="button" className={styles.zoomBtn} onClick={() => zoomCenter(1.6)} disabled={readout.k >= MAX_ZOOM} aria-label={tr("Zoom in")}>
            +
          </button>
          <button type="button" className={styles.zoomBtn} onClick={() => zoomCenter(1 / 1.6)} disabled={readout.k <= 1} aria-label={tr("Zoom out")}>
            −
          </button>
          <button type="button" className={styles.zoomBtn} onClick={() => flyTo(START.lat, START.lon, 1)} aria-label={tr("Reset the view")}>
            ⌂
          </button>
        </div>
      </div>
      <p className={styles.readout + " mono"}>
        <span>{format(readout.lat, "N", "S")}</span> <span>{format(readout.lon, "E", "W")}</span> <span>×{readout.k.toFixed(1)}</span>
      </p>
      {picked ? (
        <p className={styles.picked}>
          <strong>{picked.name}</strong> <span className="mono">{format(picked.latitude, "N", "S")}, {format(picked.longitude, "E", "W")}</span>
        </p>
      ) : null}
    </div>
  );
}
