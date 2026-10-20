import { DEFAULT_ZONE, dueSlot, localHour, SLOTS, startOfLocalDay } from "@/lib/agent-slots";
import { cronSecret } from "@/lib/env";
import { runKindsSince } from "@/lib/server/agents-db";
import { runBank } from "@/lib/server/bank";
import { bearerMatches } from "@/lib/server/bearer";
import { runCurator } from "@/lib/server/curator";
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
    const since = new Date(startOfLocalDay(at, where)).toISOString();
    const [done, curatorDone] = await Promise.all([runKindsSince("bank", since), runKindsSince("curator", since)]);
    const slot = dueSlot(at, where, done);
    const bank = slot ? await runBank(slot) : null;
    const morning = SLOTS[0];
    const curator = !curatorDone.includes(morning.kind) && localHour(at, where) >= morning.hour ? await runCurator(morning.kind) : null;
    return Response.json({ ran: slot, bank: bank?.ok ?? null, curator: curator?.ok ?? null });
  } catch (error) {
    return Response.json({ error: error instanceof DbUnavailable ? "Database is not connected" : "The agents are not set up" }, { status: 503 });
  }
}
