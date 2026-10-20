import { apiGuard } from "@/lib/auth";
import { RUNNABLE } from "@/lib/agents";
import { runBank } from "@/lib/server/bank";
import { DbUnavailable } from "@/lib/server/db";
import { allow } from "@/lib/server/limit";

export async function POST(request: Request) {
  const denied = await apiGuard(request);
  if (denied) return denied;
  if (!allow("agent-run", 6, 60_000)) return Response.json({ error: "Too many runs. Wait a minute." }, { status: 429 });
  let agent: unknown;
  try {
    agent = ((await request.json()) as { agent?: unknown }).agent;
  } catch {
    agent = undefined;
  }
  if (typeof agent !== "string" || !RUNNABLE.includes(agent)) return Response.json({ error: "Unknown agent" }, { status: 400 });
  try {
    const result = await runBank("manual");
    return Response.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    return Response.json({ error: error instanceof DbUnavailable ? "Database is not connected" : "The agents are not set up" }, { status: 503 });
  }
}
