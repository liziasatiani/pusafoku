import { apiGuard } from "@/lib/auth";
import { DbUnavailable, rest } from "@/lib/server/db";
import { readText } from "@/lib/server/input";
import { MAX_SITES, normalizeUrl, siteCount } from "@/lib/server/monitor";

export async function POST(request: Request) {
  const denied = await apiGuard(request);
  if (denied) return denied;
  const raw = await readText(request, "url", 500);
  const url = raw ? normalizeUrl(raw) : null;
  if (!url) return Response.json({ error: "Use a full https:// address of a public website" }, { status: 400 });
  try {
    if ((await siteCount()) >= MAX_SITES) return Response.json({ error: `Limit is ${MAX_SITES} websites` }, { status: 400 });
    await rest("monitor_sites?on_conflict=url", { method: "POST", body: { url }, prefer: "resolution=ignore-duplicates,return=minimal" });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof DbUnavailable ? "Database is not connected" : "Could not save" }, { status: 503 });
  }
}
