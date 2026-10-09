import { apiGuard } from "@/lib/auth";
import { DbUnavailable, rest } from "@/lib/server/db";
import { readText } from "@/lib/server/input";
import { normalizeUrl } from "@/lib/server/monitor";

const MAX_FEEDS = 10;

export async function POST(request: Request) {
  const denied = await apiGuard(request);
  if (denied) return denied;
  const raw = await readText(request, "url", 500);
  const url = raw ? normalizeUrl(raw) : null;
  if (!url) return Response.json({ error: "Use a full https:// address of a public feed" }, { status: 400 });
  try {
    const existing = await rest<{ id: string }[]>("feeds?select=id");
    if (existing.length >= MAX_FEEDS) return Response.json({ error: `Limit is ${MAX_FEEDS} feeds` }, { status: 400 });
    const label = new URL(url).hostname.replace(/^www\./, "");
    await rest("feeds?on_conflict=url", { method: "POST", body: { url, label }, prefer: "resolution=ignore-duplicates,return=minimal" });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof DbUnavailable ? "Database is not connected" : "Could not save" }, { status: 503 });
  }
}
