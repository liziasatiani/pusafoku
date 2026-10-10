import { apiGuard } from "@/lib/auth";
import { calendarAddress } from "@/lib/server/calendar-input";
import { DbUnavailable, rest } from "@/lib/server/db";
import { readText } from "@/lib/server/input";

const MAX_SOURCES = 5;

export async function POST(request: Request) {
  const denied = await apiGuard(request);
  if (denied) return denied;
  const raw = await readText(request, "url", 1200);
  const url = raw ? calendarAddress(raw) : null;
  if (!url) return Response.json({ error: "Paste the full calendar address, starting with https:// or webcal://" }, { status: 400 });
  try {
    const existing = await rest<{ id: string }[]>("calendar_sources?select=id");
    if (existing.length >= MAX_SOURCES) return Response.json({ error: `Limit is ${MAX_SOURCES} calendars` }, { status: 400 });
    const label = new URL(url).hostname.replace(/^www\./, "");
    await rest("calendar_sources?on_conflict=url", { method: "POST", body: { url, label }, prefer: "resolution=ignore-duplicates,return=minimal" });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof DbUnavailable ? "Database is not connected" : "Could not save" }, { status: 503 });
  }
}
