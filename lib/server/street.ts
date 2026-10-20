import "server-only";
import { streetConfig } from "@/lib/env";
import { parseSummary, type ShopSummary } from "@/lib/shop-summary";

export type SummaryFailure = "not_configured" | "refused" | "unreachable" | "unexpected";

export async function fetchShopSummary(): Promise<{ ok: true; summary: ShopSummary } | { ok: false; reason: SummaryFailure }> {
  const config = streetConfig();
  if (!config) return { ok: false, reason: "not_configured" };
  let res: Response;
  try {
    res = await fetch(`${config.url}/api/street/summary`, {
      headers: { authorization: `Bearer ${config.token}` },
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return { ok: false, reason: "unreachable" };
  }
  if (res.status === 401 || res.status === 403) return { ok: false, reason: "refused" };
  if (!res.ok) return { ok: false, reason: "unexpected" };
  try {
    const summary = parseSummary(await res.json());
    return summary ? { ok: true, summary } : { ok: false, reason: "unexpected" };
  } catch {
    return { ok: false, reason: "unexpected" };
  }
}
