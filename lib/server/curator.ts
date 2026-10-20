import "server-only";
import { curatorReport } from "@/lib/curator";
import { revenueGoal } from "@/lib/env";
import { logRun, postMessage, setAgent, type RunKind } from "@/lib/server/agents-db";
import { rest } from "@/lib/server/db";
import { fetchShopSummary } from "@/lib/server/street";

export async function runCurator(kind: RunKind): Promise<{ ok: boolean }> {
  const startedAt = new Date().toISOString();
  await setAgent("curator", "working", "Picking the day's priorities");
  const [pending, open, shop] = await Promise.all([
    rest<{ id: string }[]>("approvals?select=id&status=eq.pending&limit=200"),
    rest<{ title: string }[]>("tasks?select=title&done=eq.false&order=created_at.asc&limit=2"),
    fetchShopSummary(),
  ]);
  const { task, body } = curatorReport({ summary: shop.ok ? shop.summary : null, goal: revenueGoal(), at: Date.now(), pending: pending.length, tasks: open.map((t) => t.title) });
  await postMessage("curator", "bank", "task", body);
  await setAgent("curator", "idle", task);
  await logRun("curator", kind, "ok", shop.ok ? "" : `shop: ${shop.reason}`, startedAt);
  return { ok: true };
}
