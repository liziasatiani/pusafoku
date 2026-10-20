import "server-only";
import { DEFAULT_SETTINGS } from "@/lib/defaults";
import { DbUnavailable, rest } from "@/lib/server/db";
import { calendarUrl, googleConfig } from "@/lib/env";
import { ago, readFeed, type Headline } from "@/lib/server/feeds";
import { RUNNABLE, arrange, counts, type AgentInfo } from "@/lib/agents";
import { GoogleDenied, readMailbox } from "@/lib/server/gmail";
import { eventsForDay, ownEventsToIcs } from "@/lib/server/ics";
import { fetchPublicText } from "@/lib/server/safe-fetch";
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
  let json: {
    current: { temperature_2m: number; apparent_temperature: number; weather_code: number; wind_speed_10m: number };
    daily: { temperature_2m_max: number[]; temperature_2m_min: number[] };
  };
  try {
    json = await res.json();
  } catch {
    return { status: "error", message: "The weather service sent an unreadable answer. Try again in a minute." };
  }
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

const CALENDAR_TTL_MS = 5 * 60 * 1000;
const CALENDAR_MAX_BYTES = 5_000_000;
const calendarCache = new Map<string, { at: number; text: string | null }>();

type EventRow = { id: string; title: string; day: string; start_time: string | null; end_time: string | null; repeat: string; place: string; until: string | null; skip: string[] };
type SourceRow = { id: string; label: string; url: string };

async function sourceText(url: string): Promise<string | null> {
  const hit = calendarCache.get(url);
  if (hit && Date.now() - hit.at < CALENDAR_TTL_MS) return hit.text;
  const text = await fetchPublicText(url, CALENDAR_MAX_BYTES);
  calendarCache.set(url, { at: Date.now(), text });
  return text;
}

async function calendar(): Promise<ModuleResult<unknown>> {
  let rows: EventRow[] = [];
  let sources: SourceRow[] = [];
  let dbReady = true;
  try {
    [rows, sources] = await Promise.all([
      rest<EventRow[]>("events?select=id,title,day,start_time,end_time,repeat,place,until,skip&order=day.asc&limit=500"),
      rest<SourceRow[]>("calendar_sources?select=id,label,url&active=eq.true&order=created_at.asc&limit=5"),
    ]);
  } catch (error) {
    if (!(error instanceof DbUnavailable)) throw error;
    dbReady = false;
  }
  const extra = calendarUrl();
  const urls = [...sources.map((s) => s.url), ...(extra ? [extra] : [])];
  if (!dbReady && urls.length === 0) return notConnected("Connect the database to keep your own calendar, or connect a calendar address.");
  const p = await place();
  const texts = await Promise.all(urls.map(sourceText));
  const combined = [ownEventsToIcs(rows, p.time_zone), ...texts.filter((t): t is string => t !== null)].join("\r\n");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: p.time_zone }).format(new Date());
  return ok({
    events: eventsForDay(combined, Date.now(), p.time_zone).map((e) => ({ time: e.time, end: e.end, title: e.title, place: e.place })),
    mine: rows.filter((r) => (r.repeat !== "none" && (r.until === null || r.until >= today)) || (r.repeat === "none" && r.day >= today)).slice(0, 30).map((r) => ({ id: r.id, title: r.title, day: r.day, start: r.start_time?.slice(0, 5) ?? null, repeat: r.repeat, place: r.place, until: r.until, hidden: r.skip.length })),
    sources: sources.map((s) => ({ id: s.id, label: s.label })),
    failed: texts.filter((t) => t === null).length,
    editable: dbReady,
  });
}

async function messages(): Promise<ModuleResult<unknown>> {
  if (!googleConfig()) return notConnected("Connect your Google account to see unread email.");
  let box;
  try {
    box = await readMailbox();
  } catch (error) {
    return { status: "error", message: error instanceof GoogleDenied ? `Google refused the sign-in (${error.message})` : "Could not read Gmail" };
  }
  const p = await place();
  const day = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: p.time_zone }).format(new Date(iso));
  const label = (iso: string) =>
    day(iso) === day(new Date().toISOString())
      ? new Intl.DateTimeFormat("en-GB", { timeZone: p.time_zone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso))
      : new Intl.DateTimeFormat("en-GB", { timeZone: p.time_zone, day: "2-digit", month: "2-digit" }).format(new Date(iso));
  return ok({ unread: box.unread, items: box.items.map((m) => ({ id: m.id, sender: m.sender, subject: m.subject, at: label(m.at) })) });
}

type PlaceRow = { id: string; name: string; latitude: number; longitude: number };

async function map(): Promise<ModuleResult<unknown>> {
  const p = await place();
  let pins: PlaceRow[] = [];
  let editable = true;
  try {
    pins = await rest<PlaceRow[]>("places?select=id,name,latitude,longitude&order=created_at.asc&limit=100");
  } catch (error) {
    if (!(error instanceof DbUnavailable)) throw error;
    editable = false;
  }
  return ok({ home: { name: p.city, latitude: p.latitude, longitude: p.longitude }, places: pins, editable });
}

async function today(): Promise<ModuleResult<unknown>> {
  const p = await place();
  const safe = (load: () => Promise<ModuleResult<unknown>>) => load().catch((): ModuleResult<unknown> => ({ status: "error", message: "unavailable" }));
  const [cal, sky, todo, mail] = await Promise.all([safe(calendar), safe(weather), safe(tasks), safe(messages)]);
  const pick = <T,>(r: ModuleResult<unknown>): T | null => (r.status === "ok" ? (r.data as T) : null);
  const events = pick<{ events: { time: string; end: string; title: string; place: string }[] }>(cal);
  const list = pick<{ tasks: { id: string; title: string; done: boolean }[] }>(todo);
  const air = pick<{ condition: string; tempC: number; highC: number; lowC: number }>(sky);
  const inbox = pick<{ unread: number }>(mail);
  return ok({
    timeZone: p.time_zone,
    events: events ? events.events : null,
    tasks: list ? list.tasks : null,
    weather: air ? { condition: air.condition, tempC: air.tempC, highC: air.highC, lowC: air.lowC } : null,
    unread: inbox ? inbox.unread : null,
    editable: list !== null,
  });
}

type AgentRow = { slug: string; name: string; project: string; role: string; parent_slug: string | null; status: AgentInfo["status"]; task: string };
type AgentMessageRow = { from_slug: string; to_slug: string; kind: string; body: string; created_at: string };

async function agents(): Promise<ModuleResult<unknown>> {
  let rows: AgentRow[];
  let messages: AgentMessageRow[];
  try {
    [rows, messages] = await Promise.all([
      rest<AgentRow[]>("agents?select=slug,name,project,role,parent_slug,status,task&order=created_at.asc&limit=100"),
      rest<AgentMessageRow[]>("agent_messages?select=from_slug,to_slug,kind,body,created_at&order=created_at.desc&limit=6"),
    ]);
  } catch (error) {
    if (error instanceof DbUnavailable) throw error;
    return notConnected("The agent tables are not set up yet.");
  }
  const list: AgentInfo[] = rows.map((r) => ({ slug: r.slug, name: r.name, project: r.project, role: r.role, parent: r.parent_slug, status: r.status, task: r.task }));
  const now = Date.now();
  const names = new Map(list.map((a) => [a.slug, a.name]));
  return ok({
    tree: arrange(list).map((n) => ({ ...n.agent, depth: n.depth, runnable: RUNNABLE.includes(n.agent.slug) })),
    counts: counts(list),
    messages: messages.map((m) => ({ from: names.get(m.from_slug) ?? m.from_slug, to: names.get(m.to_slug) ?? m.to_slug, kind: m.kind, body: m.body, ago: ago(Date.parse(m.created_at), now) })),
  });
}

const FETCHERS: Record<string, () => Promise<ModuleResult<unknown>>> = { weather, tasks, notes, monitor, rss, inbox, calendar, messages, map, today, agents };
const NEEDS_DB = new Set(["tasks", "notes", "monitor", "rss", "inbox", "agents"]);

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
