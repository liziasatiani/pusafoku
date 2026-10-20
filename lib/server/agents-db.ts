import "server-only";
import type { AgentStatus } from "@/lib/agents";
import { rest } from "@/lib/server/db";

export type RunKind = "morning" | "midday" | "evening" | "manual";

const SLUG = /^[a-z][a-z0-9-]{1,39}$/;

function checked(slug: string): string {
  if (!SLUG.test(slug)) throw new Error("Invalid agent name");
  return slug;
}

export async function setAgent(slug: string, status: AgentStatus, task: string): Promise<void> {
  await rest(`agents?slug=eq.${checked(slug)}`, { method: "PATCH", body: { status, task: task.slice(0, 200), updated_at: new Date().toISOString() }, prefer: "return=minimal" });
}

export async function postMessage(from: string, to: string, kind: "report" | "task" | "note" | "approval", body: string): Promise<void> {
  await rest("agent_messages", { method: "POST", body: { from_slug: checked(from), to_slug: checked(to), kind, body: body.slice(0, 500) }, prefer: "return=minimal" });
}

export async function logRun(slug: string, kind: RunKind, status: "ok" | "error", note: string, startedAt: string): Promise<void> {
  await rest("agent_runs", { method: "POST", body: { agent_slug: checked(slug), kind, status, note: note.slice(0, 300), started_at: startedAt, finished_at: new Date().toISOString() }, prefer: "return=minimal" });
}

export async function runKindsSince(slug: string, sinceIso: string): Promise<string[]> {
  const rows = await rest<{ kind: string }[]>(`agent_runs?select=kind&agent_slug=eq.${checked(slug)}&status=eq.ok&started_at=gte.${encodeURIComponent(sinceIso)}&limit=50`);
  return rows.map((r) => r.kind);
}
