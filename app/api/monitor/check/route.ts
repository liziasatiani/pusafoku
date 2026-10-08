import { apiGuard } from "@/lib/auth";
import { DbUnavailable } from "@/lib/server/db";
import { runChecks } from "@/lib/server/monitor";

export const maxDuration = 30;

export async function POST(request: Request) {
  const denied = await apiGuard(request);
  if (denied) return denied;
  try {
    return Response.json({ checked: await runChecks() });
  } catch (error) {
    return Response.json({ error: error instanceof DbUnavailable ? "Database is not connected" : "Check failed" }, { status: 503 });
  }
}
