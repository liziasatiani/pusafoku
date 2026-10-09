import "server-only";
import { DEFAULT_SETTINGS } from "@/lib/defaults";
import { DbUnavailable, rest } from "@/lib/server/db";
import { ago, readFeed, type Headline } from "@/lib/server/feeds";
import type { ModuleResult } from "@/modules/types";

type SettingsRow = { city: string; latitude: number; longitude: number; time_zone: string };
type TaskRow = { id: string; title: string; done: boolean };
type NoteRow = { id: string; body: string; created_at: string };

const WEATHER_CODES: Record<number, string> = {
  0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 80: "Showers", 81: "Showers", 82: "Heavy showers",
  95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm",
};

const TBILISI = { city: DEFAULT_SETTINGS.city, latitude: 41.7151, longitude: 44.8271, time_zone: DEFAULT_SETTINGS.timeZone };

function ok<T>(data: T): ModuleResult<T> {
  return { status: "ok", data, fetchedAt: new Date().toISOString() };
}

function notConnected(hint: string): ModuleResult<never> {
  return { status: "not_connected", hint };
}

async function place(): Promise<SettingsRow> {
  try {
    const rows = await rest<SettingsRow[]>("settings?select=city,latitude,longitude,time_zone&limit=1");
    return rows[0] ?? TBILISI;
  } catch {
    return TBILISI;
  }
}

async function weather(): Promise<ModuleResult<unknown>> {
  const p = await place();
  const params = new URLSearchParams({
    latitude: String(p.latitude),
    longitude: String(p.longitude),
    current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m",
    daily: "temperature_2m_max,temperature_2m_min",
    timezone: p.time_zone,
    forecast_days: "1",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { next: { revalidate: 600 } });
  if (!res.ok) return { status: "error", message: `Weather service answered ${res.status}` };
  const json = (await res.json()) as {
    current: { temperature_2m: number; apparent_temperature: number; weather_code: number; wind_speed_10m: number };
    daily: { temperature_2m_max: number[]; temperature_2m_min: number[] };
  };
  return ok({
    city: p.city,
    tempC: json.current.temperature_2m,
    feelsC: json.current.apparent_temperature,
    condition: WEATHER_CODES[json.current.weather_code] ?? "Unknown",
    highC: json.daily.temperature_2m_max[0],
    lowC: json.daily.temperature_2m_min[0],
    windKmh: json.current.wind_speed_10m,
  });
}

async function tasks(): Promise<ModuleResult<unknown>> {
  const rows = await rest<TaskRow[]>("tasks?select=id,title,done&order=done.asc,created_at.desc&limit=50");
  return ok({ tasks: rows.map((r) => ({ id: r.id, title: r.title, done: r.done })) });
}

function stamp(iso: string, timeZone: string): string {
  const date = new Date(iso);
  const sameDay = new Intl.DateTimeFormat("en-CA", { timeZone }).format(date) === new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
  return sameDay
    ? new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(date)
    : new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", day: "numeric", month: "short" }).format(date);
}

async function notes(): Promise<ModuleResult<unknown>> {
  const [rows, p] = await Promise.all([rest<NoteRow[]>("notes?select=id,body,created_at&order=created_at.desc&limit=30"), place()]);
  return ok({ notes: rows.map((r) => ({ id: r.id, text: r.body, at: stamp(r.created_at, p.time_zone) })) });
}

type SiteRow = { id: string; url: string; monitor_checks: { ok: boolean; ms: number | null; checked_at: string }[] };

async function monitor(): Promise<ModuleResult<unknown>> {
  const rows = await rest<SiteRow[]>("monitor_sites?select=id,url,monitor_checks(ok,ms,checked_at)&active=eq.true&order=created_at.asc&monitor_checks.order=checked_at.desc&monitor_checks.limit=1");
  return ok({
    sites: rows.map((r) => {
      const last = r.monitor_checks[0];
      return { id: r.id, url: r.url.replace(/^https:\/\//, "").replace(/\/$/, ""), ok: last ? last.ok : null, ms: last?.ms ?? 0, checkedAt: last?.checked_at ?? null };
    }),
  });
}

type FeedRow = { id: string; url: string; label: string };

const FEED_TTL_MS = 5 * 60 * 1000;
const feedCache = new Map<string, { at: number; items: Headline[] | null }>();

async function cachedFeed(url: string): Promise<Headline[] | null> {
  const hit = feedCache.get(url);
  if (hit && Date.now() - hit.at < FEED_TTL_MS) return hit.items;
  const items = await readFeed(url);
  feedCache.set(url, { at: Date.now(), items });
  return items;
}

async function rss(): Promise<ModuleResult<unknown>> {
  const feeds = await rest<FeedRow[]>("feeds?select=id,url,label&active=eq.true&order=created_at.asc&limit=10");
  const results = await Promise.all(feeds.map((f) => cachedFeed(f.url)));
  const now = Date.now();
  const items = results
    .flatMap((r) => (r ? r.slice(0, 5) : []))
    .sort((a, b) => (b.at ?? 0) - (a.at ?? 0))
    .slice(0, 12)
    .map((h) => ({ title: h.title, source: h.source, ago: ago(h.at, now), url: h.url }));
  return ok({ items, feeds: feeds.map((f) => ({ id: f.id, label: f.label })), failed: results.filter((r) => r === null).length });
}

type ApprovalRow = { id: string; title: string; source: string; draft: string };

async function inbox(): Promise<ModuleResult<unknown>> {
  const rows = await rest<ApprovalRow[]>("approvals?select=id,title,source,draft&status=eq.pending&order=created_at.asc&limit=20");
  return ok({ items: rows });
}

const FETCHERS: Record<string, () => Promise<ModuleResult<unknown>>> = { weather, tasks, notes, monitor, rss, inbox };
const NEEDS_DB = new Set(["tasks", "notes", "monitor", "rss", "inbox"]);

export async function loadModule(id: string): Promise<ModuleResult<unknown>> {
  const fetcher = FETCHERS[id];
  if (!fetcher) return notConnected("This panel is not wired up yet.");
  try {
    return await fetcher();
  } catch (error) {
    if (error instanceof DbUnavailable && NEEDS_DB.has(id)) return notConnected("Database is not connected yet.");
    return { status: "error", message: error instanceof Error ? error.message : "Something went wrong" };
  }
}
