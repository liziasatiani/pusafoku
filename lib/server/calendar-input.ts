import "server-only";
import { normalizeUrl } from "@/lib/server/monitor";

export function calendarAddress(input: string): string | null {
  const trimmed = input.trim().replace(/^webcal:\/\//i, "https://");
  const url = normalizeUrl(trimmed);
  return url && url.length <= 1000 ? url : null;
}

const REPEATS = ["none", "daily", "weekly", "monthly", "yearly"];

export type EventInput = { title: string; day: string; start_time: string | null; end_time: string | null; repeat: string };

function validDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const date = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === day;
}

export function parseEvent(body: unknown): EventInput | null {
  if (typeof body !== "object" || body === null) return null;
  const { title, day, start, end, repeat } = body as Record<string, unknown>;
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
  return { title: title.trim(), day, start_time: startTime, end_time: endTime, repeat: repeatValue };
}
