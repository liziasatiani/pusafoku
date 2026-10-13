import { apiGuard } from "@/lib/auth";
import { mergeSkipped, parseBreak } from "@/lib/server/calendar-input";
import { DbUnavailable, rest } from "@/lib/server/db";

type Row = { id: string; skip: string[] };

const CLASSES = "events?select=id,skip&repeat=eq.weekly&until=not.is.null&limit=500";

export async function POST(request: Request) {
  const denied = await apiGuard(request);
  if (denied) return denied;
  let gap = null;
  try {
    gap = parseBreak(await request.json());
  } catch {
    gap = null;
  }
  if (!gap) return Response.json({ error: "Pick a first and a last day, up to 62 days apart" }, { status: 400 });
  try {
    const rows = await rest<Row[]>(CLASSES);
    for (const row of rows) {
      await rest(`events?id=eq.${row.id}`, { method: "PATCH", body: { skip: mergeSkipped(row.skip, gap.days) }, prefer: "return=minimal" });
    }
    return Response.json({ classes: rows.length, days: gap.days.length });
  } catch (error) {
    return Response.json({ error: error instanceof DbUnavailable ? "Database is not connected" : "Could not save" }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const denied = await apiGuard(request);
  if (denied) return denied;
  try {
    const rows = await rest<Row[]>(CLASSES);
    for (const row of rows) {
      if (row.skip.length > 0) await rest(`events?id=eq.${row.id}`, { method: "PATCH", body: { skip: [] }, prefer: "return=minimal" });
    }
    return Response.json({ classes: rows.length });
  } catch (error) {
    return Response.json({ error: error instanceof DbUnavailable ? "Database is not connected" : "Could not save" }, { status: 503 });
  }
}
