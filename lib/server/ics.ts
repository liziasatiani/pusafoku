import "server-only";

export type DayEvent = { time: string; title: string; place: string; sort: number };

type Wall = { y: number; m: number; d: number; h: number; mi: number; s: number };
type Rule = { freq: string; interval: number; count: number | null; until: number | null; byDay: { n: number | null; dow: number }[]; byMonthDay: number[] };
type Raw = { title: string; place: string; start: Wall; end: Wall | null; allDay: boolean; tz: string; rule: Rule | null; exdates: number[] };

const DOW = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const MAX_EVENTS = 2000;

function offsetMs(instant: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const floored = Math.floor(instant / 1000) * 1000;
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - floored;
}

export function zonedToUtc(w: Wall, tz: string): number {
  const guess = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s);
  const first = guess - offsetMs(guess, tz);
  return guess - offsetMs(first, tz);
}

function unfold(text: string): string[] {
  return text.replace(/\r\n|\r/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function unescapeText(value: string): string {
  return value.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").replace(/\s+/g, " ").trim();
}

function parseDate(value: string, params: string, fallbackTz: string): { wall: Wall; allDay: boolean; tz: string } | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const wall: Wall = { y: +m[1], m: +m[2], d: +m[3], h: +(m[4] ?? 0), mi: +(m[5] ?? 0), s: +(m[6] ?? 0) };
  if (!m[4]) return { wall, allDay: true, tz: fallbackTz };
  if (m[7]) return { wall, allDay: false, tz: "UTC" };
  const tzid = params.match(/TZID=([^;:]+)/i)?.[1]?.replace(/"/g, "");
  return { wall, allDay: false, tz: tzid && validZone(tzid) ? tzid : fallbackTz };
}

function validZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function parseRule(value: string, fallbackTz: string): Rule | null {
  const map = new Map(value.split(";").map((p) => p.split("=") as [string, string]));
  const freq = map.get("FREQ");
  if (!freq || !["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) return null;
  const untilRaw = map.get("UNTIL");
  const untilParsed = untilRaw ? parseDate(untilRaw, "", fallbackTz) : null;
  const until = untilParsed ? (untilParsed.allDay ? Date.UTC(untilParsed.wall.y, untilParsed.wall.m - 1, untilParsed.wall.d, 23, 59, 59) : zonedToUtc(untilParsed.wall, untilParsed.tz)) : null;
  const byDay = (map.get("BYDAY") ?? "")
    .split(",")
    .map((token) => token.match(/^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/))
    .filter((x): x is RegExpMatchArray => x !== null)
    .map((x) => ({ n: x[1] ? Number(x[1]) : null, dow: DOW.indexOf(x[2]) }));
  const byMonthDay = (map.get("BYMONTHDAY") ?? "").split(",").map(Number).filter((n) => Number.isInteger(n) && n !== 0);
  return { freq, interval: Math.max(1, Number(map.get("INTERVAL") ?? 1) || 1), count: map.get("COUNT") ? Number(map.get("COUNT")) : null, until, byDay, byMonthDay };
}

function collect(text: string, fallbackTz: string): Raw[] {
  const out: Raw[] = [];
  let cur: Record<string, { value: string; params: string }[]> | null = null;
  for (const line of unfold(text)) {
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT" && cur) {
      const raw = build(cur, fallbackTz);
      if (raw) out.push(raw);
      cur = null;
      if (out.length >= MAX_EVENTS) break;
    } else if (cur) {
      const colon = line.indexOf(":");
      if (colon < 1) continue;
      const head = line.slice(0, colon);
      const [name, ...rest] = head.split(";");
      (cur[name.toUpperCase()] ??= []).push({ value: line.slice(colon + 1), params: rest.join(";") });
    }
  }
  return out;
}

function build(props: Record<string, { value: string; params: string }[]>, fallbackTz: string): Raw | null {
  if (props["STATUS"]?.[0]?.value.toUpperCase() === "CANCELLED" || props["RECURRENCE-ID"]) return null;
  const startProp = props["DTSTART"]?.[0];
  if (!startProp) return null;
  const start = parseDate(startProp.value, startProp.params, fallbackTz);
  if (!start) return null;
  const endProp = props["DTEND"]?.[0];
  const end = endProp ? parseDate(endProp.value, endProp.params, fallbackTz) : null;
  const rule = props["RRULE"]?.[0] ? parseRule(props["RRULE"][0].value, fallbackTz) : null;
  const exdates = (props["EXDATE"] ?? []).flatMap((p) => p.value.split(",").map((v) => parseDate(v, p.params, fallbackTz))).filter((x): x is NonNullable<typeof x> => x !== null).map((x) => (x.allDay ? Date.UTC(x.wall.y, x.wall.m - 1, x.wall.d) : zonedToUtc(x.wall, x.tz)));
  return { title: unescapeText(props["SUMMARY"]?.[0]?.value ?? "") || "Untitled", place: unescapeText(props["LOCATION"]?.[0]?.value ?? "").slice(0, 80), start: start.wall, end: end?.wall ?? null, allDay: start.allDay, tz: start.tz, rule, exdates };
}

const dayNumber = (y: number, m: number, d: number) => Math.floor(Date.UTC(y, m - 1, d) / 86400000);

function occursOn(raw: Raw, y: number, m: number, d: number): boolean {
  const rule = raw.rule;
  const startDay = dayNumber(raw.start.y, raw.start.m, raw.start.d);
  const day = dayNumber(y, m, d);
  if (day < startDay) return false;
  if (!rule) return day === startDay;
  if (rule.until !== null && Date.UTC(y, m - 1, d) > rule.until) return false;
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const startDow = new Date(Date.UTC(raw.start.y, raw.start.m - 1, raw.start.d)).getUTCDay();
  if (rule.freq === "DAILY") return (day - startDay) % rule.interval === 0;
  if (rule.freq === "WEEKLY") {
    const weekStart = (n: number, w: number) => n - ((w + 6) % 7);
    const weeks = Math.floor((weekStart(day, dow) - weekStart(startDay, startDow)) / 7);
    const days = rule.byDay.length > 0 ? rule.byDay.map((b) => b.dow) : [startDow];
    return weeks % rule.interval === 0 && days.includes(dow);
  }
  const months = (y - raw.start.y) * 12 + (m - raw.start.m);
  if (rule.freq === "MONTHLY") {
    if (months % rule.interval !== 0) return false;
    if (rule.byDay.length > 0) {
      const nth = Math.ceil(d / 7);
      const last = d + 7 > new Date(Date.UTC(y, m, 0)).getUTCDate();
      return rule.byDay.some((b) => b.dow === dow && (b.n === null || b.n === nth || (b.n === -1 && last)));
    }
    const monthDays = rule.byMonthDay.length > 0 ? rule.byMonthDay : [raw.start.d];
    const length = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return monthDays.some((md) => (md > 0 ? md : length + md + 1) === d);
  }
  return months % (12 * rule.interval) === 0 && m === raw.start.m && d === raw.start.d;
}

function countedOccurrence(raw: Raw, y: number, m: number, d: number): boolean {
  if (!occursOn(raw, y, m, d)) return false;
  if (!raw.rule || raw.rule.count === null) return true;
  let n = 0;
  const first = dayNumber(raw.start.y, raw.start.m, raw.start.d);
  const target = dayNumber(y, m, d);
  for (let day = first; day <= target && n <= raw.rule.count; day++) {
    const dt = new Date(day * 86400000);
    if (occursOn(raw, dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())) n++;
  }
  return n <= raw.rule.count;
}

function clock(instant: number, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(instant));
}

export function eventsForDay(text: string, now: number, tz: string): DayEvent[] {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now)).split("-").map(Number);
  const [ty, tm, td] = parts;
  const dayStart = zonedToUtc({ y: ty, m: tm, d: td, h: 0, mi: 0, s: 0 }, tz);
  const dayEnd = zonedToUtc({ y: ty, m: tm, d: td + 1, h: 0, mi: 0, s: 0 }, tz);
  const today = dayNumber(ty, tm, td);
  const out: DayEvent[] = [];
  for (const raw of collect(text, tz)) {
    const spanDays = raw.end ? Math.max(0, dayNumber(raw.end.y, raw.end.m, raw.end.d) - dayNumber(raw.start.y, raw.start.m, raw.start.d)) : 0;
    const back = Math.min(spanDays + 1, 31);
    for (let k = 0; k <= back; k++) {
      const dt = new Date((today - k) * 86400000);
      const y = dt.getUTCFullYear();
      const m = dt.getUTCMonth() + 1;
      const d = dt.getUTCDate();
      if (!countedOccurrence(raw, y, m, d)) continue;
      if (raw.allDay) {
        const coversToday = k < Math.max(1, spanDays);
        if (coversToday && !raw.exdates.includes(Date.UTC(y, m - 1, d))) out.push({ time: "All day", title: raw.title, place: raw.place, sort: -1 });
        continue;
      }
      const startUtc = zonedToUtc({ ...raw.start, y, m, d }, raw.tz);
      const duration = raw.end ? zonedToUtc(raw.end, raw.tz) - zonedToUtc(raw.start, raw.tz) : 0;
      if (raw.exdates.includes(startUtc)) continue;
      const overlaps = duration > 0 ? startUtc < dayEnd && startUtc + duration > dayStart : startUtc >= dayStart && startUtc < dayEnd;
      if (overlaps) out.push({ time: startUtc < dayStart ? "00:00" : clock(startUtc, tz), title: raw.title, place: raw.place, sort: Math.max(startUtc, dayStart) });
    }
  }
  return out.sort((a, b) => a.sort - b.sort).slice(0, 20);
}

export type OwnEvent = { title: string; day: string; start_time: string | null; end_time: string | null; repeat: string; place?: string; until?: string | null; skip?: string[] };

function icsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/[\r\n]+/g, " ");
}

export function ownEventsToIcs(rows: OwnEvent[], tz: string): string {
  const blocks = rows.map((r) => {
    const date = r.day.replace(/-/g, "");
    const lines = ["BEGIN:VEVENT", `SUMMARY:${icsText(r.title)}`];
    if (r.place) lines.push(`LOCATION:${icsText(r.place)}`);
    if (r.start_time) {
      const stamp = (t: string) => `${date}T${t.slice(0, 2)}${t.slice(3, 5)}00`;
      lines.push(`DTSTART;TZID=${tz}:${stamp(r.start_time)}`);
      if (r.end_time) lines.push(`DTEND;TZID=${tz}:${stamp(r.end_time)}`);
    } else {
      const next = new Date(Date.parse(`${r.day}T00:00:00Z`) + 86400000).toISOString().slice(0, 10).replace(/-/g, "");
      lines.push(`DTSTART;VALUE=DATE:${date}`, `DTEND;VALUE=DATE:${next}`);
    }
    if (r.repeat !== "none") lines.push(`RRULE:FREQ=${r.repeat.toUpperCase()}${r.until ? `;UNTIL=${r.until.replace(/-/g, "")}` : ""}`);
    if (r.repeat !== "none" && r.skip && r.skip.length > 0) {
      for (const skipped of r.skip) {
        const d = skipped.replace(/-/g, "");
        lines.push(r.start_time ? `EXDATE;TZID=${tz}:${d}T${r.start_time.slice(0, 2)}${r.start_time.slice(3, 5)}00` : `EXDATE;VALUE=DATE:${d}`);
      }
    }
    lines.push("END:VEVENT");
    return lines.join("\r\n");
  });
  return `BEGIN:VCALENDAR\r\n${blocks.join("\r\n")}\r\nEND:VCALENDAR`;
}
