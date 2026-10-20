import "server-only";
import { bankReport } from "@/lib/bank";
import { revenueGoal } from "@/lib/env";
import { logRun, postMessage, setAgent, type RunKind } from "@/lib/server/agents-db";
import { fetchShopSummary, type SummaryFailure } from "@/lib/server/street";

const REASON: Record<SummaryFailure, string> = {
  not_configured: "The shop link is not set up",
  refused: "The shop refused the token",
  unreachable: "The shop could not be reached",
  unexpected: "The shop sent an unexpected answer",
};

export async function runBank(kind: RunKind): Promise<{ ok: boolean; reason?: string }> {
  const startedAt = new Date().toISOString();
  await setAgent("bank", "working", "Counting the shop's revenue");
  const result = await fetchShopSummary();
  if (!result.ok) {
    await setAgent("bank", "error", REASON[result.reason]);
    await logRun("bank", kind, "error", result.reason, startedAt);
    return { ok: false, reason: result.reason };
  }
  const { task, body } = bankReport(result.summary, revenueGoal(), Date.now());
  await postMessage("bank", "curator", "report", body);
  await setAgent("bank", "idle", task);
  await logRun("bank", kind, "ok", "", startedAt);
  return { ok: true };
}
