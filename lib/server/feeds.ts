import "server-only";
import { fetchPublicText } from "@/lib/server/safe-fetch";

export type Headline = { title: string; source: string; url: string | null; at: number | null };

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Math.min(parseInt(hex, 16), 0x10ffff)))
    .replace(/&#(\d+);/g, (_, num: string) => String.fromCodePoint(Math.min(parseInt(num, 10), 0x10ffff)))
    .replace(/&([a-z]+);/gi, (whole, name: string) => ENTITIES[name.toLowerCase()] ?? whole);
}

function plain(text: string): string {
  return decode(text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string): string | null {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return match ? match[1] : null;
}

function linkOf(block: string): string | null {
  const href = block.match(/<link[^>]*\shref=["']([^"']+)["'][^>]*>/i);
  const raw = href ? href[1] : tag(block, "link");
  if (!raw) return null;
  const candidate = decode(raw).trim();
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function parseFeed(xml: string, source: string): Headline[] {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? [];
  const out: Headline[] = [];
  for (const block of blocks.slice(0, 10)) {
    const rawTitle = tag(block, "title");
    const title = rawTitle ? plain(rawTitle).slice(0, 200) : "";
    if (!title) continue;
    const when = tag(block, "pubDate") ?? tag(block, "published") ?? tag(block, "updated") ?? tag(block, "dc:date");
    const parsed = when ? Date.parse(plain(when)) : NaN;
    out.push({ title, source, url: linkOf(block), at: Number.isNaN(parsed) ? null : parsed });
  }
  return out;
}

export async function readFeed(url: string): Promise<Headline[] | null> {
  const xml = await fetchPublicText(url);
  if (!xml) return null;
  return parseFeed(xml, new URL(url).hostname.replace(/^www\./, ""));
}

export function ago(at: number | null, now: number): string {
  if (at === null) return "";
  const minutes = Math.max(0, Math.round((now - at) / 60000));
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}
