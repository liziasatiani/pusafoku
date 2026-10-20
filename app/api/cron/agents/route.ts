import { DEFAULT_ZONE, dueSlot, startOfLocalDay } from "@/lib/agent-slots";
import { cronSecret } from "@/lib/env";
import { runKindsSince } from "@/lib/server/agents-db";
import { runBank } from "@/lib/server/bank";
import { bearerMatches } from "@/lib/server/bearer";
import { DbUnavailable, rest } from "@/lib/server/db";

async function zone(): Promise<string> {
  try {
    const rows = await rest<{ time_zone: string }[]>("settings?select=time_zone&limit=1");
    return rows[0]?.time_zone || DEFAULT_ZONE;
  } catch {
    return DEFAULT_ZONE;
  }
}

export async function GET(request: Request) {
  const secret = cronSecret();
  if (!secret) return Response.json({ error: "Cron is not configured" }, { status: 503 });
  if (!bearerMatches(request, secret)) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const at = Date.now();
    const where = await zone();
    const done = await runKindsSince("bank", new Date(startOfLocalDay(at, where)).toISOString());
    const slot = dueSlot(at, where, done);
    if (!slot) return Response.json({ ran: null });
    const bank = await runBank(slot);
    return Response.json({ ran: slot, bank: bank.ok });
  } catch (error) {
    return Response.json({ error: error instanceof DbUnavailable ? "Database is not connected" : "The agents are not set up" }, { status: 503 });
  }
}
