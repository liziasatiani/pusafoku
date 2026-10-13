import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const i18n = await import("../lib/i18n.ts");
const commands = await import("../lib/commands.ts");

const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], { encoding: "utf8" }).split("\n").filter(Boolean);
const source = (pattern) => files.filter((f) => pattern.test(f)).map((f) => [f, readFileSync(f, "utf8")]);

function literalsIn(text) {
  return [...text.matchAll(/"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\$]|\\.)*)`/g)].map((m) => m[1] ?? m[2] ?? m[3]).filter((s) => s !== undefined);
}

function firstArgument(text, start) {
  let depth = 0;
  let quote = null;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "(" || c === "{" || c === "[") depth++;
    else if (c === ")" || c === "}" || c === "]") {
      if (depth === 0) return text.slice(start, i);
      depth--;
    } else if (c === "," && depth === 0) return text.slice(start, i);
  }
  return "";
}

const needsKa = (text) => text.length > 2 && /[A-Za-z]{3}/.test(text) && !/^[a-z]+(\/[a-z-]+)*$/.test(text);

test("every phrase passed to tr() has a Georgian version", () => {
  const missing = [];
  for (const [file, text] of source(/^(components|modules|lib)\/.*\.(tsx?|mjs)$/)) {
    if (file.startsWith("lib/i18n")) continue;
    for (const m of text.matchAll(/\btr\(/g)) {
      const argument = firstArgument(text, m.index + m[0].length).replace(/[!=]==?\s*("[^"]*"|'[^']*')/g, "");
      for (const lit of literalsIn(argument)) {
        if (needsKa(lit) && !i18n.hasTranslation(lit)) missing.push(`${file}: ${lit}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});

test("module names, descriptions, titles and hints have Georgian versions", () => {
  const missing = [];
  for (const [file, text] of source(/^modules\/.*\/index\.tsx$/)) {
    for (const re of [/\btitle="([^"]+)"/g, /\bdescription: "([^"]+)"/g, /\bnotConnectedHint: "([^"]+)"/g, /\bname: "([^"]+)"/g, /\bplaceholder="([^"]+)"/g, /\blabel="([^"]+)"/g, /\bconst HELP = "([^"]+)"/g]) {
      for (const m of text.matchAll(re)) if (needsKa(m[1]) && !m[1].startsWith("https://") && !i18n.hasTranslation(m[1])) missing.push(`${file}: ${m[1]}`);
    }
  }
  assert.deepEqual(missing, []);
});

test("messages the server sends to the screen have Georgian versions", () => {
  const missing = [];
  for (const [file, text] of source(/^(app\/api\/(settings|events|calendar|feeds|monitor|notes|tasks|approvals)\/.*\.ts|lib\/server\/modules\.ts)$/)) {
    for (const re of [/\berror: "([^"$]+)"/g, /\bmessage: "([^"$]+)"/g, /notConnected\("([^"$]+)"\)/g, /"((?:Light |Heavy |Mostly |Partly )?(?:Clear|cloudy|Overcast|Fog|drizzle|Drizzle|rain|Rain|snow|Snow|Showers|showers|Thunderstorm|Unknown))"/g]) {
      for (const m of text.matchAll(re)) if (needsKa(m[1]) && !i18n.hasTranslation(m[1])) missing.push(`${file}: ${m[1]}`);
    }
  }
  assert.deepEqual([...new Set(missing)], []);
});

test("every Georgian entry keeps the same placeholders as the English", async () => {
  const text = readFileSync("lib/i18n.ts", "utf8");
  const entries = [...text.matchAll(/^\s+(?:"((?:[^"\\]|\\.)+)"|([A-Za-z]+)):\s*\n?\s*"((?:[^"\\]|\\.)*)",?$/gm)].map((m) => [m[1] ?? m[2], m[3]]);
  assert.ok(entries.length > 150);
  const holes = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
  const bad = entries.filter(([en, ka]) => holes(en) !== holes(ka));
  assert.deepEqual(bad, []);
  const notGeorgian = entries.filter(([en, ka]) => en !== "__locale__" && !/[ა-ჺ]/.test(ka));
  assert.deepEqual(notGeorgian, []);
});

test("translating fills in values and leaves English alone", () => {
  assert.equal(i18n.translate("en", "Closed: {n}.", { n: 2 }), "Closed: 2.");
  assert.equal(i18n.translate("ka", "Closed: {n}.", { n: 2 }), "დახურული: 2.");
  assert.equal(i18n.translate("ka", "A phrase nobody translated"), "A phrase nobody translated");
  assert.equal(i18n.translate("en", "Sky"), "Sky");
  assert.equal(i18n.translate("ka", "Sky"), "ცა");
  assert.equal(i18n.localeFor((t) => i18n.translate("ka", t)), "ka-GE");
  assert.equal(i18n.localeFor((t) => i18n.translate("en", t)), "en-GB");
});

test("georgian command answers use Georgian words and no capital forms", () => {
  const mod = (id, name, lines) => ({ manifest: { id, name }, notConnectedHint: "Connect the database to monitor websites.", lines });
  const modules = [mod("weather", "Sky", (_d, tr) => [tr("No new signals.")]), mod("monitor", "Network", () => []), mod("inbox", "Authorizations", () => ["x"])];
  const results = new Map([["weather", { status: "ok", data: {}, fetchedAt: "" }]]);
  const out = (q) => commands.answer(q, modules, results, false, "ka");
  assert.deepEqual(out("ცა"), ["ახალი სიგნალები არ არის."]);
  assert.match(out("ქსელი")[0], /^ქსელი: არ არის დაკავშირებული\./);
  assert.deepEqual(out("რაღაც უცნობი"), ["ამაზე მონაცემი არ მოიპოვება. ჩაწერეთ: დახმარება."]);
  assert.match(out("დღის დაწყება")[0], /\.$/);
  assert.ok(out("დახმარება")[0].startsWith("ბრძანებები"));
  for (const q of ["ცა", "ქსელი", "დღის დაწყება", "დახმარება", "ამინდი", "ავტორიზაციები"]) {
    for (const line of out(q)) assert.ok(!/[Ა-Ჿ]/.test(line), `no Mtavruli in: ${line}`);
  }
  for (const word of i18n.SUGGESTIONS.ka) assert.ok(!/^NO DATA/.test(out(word)[0]), `suggestion "${word}" must be understood`);
  for (const word of i18n.SUGGESTIONS.en) assert.ok(!/^NO DATA/.test(commands.answer(word, modules, results, false, "en")[0]), `suggestion "${word}" must be understood`);
});

test("english answers are unchanged", () => {
  const modules = [{ manifest: { id: "weather", name: "Sky" }, notConnectedHint: "h", lines: () => ["Tbilisi: 11°"] }];
  const results = new Map([["weather", { status: "ok", data: {}, fetchedAt: "" }]]);
  assert.deepEqual(commands.answer("sky", modules, results, false, "en"), ["TBILISI: 11°"]);
});
