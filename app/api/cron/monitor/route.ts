import { timingSafeEqual } from "node:crypto";
import { cronSecret } from "@/lib/env";
import { DbUnavailable } from "@/lib/server/db";
import { runChecks } from "@/lib/server/monitor";

function authorized(request: Request, secret: string): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  const secret = cronSecret();
  if (!secret) return Response.json({ error: "Cron is not configured" }, { status: 503 });
  if (!authorized(request, secret)) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    return Response.json({ checked: await runChecks() });
  } catch (error) {
    return Response.json({ error: error instanceof DbUnavailable ? "Database is not connected" : "Check failed" }, { status: 503 });
  }
}
