import "server-only";
import { normalizeUrl } from "@/lib/server/monitor";

export function calendarAddress(input: string): string | null {
  const trimmed = input.trim().replace(/^webcal:\/\//i, "https://");
  const url = normalizeUrl(trimmed);
  return url && url.length <= 1000 ? url : null;
}

const REPEATS = ["none", "daily", "weekly", "monthly", "yearly"];

export type EventInput = { title: string; day: string; start_time: string | null; end_time: string | null; repeat: string; place: string; until: string | null };

export const MAX_SHIFT_WEEKS = 60;

export function shiftDay(day: string, weeks: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + weeks * 7 * 86400000).toISOString().slice(0, 10);
}

export function parseShift(body: unknown): number | null {
  if (typeof body !== "object" || body === null) return null;
  const { weeks } = body as Record<string, unknown>;
  return typeof weeks === "number" && Number.isInteger(weeks) && weeks >= 1 && weeks <= MAX_SHIFT_WEEKS ? weeks : null;
}

function validDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const date = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === day;
}

export function parseEvent(body: unknown): EventInput | null {
  if (typeof body !== "object" || body === null) return null;
  const { title, day, start, end, repeat, place, until } = body as Record<string, unknown>;
  if (typeof title !== "string" || title.trim().length < 1 || title.trim().length > 200) return null;
  if (typeof day !== "string" || !validDay(day)) return null;
  const time = (value: unknown): string | null | undefined => {
    if (value === undefined || value === null || value === "") return null;
    return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : undefined;
  };
  const startTime = time(start);
  const endTime = time(end);
  if (startTime === undefined || endTime === undefined) return null;
  if (endTime !== null && (startTime === null || endTime <= startTime)) return null;
  const repeatValue = repeat === undefined || repeat === "" ? "none" : repeat;
  if (typeof repeatValue !== "string" || !REPEATS.includes(repeatValue)) return null;
  const placeValue = place === undefined || place === null ? "" : place;
  if (typeof placeValue !== "string" || placeValue.trim().length > 80 || /[\u0000-\u001f]/.test(placeValue)) return null;
  const untilValue = until === undefined || until === null || until === "" ? null : until;
  if (untilValue !== null && (typeof untilValue !== "string" || !validDay(untilValue) || untilValue < day || repeatValue === "none")) return null;
  return { title: title.trim(), day, start_time: startTime, end_time: endTime, repeat: repeatValue, place: placeValue.trim(), until: untilValue };
}
