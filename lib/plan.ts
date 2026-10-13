export type PlanEvent = { time: string; end: string; title: string; place?: string };

export type PlanItem =
  | { kind: "event"; start: number; end: number; title: string; place: string; past: boolean; now: boolean }
  | { kind: "free"; start: number; end: number; task: string | null; past: boolean; now: boolean };

export type Plan = { items: PlanItem[]; allDay: string[]; unplaced: number; free: number };

type Options = { from?: number; to?: number; minGap?: number; block?: number; fallback?: number };

export function toMinutes(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  return minutes <= 1440 ? minutes : null;
}

export function clockText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function buildPlan(events: PlanEvent[], tasks: string[], now: number, options: Options = {}): Plan {
  const { from = 7 * 60, to = 22 * 60, minGap = 30, block = 45, fallback = 60 } = options;
  const allDay: string[] = [];
  const timed: { start: number; end: number; title: string; place: string }[] = [];
  for (const e of events) {
    const start = toMinutes(e.time);
    if (start === null) {
      allDay.push(e.title);
      continue;
    }
    const end = toMinutes(e.end);
    timed.push({ start, end: end !== null && end > start ? end : Math.min(1440, start + fallback), title: e.title, place: e.place ?? "" });
  }
  timed.sort((a, b) => a.start - b.start || a.end - b.end);

  const items: PlanItem[] = timed.map((e) => ({ kind: "event", start: e.start, end: e.end, title: e.title, place: e.place, past: e.end <= now, now: e.start <= now && now < e.end }));

  const queue = [...tasks];
  let free = 0;
  const addGap = (start: number, end: number) => {
    let s = Math.max(start, now);
    if (end - s < minGap) return;
    free += end - s;
    while (s + minGap <= end && queue.length > 0) {
      let e = Math.min(end, s + block);
      if (end - e < minGap) e = end;
      items.push({ kind: "free", start: s, end: e, task: queue.shift() ?? null, past: false, now: s <= now && now < e });
      s = e;
    }
    if (end - s >= minGap) items.push({ kind: "free", start: s, end, task: null, past: false, now: s <= now && now < end });
  };

  let cursor = from;
  const dayEnd = Math.max(to, timed.reduce((m, e) => Math.max(m, e.end), 0));
  for (const e of timed) {
    if (e.start > cursor) addGap(cursor, e.start);
    cursor = Math.max(cursor, e.end);
  }
  if (dayEnd > cursor) addGap(cursor, dayEnd);

  items.sort((a, b) => a.start - b.start || (a.kind === "event" ? -1 : 1));
  return { items, allDay, unplaced: queue.length, free };
}

export function durationText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
}
