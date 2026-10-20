export const SLOTS = [
  { kind: "morning", hour: 8 },
  { kind: "midday", hour: 13 },
  { kind: "evening", hour: 20 },
] as const;

export type SlotKind = (typeof SLOTS)[number]["kind"];

export const DEFAULT_ZONE = "Asia/Tbilisi";

function zoneOffset(at: number, zone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(at));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - at;
}

export function localHour(at: number, zone: string): number {
  return Math.floor(((at + zoneOffset(at, zone)) % 86_400_000) / 3_600_000);
}

export function startOfLocalDay(at: number, zone: string): number {
  const local = at + zoneOffset(at, zone);
  const midnight = local - (local % 86_400_000);
  return midnight - zoneOffset(midnight, zone);
}

export function dueSlot(at: number, zone: string, done: readonly string[]): SlotKind | null {
  const hour = localHour(at, zone);
  const open = SLOTS.filter((s) => s.hour <= hour);
  const latest = open[open.length - 1];
  return latest && !done.includes(latest.kind) ? latest.kind : null;
}
