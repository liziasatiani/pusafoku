"use client";

import { useCallback, useEffect, useState } from "react";
import type { ModuleSize } from "@/modules/types";

export type TileLayout = { id: string; hidden: boolean; size: ModuleSize };

const KEY = "pusafoku.layout";
const SIZES: ModuleSize[] = ["S", "M", "L"];

function read(): TileLayout[] | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (t): t is TileLayout =>
        typeof t === "object" && t !== null && typeof (t as TileLayout).id === "string" && typeof (t as TileLayout).hidden === "boolean" && SIZES.includes((t as TileLayout).size),
    );
  } catch {
    return null;
  }
}

function write(layout: TileLayout[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(layout));
  } catch {
    return;
  }
}

function merge(defaults: TileLayout[], saved: TileLayout[] | null): TileLayout[] {
  if (!saved) return defaults;
  const known = new Map(defaults.map((t) => [t.id, t]));
  const kept = saved.filter((t) => known.has(t.id));
  const missing = defaults.filter((t) => !kept.some((k) => k.id === t.id));
  return [...kept, ...missing];
}

export function useLayout(defaults: TileLayout[]) {
  const [layout, setLayout] = useState<TileLayout[]>(defaults);

  useEffect(() => {
    setLayout(merge(defaults, read()));
  }, [defaults]);

  const update = useCallback((next: TileLayout[]) => {
    setLayout(next);
    write(next);
  }, []);

  const move = useCallback(
    (id: string, delta: -1 | 1) => {
      const index = layout.findIndex((t) => t.id === id);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= layout.length) return;
      const next = [...layout];
      [next[index], next[target]] = [next[target], next[index]];
      update(next);
    },
    [layout, update],
  );

  const resize = useCallback(
    (id: string) => {
      update(layout.map((t) => (t.id === id ? { ...t, size: SIZES[(SIZES.indexOf(t.size) + 1) % SIZES.length] } : t)));
    },
    [layout, update],
  );

  const toggle = useCallback(
    (id: string) => {
      update(layout.map((t) => (t.id === id ? { ...t, hidden: !t.hidden } : t)));
    },
    [layout, update],
  );

  const reset = useCallback(() => update(defaults), [defaults, update]);

  return { layout, move, resize, toggle, reset };
}
