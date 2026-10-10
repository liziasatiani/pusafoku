import { apiGuard } from "@/lib/auth";
import { parseEvent } from "@/lib/server/calendar-input";
import { DbUnavailable, rest } from "@/lib/server/db";

const MAX_EVENTS = 500;

export async function POST(request: Request) {
  const denied = await apiGuard(request);
  if (denied) return denied;
  let event = null;
  try {
    event = parseEvent(await request.json());
  } catch {
    event = null;
  }
  if (!event) return Response.json({ error: "Check the title, date, times and repeat" }, { status: 400 });
  try {
    const existing = await rest<{ id: string }[]>(`events?select=id&limit=${MAX_EVENTS}`);
    if (existing.length >= MAX_EVENTS) return Response.json({ error: `Limit is ${MAX_EVENTS} events` }, { status: 400 });
    await rest("events", { method: "POST", body: event, prefer: "return=minimal" });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof DbUnavailable ? "Database is not connected" : "Could not save" }, { status: 503 });
  }
}
