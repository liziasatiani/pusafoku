import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { rest } from "@/lib/server/db";

type SiteRow = { id: string; url: string };

const TIMEOUT_MS = 8000;
const MAX_SITES = 20;
const KEEP_DAYS = 30;

export function normalizeUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password) return null;
  if (url.port && url.port !== "443") return null;
  if (isIP(host) !== 0 || !host.includes(".")) return null;
  if (/\.(local|internal|localhost|lan|home)$/.test(host)) return null;
  const text = url.toString();
  return text.length <= 500 ? text : null;
}

function privateAddress(ip: string): boolean {
  if (ip.includes(":")) {
    const v6 = ip.toLowerCase();
    return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80") || v6.startsWith("::ffff:");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export async function reachesPublicHost(host: string): Promise<boolean> {
  try {
    const addresses = await lookup(host, { all: true });
    return addresses.length > 0 && addresses.every((a) => !privateAddress(a.address));
  } catch {
    return false;
  }
}

async function probe(url: string): Promise<{ ok: boolean; status: number | null; ms: number | null }> {
  const started = Date.now();
  if (!(await reachesPublicHost(new URL(url).hostname))) return { ok: false, status: null, ms: null };
  try {
    const res = await fetch(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "user-agent": "pusafoku-monitor" }, cache: "no-store" });
    await res.body?.cancel();
    return { ok: res.status < 500, status: res.status, ms: Date.now() - started };
  } catch {
    return { ok: false, status: null, ms: null };
  }
}

export async function runChecks(): Promise<number> {
  const sites = await rest<SiteRow[]>(`monitor_sites?select=id,url&active=eq.true&limit=${MAX_SITES}`);
  if (sites.length === 0) return 0;
  const results = await Promise.all(sites.map(async (s) => ({ site_id: s.id, ...(await probe(s.url)) })));
  await rest("monitor_checks", {
    method: "POST",
    body: results.map((r) => ({ site_id: r.site_id, ok: r.ok, status_code: r.status, ms: r.ms })),
    prefer: "return=minimal",
  });
  const cutoff = new Date(Date.now() - KEEP_DAYS * 86400000).toISOString();
  await rest(`monitor_checks?checked_at=lt.${encodeURIComponent(cutoff)}`, { method: "DELETE", prefer: "return=minimal" });
  return results.length;
}

export async function siteCount(): Promise<number> {
  const rows = await rest<{ id: string }[]>("monitor_sites?select=id");
  return rows.length;
}

export { MAX_SITES };
