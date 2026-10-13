import assert from "node:assert/strict";
import { test } from "node:test";

const ics = await import("../lib/server/ics.ts");
const feeds = await import("../lib/server/feeds.ts");
const calendarInput = await import("../lib/server/calendar-input.ts");
const monitor = await import("../lib/server/monitor.ts");
const password = await import("../lib/password.ts");
const session = await import("../lib/session.ts");
const commands = await import("../lib/commands.ts");
const settings = await import("../lib/server/settings-input.ts");
const gmail = await import("../lib/server/gmail.ts");
const topo = await import("../lib/geo/topo.ts");
const view = await import("../lib/geo/view.ts");
const sun = await import("../lib/geo/sun.ts");
const plan = await import("../lib/plan.ts");
const placesInput = await import("../lib/server/places-input.ts");
const world = JSON.parse((await import("node:fs")).readFileSync(new URL("../lib/geo/countries-50m.json", import.meta.url), "utf8"));

const TZ = "Asia/Tbilisi";
const NOW = Date.parse("2026-10-13T08:00:00Z");

const wrap = (events) => `BEGIN:VCALENDAR\r\n${events.map((e) => `BEGIN:VEVENT\r\n${e.join("\r\n")}\r\nEND:VEVENT`).join("\r\n")}\r\nEND:VCALENDAR`;
const today = (events) => ics.eventsForDay(wrap(events), NOW, TZ).map((e) => `${e.time} ${e.title}`).join(" | ");
const own = (rows) => ics.eventsForDay(ics.ownEventsToIcs(rows, TZ), NOW, TZ).map((e) => `${e.time} ${e.title}`).join(" | ");

test("calendar: time zones", () => {
  assert.equal(new Date(ics.zonedToUtc({ y: 2026, m: 7, d: 1, h: 12, mi: 0, s: 0 }, "America/New_York")).toISOString(), "2026-07-01T16:00:00.000Z");
  assert.equal(today([["SUMMARY:Call", "DTSTART;TZID=Asia/Tbilisi:20261013T100000", "DTEND;TZID=Asia/Tbilisi:20261013T110000"]]), "10:00 Call");
  assert.equal(today([["SUMMARY:Utc", "DTSTART:20261013T060000Z"]]), "10:00 Utc");
  assert.equal(today([["SUMMARY:NY", "DTSTART;TZID=America/New_York:20261013T030000"]]), "11:00 NY");
  assert.equal(today([["SUMMARY:Float", "DTSTART:20261013T140000"]]), "14:00 Float");
});

test("calendar: all-day and multi-day", () => {
  assert.equal(today([["SUMMARY:Holiday", "DTSTART;VALUE=DATE:20261013", "DTEND;VALUE=DATE:20261014"]]), "All day Holiday");
  assert.equal(today([["SUMMARY:Old", "DTSTART;VALUE=DATE:20261012", "DTEND;VALUE=DATE:20261013"]]), "");
  assert.equal(today([["SUMMARY:Trip", "DTSTART;VALUE=DATE:20261011", "DTEND;VALUE=DATE:20261015"]]), "All day Trip");
  assert.equal(today([["SUMMARY:Night", "DTSTART;TZID=Asia/Tbilisi:20261012T220000", "DTEND;TZID=Asia/Tbilisi:20261013T020000"]]), "00:00 Night");
  assert.equal(today([["SUMMARY:Tomorrow", "DTSTART;TZID=Asia/Tbilisi:20261014T003000"]]), "");
});

test("calendar: repeating events", () => {
  const at = (rule, start = "20260901T180000") => today([["SUMMARY:R", `DTSTART;TZID=Asia/Tbilisi:${start}`, `RRULE:${rule}`]]);
  assert.equal(at("FREQ=WEEKLY;BYDAY=TU,TH"), "18:00 R");
  assert.equal(at("FREQ=WEEKLY;BYDAY=MO,WE"), "");
  assert.equal(at("FREQ=WEEKLY;INTERVAL=2", "20260929T090000"), "09:00 R");
  assert.equal(at("FREQ=WEEKLY;INTERVAL=2", "20261006T090000"), "");
  assert.equal(at("FREQ=DAILY;COUNT=3", "20261011T120000"), "12:00 R");
  assert.equal(at("FREQ=DAILY;COUNT=2", "20261011T120000"), "");
  assert.equal(at("FREQ=DAILY;UNTIL=20261010T000000Z"), "");
  assert.equal(at("FREQ=MONTHLY;BYDAY=2TU", "20260512T150000"), "15:00 R");
  assert.equal(at("FREQ=MONTHLY", "20260113T090000"), "09:00 R");
  assert.equal(at("FREQ=YEARLY", "20101013T090000"), "09:00 R");
  assert.equal(today([["SUMMARY:Skip", "DTSTART;TZID=Asia/Tbilisi:20261001T120000", "RRULE:FREQ=DAILY", "EXDATE;TZID=Asia/Tbilisi:20261013T120000"]]), "");
});

test("calendar: cancelled, moved, text and junk", () => {
  assert.equal(today([["SUMMARY:Gone", "STATUS:CANCELLED", "DTSTART:20261013T060000Z"]]), "");
  assert.equal(today([["SUMMARY:Moved", "RECURRENCE-ID:20261013T060000Z", "DTSTART:20261013T060000Z"]]), "");
  assert.equal(today([["SUMMARY:Lunch\\, with", " Mia\\nand Tom", "DTSTART:20261013T090000Z"]]), "13:00 Lunch, withMia and Tom");
  assert.equal(today([["SUMMARY:B", "DTSTART:20261013T110000Z"], ["SUMMARY:A", "DTSTART:20261013T050000Z"], ["SUMMARY:Z", "DTSTART;VALUE=DATE:20261013"]]), "All day Z | 09:00 A | 15:00 B");
  assert.equal(ics.eventsForDay("", NOW, TZ).length, 0);
  assert.equal(ics.eventsForDay("<html>nope</html>", NOW, TZ).length, 0);
});

test("own events become calendar entries safely", () => {
  const row = (extra) => ({ title: "T", day: "2026-10-13", start_time: "10:30:00", end_time: null, repeat: "none", ...extra });
  assert.equal(own([row({ title: "Dentist", end_time: "11:15:00" })]), "10:30 Dentist");
  assert.equal(own([row({ start_time: null })]), "All day T");
  assert.equal(own([row({ day: "2026-10-20" })]), "");
  assert.equal(own([row({ day: "2026-09-01", repeat: "weekly" })]), "10:30 T");
  assert.equal(own([row({ title: 'Tom, Ann; "A\\B"' })]), '10:30 Tom, Ann; "A\\B"');
  assert.equal(own([row({ title: "x\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nSUMMARY:Fake\r\nDTSTART:20261013T100000Z" })]).split(" | ").length, 1);
});

test("classes repeat only until their end date and keep the room", () => {
  const row = (extra) => ({ title: "T", day: "2026-09-01", start_time: "10:30:00", end_time: null, repeat: "weekly", ...extra });
  assert.equal(own([row({ until: "2026-10-13" })]), "10:30 T");
  assert.equal(own([row({ until: "2026-10-12" })]), "");
  assert.equal(own([row({ until: null })]), "10:30 T");
  const place = (value) => ics.eventsForDay(ics.ownEventsToIcs([row({ place: value })], TZ), NOW, TZ)[0].place;
  assert.equal(place("B15"), "B15");
  assert.equal(place("Wing B; room, 2"), "Wing B; room, 2");
  assert.equal(place(""), "");
});

test("classes can be hidden on chosen days", () => {
  const row = (extra) => ({ title: "T", day: "2026-09-01", start_time: "10:30:00", end_time: null, repeat: "weekly", until: "2026-12-28", ...extra });
  assert.equal(own([row({ skip: ["2026-10-13"] })]), "");
  assert.equal(own([row({ skip: ["2026-10-12", "2026-10-14"] })]), "10:30 T");
  assert.equal(own([row({ skip: [] })]), "10:30 T");
  assert.equal(own([row({ start_time: null, skip: ["2026-10-13"] })]), "");
  assert.equal(own([row({ repeat: "none", day: "2026-10-13", until: null, skip: ["2026-10-13"] })]), "10:30 T");
  assert.deepEqual(calendarInput.parseBreak({ from: "2026-10-27", to: "2026-10-29" }), { from: "2026-10-27", to: "2026-10-29", days: ["2026-10-27", "2026-10-28", "2026-10-29"] });
  assert.equal(calendarInput.parseBreak({ from: "2026-10-27", to: "2026-10-27" }).days.length, 1);
  assert.equal(calendarInput.parseBreak({ from: "2026-12-30", to: "2027-01-02" }).days.length, 4);
  for (const bad of [{ from: "2026-10-29", to: "2026-10-27" }, { from: "2026-01-01", to: "2026-12-31" }, { from: "2026-02-30", to: "2026-03-01" }, { from: "x", to: "y" }, { from: 1, to: 2 }, {}, null, "x"]) assert.equal(calendarInput.parseBreak(bad), null);
  assert.deepEqual(calendarInput.mergeSkipped(["2026-10-28", "2026-10-27"], ["2026-10-27", "2026-10-29"]), ["2026-10-27", "2026-10-28", "2026-10-29"]);
  assert.equal(calendarInput.mergeSkipped([], Array.from({ length: 200 }, (_, i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10))).length, 120);
});

test("moving classes to the next term", () => {
  assert.equal(calendarInput.shiftDay("2026-10-13", 26), "2027-04-13");
  assert.equal(new Date(`${calendarInput.shiftDay("2026-10-13", 26)}T00:00:00Z`).getUTCDay(), new Date("2026-10-13T00:00:00Z").getUTCDay());
  assert.equal(calendarInput.shiftDay("2026-12-28", 1), "2027-01-04");
  assert.equal(calendarInput.parseShift({ weeks: 26 }), 26);
  for (const bad of [{ weeks: 0 }, { weeks: 61 }, { weeks: 1.5 }, { weeks: "26" }, { weeks: Number.NaN }, {}, null, "x"]) assert.equal(calendarInput.parseShift(bad), null);
});

test("event input validation", () => {
  const ok = { title: " Lunch ", day: "2026-10-13", start: "13:00", end: "14:00", repeat: "weekly" };
  assert.deepEqual(calendarInput.parseEvent(ok), { title: "Lunch", day: "2026-10-13", start_time: "13:00", end_time: "14:00", repeat: "weekly", place: "", until: null });
  assert.deepEqual(calendarInput.parseEvent({ title: "A", day: "2026-10-13" }), { title: "A", day: "2026-10-13", start_time: null, end_time: null, repeat: "none", place: "", until: null });
  assert.deepEqual(calendarInput.parseEvent({ ...ok, place: " B15 ", until: "2027-01-31" }), { title: "Lunch", day: "2026-10-13", start_time: "13:00", end_time: "14:00", repeat: "weekly", place: "B15", until: "2027-01-31" });
  for (const bad of [{ ...ok, title: " " }, { ...ok, title: "a".repeat(201) }, { ...ok, day: "2026-02-30" }, { ...ok, day: "13/10/2026" }, { ...ok, start: "25:00" }, { ...ok, end: "12:00" }, { ...ok, start: "", end: "14:00" }, { ...ok, repeat: "hourly" }, { ...ok, until: "2026-10-12" }, { ...ok, until: "2027-02-30" }, { ...ok, repeat: "none", until: "2027-01-31" }, { ...ok, place: "x".repeat(81) }, { ...ok, place: "B\n15" }, { ...ok, place: 5 }, [], null, { ...ok, title: 5 }]) {
    assert.equal(calendarInput.parseEvent(bad), null);
  }
});

test("the day plan finds gaps and places tasks in them", () => {
  const events = [{ time: "09:00", end: "10:55", title: "CTC", place: "B15" }, { time: "11:15", end: "13:10", title: "PST", place: "C1" }, { time: "All day", end: "", title: "Holiday" }];
  const morning = plan.buildPlan(events, ["Write report", "Gym"], 8 * 60);
  assert.deepEqual(morning.allDay, ["Holiday"]);
  const kinds = morning.items.map((i) => `${i.kind}:${plan.clockText(i.start)}-${plan.clockText(i.end)}`);
  assert.deepEqual(kinds, ["free:08:00-09:00", "event:09:00-10:55", "event:11:15-13:10", "free:13:10-13:55", "free:13:55-22:00"]);
  assert.deepEqual(morning.items.filter((i) => i.kind === "free").map((i) => i.task), ["Write report", "Gym", null]);
  assert.equal(morning.unplaced, 0);
  const late = plan.buildPlan(events, ["A"], 12 * 60);
  assert.ok(late.items.find((i) => i.kind === "event" && i.title === "CTC").past);
  assert.ok(late.items.find((i) => i.kind === "event" && i.title === "PST").now);
  assert.ok(late.items.every((i) => i.kind === "event" || i.start >= 12 * 60));
  assert.equal(plan.buildPlan([], [], 23 * 60).items.length, 0);
  assert.equal(plan.buildPlan([{ time: "09:00", end: "", title: "No end" }], [], 0).items.find((i) => i.kind === "event").end, 10 * 60);
  const crowded = plan.buildPlan([], Array.from({ length: 25 }, (_, n) => `t${n}`), 7 * 60);
  assert.ok(crowded.unplaced > 0);
  assert.equal(plan.toMinutes("25:61"), null);
  assert.equal(plan.toMinutes("nonsense"), null);
  assert.equal(plan.durationText(125), "2h 5m");
});

test("pinned places are validated and rounded", () => {
  assert.deepEqual(placesInput.parsePlace({ name: " Batumi, Georgia ", latitude: 41.64590001, longitude: 41.6418 }), { name: "Batumi, Georgia", latitude: 41.6459, longitude: 41.6418 });
  for (const bad of [{ name: "", latitude: 1, longitude: 1 }, { name: "a".repeat(61), latitude: 1, longitude: 1 }, { name: "A\nB", latitude: 1, longitude: 1 }, { name: "A", latitude: 91, longitude: 1 }, { name: "A", latitude: 1, longitude: -181 }, { name: "A", latitude: "1", longitude: 1 }, { name: "A", latitude: Number.NaN, longitude: 1 }, { name: 5, latitude: 1, longitude: 1 }, [], null]) {
    assert.equal(placesInput.parsePlace(bad), null);
  }
});

test("gmail headers become safe short labels", () => {
  assert.equal(gmail.senderName('"Nino K" <nino@example.com>'), "Nino K");
  assert.equal(gmail.senderName("Nino K <nino@example.com>"), "Nino K");
  assert.equal(gmail.senderName("nino@example.com"), "nino@example.com");
  assert.equal(gmail.senderName("<nino@example.com>"), "nino@example.com");
  assert.equal(gmail.senderName("x\u0000\n<b>y</b> <a@b.c>"), "x <b>y</b>");
  assert.equal(gmail.senderName(`${"a".repeat(300)} <a@b.c>`).length <= 60, true);
  assert.equal(gmail.senderName(undefined), "");
  assert.equal(gmail.cleanText("  a \n\t b  ", 10), "a b");
  assert.equal(gmail.cleanText("abcdef", 3), "abc");
  assert.equal(gmail.cleanText(5, 3), "");
  const raw = (extra = {}) => ({ id: "18f3a9c2b7d4e601", internalDate: "1791900000000", payload: { headers: [{ name: "From", value: '"Nino K" <nino@example.com>' }, { name: "SUBJECT", value: "  October   invoice " }] }, ...extra });
  assert.deepEqual(gmail.toItem(raw()), { id: "18f3a9c2b7d4e601", sender: "Nino K", subject: "October invoice", at: new Date(1791900000000).toISOString() });
  assert.equal(gmail.toItem(raw({ id: "../../etc/passwd" })), null);
  assert.equal(gmail.toItem(raw({ id: 5 })), null);
  assert.equal(gmail.toItem({ id: "abcdef123456" }).subject, "");
  assert.equal(gmail.toItem({ id: "abcdef123456" }).sender, "?");
  assert.ok(Date.parse(gmail.toItem(raw({ internalDate: "99999999999999" })).at) <= Date.now());
  assert.equal(gmail.toItem(raw({ payload: { headers: "nope" } })).sender, "?");
});

test("the world map data decodes into real countries", () => {
  const countries = topo.decodeCountries(world);
  assert.ok(countries.length > 150);
  const georgia = countries.find((c) => c.name === "Georgia");
  assert.ok(georgia, "Georgia is on the map");
  assert.ok(georgia.west < 44.8 && georgia.east > 44.8 && georgia.south < 41.7 && georgia.north > 41.7, "Tbilisi is inside Georgia's box");
  for (const c of countries) {
    assert.ok(c.west >= -180 && c.east <= 180 && c.south >= -90 && c.north <= 90, c.name);
    for (const rings of c.polygons) for (const r of rings) assert.ok(r.length >= 6 && r.length % 2 === 0, c.name);
  }
  const small = topo.decodeCountries({ transform: { scale: [1, 1], translate: [0, 0] }, arcs: [[[0, 0], [10, 0], [0, 10]], [[10, 10], [-10, 0], [0, -10]]], objects: { countries: { geometries: [{ type: "Polygon", arcs: [[0, 1]], properties: { name: "Box" } }, { type: "Polygon", arcs: [[-2, -1]], properties: { name: "Reversed" } }, { type: "Point" }] } } });
  assert.equal(small.length, 2);
  assert.deepEqual(Array.from(small[0].polygons[0][0]), [0, 0, 10, 0, 10, 10, 0, 10, 0, 0]);
  assert.equal(small[0].east, 10);
});

test("map zoom and pan stay inside the world", () => {
  const W = 600;
  const H = 300;
  assert.equal(view.baseScale(W, H), 600 / 360);
  assert.equal(view.baseScale(300, 600), 600 / 180);
  assert.deepEqual(Object.values(view.clampView({ lon: 500, lat: 500, k: 1 }, 300, 600)).slice(1, 2), [0]);
  const full = view.clampView({ lon: 90, lat: 40, k: 1 }, W, H);
  assert.deepEqual([full.lon, full.k], [0, 1]);
  assert.equal(view.clampView({ lon: 0, lat: 0, k: 1000 }, W, H).k, view.MAX_ZOOM);
  assert.equal(view.clampView({ lon: 0, lat: 0, k: 0.1 }, W, H).k, 1);
  const zoomed = view.clampView({ lon: 500, lat: 500, k: 10 }, W, H);
  const s = view.baseScale(W, H) * 10;
  assert.ok(Math.abs(zoomed.lon - (180 - W / (2 * s))) < 1e-9);
  assert.ok(zoomed.lat <= 90);
  const [x, y] = view.project({ lon: 44.8, lat: 41.7, k: 8 }, W, H, 44.8, 41.7);
  assert.deepEqual([x, y], [W / 2, H / 2]);
  const [lon, lat] = view.unproject({ lon: 44.8, lat: 41.7, k: 8 }, W, H, W / 2 + 30, H / 2 - 20);
  const [x2, y2] = view.project({ lon: 44.8, lat: 41.7, k: 8 }, W, H, lon, lat);
  assert.ok(Math.abs(x2 - (W / 2 + 30)) < 1e-6 && Math.abs(y2 - (H / 2 - 20)) < 1e-6);
  const start = { lon: 40, lat: 40, k: 4 };
  const after = view.zoomAt(start, W, H, 100, 80, 2);
  const [ax, ay] = view.unproject(start, W, H, 100, 80);
  const [bx, by] = view.unproject(after, W, H, 100, 80);
  assert.ok(Math.abs(ax - bx) < 1e-6 && Math.abs(ay - by) < 1e-6, "the point under the cursor stays put");
  assert.equal(after.k, 8);
  const moved = view.panBy(start, W, H, 50, 0);
  assert.ok(moved.lon < start.lon);
  assert.equal(view.gridStep(1), 30);
  assert.equal(view.gridStep(60), 2);
});

test("the day and night line follows the sun", () => {
  const june = sun.subsolar(Date.parse("2026-06-21T12:00:00Z"));
  assert.ok(Math.abs(june.lat - 23.44) < 0.5, `June solstice latitude ${june.lat}`);
  assert.ok(Math.abs(june.lon) < 3, `Longitude at noon UTC ${june.lon}`);
  const december = sun.subsolar(Date.parse("2026-12-21T12:00:00Z"));
  assert.ok(Math.abs(december.lat + 23.44) < 0.5);
  const evening = sun.subsolar(Date.parse("2026-03-20T18:00:00Z"));
  assert.ok(Math.abs(evening.lat) < 1.5 && Math.abs(evening.lon + 90) < 5, `18:00 UTC at the equinox ${JSON.stringify(evening)}`);
  const polygon = sun.nightPolygon(Date.parse("2026-06-21T12:00:00Z"));
  assert.equal(polygon[0][0], -180);
  assert.equal(polygon.at(-1)[1], -90);
  assert.equal(sun.nightPolygon(Date.parse("2026-12-21T12:00:00Z")).at(-1)[1], 90);
  for (const [lon, lat] of polygon) assert.ok(lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90);
  assert.ok(sun.nightPolygon(Date.parse("2026-03-20T12:00:00Z")).every(([, lat]) => Number.isFinite(lat)));
});

test("calendar addresses", () => {
  assert.equal(calendarInput.calendarAddress("webcal://p01-caldav.icloud.com/published/2/abc"), "https://p01-caldav.icloud.com/published/2/abc");
  assert.equal(calendarInput.calendarAddress("https://calendar.google.com/calendar/ical/x/basic.ics"), "https://calendar.google.com/calendar/ical/x/basic.ics");
  assert.equal(calendarInput.calendarAddress("http://calendar.example.com/a.ics"), null);
});

test("public address rules", () => {
  assert.equal(monitor.normalizeUrl("https://example.com/feed.xml"), "https://example.com/feed.xml");
  for (const bad of ["http://example.com", "https://localhost", "https://127.0.0.1", "https://169.254.169.254/latest", "https://10.0.0.5", "https://[::1]/", "https://intranet", "https://printer.local", "https://u:p@example.com", "https://example.com:8443", "ftp://example.com", "not a url", ""]) {
    assert.equal(monitor.normalizeUrl(bad), null, bad);
  }
});

test("feed parsing", () => {
  const rss = `<rss><channel><item><title><![CDATA[Fish &amp; chips <b>today</b>]]></title><link>https://a.example/1</link><pubDate>Tue, 13 Oct 2026 03:00:00 GMT</pubDate></item><item><title>Bad link</title><link>javascript:alert(1)</link></item><item><title>&#x1F600; ok &lt;script&gt;</title></item></channel></rss>`;
  const items = feeds.parseFeed(rss, "a.example");
  assert.equal(items[0].title, "Fish & chips today");
  assert.equal(items[0].url, "https://a.example/1");
  assert.equal(items[1].url, null);
  assert.equal(items[2].title, "😀 ok <script>");
  const atom = feeds.parseFeed(`<feed><entry><title type="html">Atom one</title><link rel="alternate" href="https://b.example/x?a=1&amp;b=2"/><updated>2026-10-13T02:00:00Z</updated></entry></feed>`, "b.example");
  assert.equal(atom[0].url, "https://b.example/x?a=1&b=2");
  assert.equal(feeds.parseFeed("<html>not a feed</html>", "x").length, 0);
  assert.equal(feeds.ago(NOW - 5 * 60000, NOW), "5m");
  assert.equal(feeds.ago(NOW - 3 * 3600000, NOW), "3h");
  assert.equal(feeds.ago(null, NOW), "");
});

test("passwords", () => {
  const stored = password.hashPassword("correct horse battery");
  assert.match(stored, /^scrypt\$[0-9a-f]+\$[0-9a-f]+$/);
  assert.notEqual(stored, password.hashPassword("correct horse battery"));
  assert.equal(password.checkPassword("correct horse battery", stored), true);
  assert.equal(password.checkPassword("wrong", stored), false);
  assert.equal(password.checkPassword("", stored), false);
  assert.equal(password.checkPassword("correct horse battery", undefined), false);
  assert.equal(password.checkPassword("correct horse battery", "not-a-hash"), false);
  assert.ok(!stored.includes("correct horse battery"));
});

test("session cookie", async () => {
  const secret = "0123456789abcdef0123456789abcdef0123";
  const token = await session.signSession(secret, Date.now());
  assert.equal(await session.verifySession(secret, token, Date.now()), true);
  assert.equal(await session.verifySession(secret, token + "x", Date.now()), false);
  assert.equal(await session.verifySession("another-secret-another-secret-123456", token, Date.now()), false);
  assert.equal(await session.verifySession(secret, undefined, Date.now()), false);
  assert.equal(await session.verifySession(undefined, token, Date.now()), false);
  assert.equal(await session.verifySession(secret, token, Date.now() + (session.SESSION_MAX_AGE + 10) * 1000), false);
});

test("command answers stay honest", () => {
  const mod = (id, name, lines) => ({ manifest: { id, name }, notConnectedHint: "hint", lines });
  const modules = [mod("weather", "Sky", () => ["Tbilisi: 11°"]), mod("monitor", "Network", () => ["site OK"])];
  const results = new Map([["weather", { status: "ok", data: {}, fetchedAt: "" }]]);
  assert.deepEqual(commands.answer("sky", modules, results), ["TBILISI: 11°"]);
  assert.match(commands.answer("network", modules, results)[0], /NETWORK: NOT CONNECTED/);
  assert.deepEqual(commands.answer("what is the meaning of life", modules, results), ["NO DATA ON FILE FOR THAT. TYPE HELP."]);
});

test("settings input validation", () => {
  const ok = { name: " LA ", language: "en", city: "Tbilisi", latitude: 41.7151, longitude: 44.8271, timeZone: "Asia/Tbilisi", currency: "GEL" };
  assert.deepEqual(settings.parseSettings(ok), { name: "LA", language: "en", city: "Tbilisi", latitude: 41.7151, longitude: 44.8271, time_zone: "Asia/Tbilisi", currency: "GEL" });
  assert.equal(settings.parseSettings({ ...ok, language: "ka", currency: "USD" })?.language, "ka");
  for (const bad of [{ ...ok, name: "" }, { ...ok, name: "a".repeat(41) }, { ...ok, language: "fr" }, { ...ok, city: " " }, { ...ok, latitude: 91 }, { ...ok, latitude: "41" }, { ...ok, longitude: -181 }, { ...ok, longitude: Number.NaN }, { ...ok, timeZone: "Mars/Olympus" }, { ...ok, timeZone: "" }, { ...ok, currency: "DOGE" }, { ...ok, currency: "gel" }, [], null, "x"]) {
    assert.equal(settings.parseSettings(bad), null);
  }
});
