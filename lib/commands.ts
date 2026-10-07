import type { AnyModule, ModuleResult } from "@/modules/types";

export type Results = Map<string, ModuleResult<unknown>>;

const ROUTES: { id: string; words: RegExp }[] = [
  { id: "weather", words: /sky|weather|rain|temperature/ },
  { id: "calendar", words: /schedule|calendar|meeting|event/ },
  { id: "tasks", words: /operation|task|todo|to-do/ },
  { id: "notes", words: /archive|note/ },
  { id: "rss", words: /signal|news|feed|headline/ },
  { id: "monitor", words: /network|site|website|down|asset|uptime/ },
  { id: "inbox", words: /authori[sz]|approv|waiting/ },
  { id: "clock", words: /time|date|clock|today/ },
];

export const SUGGESTIONS = ["start my day", "authorizations", "network", "sky", "help"];

function linesFor(mod: AnyModule, result: ModuleResult<unknown> | undefined): string[] {
  const name = mod.manifest.name.toUpperCase();
  if (!result || result.status === "not_connected") return [`${name}: NOT CONNECTED. ${mod.notConnectedHint}`];
  if (result.status === "error") return [`${name}: ERROR. ${result.message}`];
  return mod.lines(result.data).map((line) => line.toUpperCase());
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "GOOD NIGHT";
  if (hour < 12) return "GOOD MORNING";
  if (hour < 18) return "GOOD AFTERNOON";
  return "GOOD EVENING";
}

export function answer(input: string, modules: AnyModule[], results: Results, demo: boolean): string[] {
  const text = input.trim().toLowerCase();
  const byId = new Map(modules.map((m) => [m.manifest.id, m]));
  const tag = demo ? ["SAMPLE DATA (DEMO IS ON)."] : [];
  if (/\b(day|brief|morning|summary)\b/.test(text)) {
    const order = ["calendar", "weather", "tasks", "inbox", "monitor", "rss"];
    const out = [`${greeting()}.`];
    for (const id of order) {
      const mod = byId.get(id);
      if (mod) out.push(...linesFor(mod, results.get(id)));
    }
    return out.concat(tag);
  }
  if (/help|\?|what can/.test(text)) {
    return ["COMMANDS: START MY DAY / AUTHORIZATIONS / NETWORK / SKY / SCHEDULE / OPERATIONS / SIGNALS / ARCHIVE", "ANYTHING ELSE: NO DATA ON FILE."];
  }
  for (const route of ROUTES) {
    const mod = byId.get(route.id);
    if (mod && route.words.test(text)) return linesFor(mod, results.get(route.id)).concat(tag);
  }
  return ["NO DATA ON FILE FOR THAT. TYPE HELP."];
}
