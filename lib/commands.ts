import { SUGGESTIONS, translate, type Lang } from "@/lib/i18n";
import type { AnyModule, ModuleResult } from "@/modules/types";

export type Results = Map<string, ModuleResult<unknown>>;

export { SUGGESTIONS };

const ROUTES: { id: string; words: RegExp }[] = [
  { id: "weather", words: /sky|weather|rain|temperature|ამინდ|(^|\s)ცა($|\s)/ },
  { id: "calendar", words: /schedule|calendar|meeting|event|განრიგ|კალენდარ|შეხვედრ|ღონისძიებ/ },
  { id: "tasks", words: /operation|task|todo|to-do|ოპერაცი|ამოცან|საქმე/ },
  { id: "notes", words: /archive|note|არქივ|ჩანაწერ|შენიშვნ/ },
  { id: "rss", words: /signal|news|feed|headline|სიგნალ|სიახლე|ამბ/ },
  { id: "monitor", words: /network|site|website|down|asset|uptime|ქსელ|საიტ|ვებგვერდ/ },
  { id: "messages", words: /message|e-?mail|gmail|შეტყობინებ|მესიჯ|ელფოსტ/ },
  { id: "inbox", words: /authori[sz]|approv|waiting|ავტორიზაც|დასტურ|მომლოდინე/ },
  { id: "clock", words: /time|date|clock|today|დრო|საათ|თარიღ/ },
];

const DAY = /\b(day|brief|morning|summary)\b|დღ(ის|ე)|დილ|მოკლე/;
const HELP = /help|\?|what can|დახმარებ/;

function greetingKey(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function write(lang: Lang) {
  const tr = (text: string, vars?: Record<string, string | number>) => translate(lang, text, vars);
  const shout = (line: string) => (lang === "en" ? line.toUpperCase() : line);
  return { tr, shout };
}

export function answer(input: string, modules: AnyModule[], results: Results, lang: Lang = "en"): string[] {
  const { tr, shout } = write(lang);
  const text = input.trim().toLowerCase();
  const byId = new Map(modules.map((m) => [m.manifest.id, m]));

  const linesFor = (mod: AnyModule): string[] => {
    const result = results.get(mod.manifest.id);
    const name = tr(mod.manifest.name);
    if (!result || result.status === "not_connected") return [shout(tr("{name}: NOT CONNECTED. {hint}", { name, hint: tr(mod.notConnectedHint) }))];
    if (result.status === "error") return [shout(tr("{name}: ERROR. {message}", { name, message: tr(result.message) }))];
    return mod.lines(result.data, tr).map(shout);
  };

  if (DAY.test(text)) {
    const out = [shout(tr(greetingKey()) + ".")];
    for (const id of ["calendar", "weather", "tasks", "messages", "inbox", "monitor", "rss"]) {
      const mod = byId.get(id);
      if (mod) out.push(...linesFor(mod));
    }
    return out;
  }
  if (HELP.test(text)) return [tr("COMMANDS: START MY DAY / AUTHORIZATIONS / MESSAGES / NETWORK / SKY / SCHEDULE / OPERATIONS / SIGNALS / ARCHIVE"), tr("ANYTHING ELSE: NO DATA ON FILE.")];
  for (const route of ROUTES) {
    const mod = byId.get(route.id);
    if (mod && route.words.test(text)) return linesFor(mod);
  }
  return [tr("NO DATA ON FILE FOR THAT. TYPE HELP.")];
}
