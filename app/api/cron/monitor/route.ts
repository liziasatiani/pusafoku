import { cronSecret } from "@/lib/env";
import { bearerMatches } from "@/lib/server/bearer";
import { DbUnavailable } from "@/lib/server/db";
import { runChecks } from "@/lib/server/monitor";

export async function GET(request: Request) {
  const secret = cronSecret();
  if (!secret) return Response.json({ error: "Cron is not configured" }, { status: 503 });
  if (!bearerMatches(request, secret)) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    return Response.json({ checked: await runChecks() });
  } catch (error) {
    return Response.json({ error: error instanceof DbUnavailable ? "Database is not connected" : "Check failed" }, { status: 503 });
  }
}
