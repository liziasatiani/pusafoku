import { apiGuard } from "@/lib/auth";
import { parseShift, shiftDay } from "@/lib/server/calendar-input";
import { DbUnavailable, rest } from "@/lib/server/db";

type Row = { id: string; day: string; until: string; skip: string[] };

export async function POST(request: Request) {
  const denied = await apiGuard(request);
  if (denied) return denied;
  let weeks: number | null = null;
  try {
    weeks = parseShift(await request.json());
  } catch {
    weeks = null;
  }
  if (weeks === null) return Response.json({ error: "Use a whole number of weeks from 1 to 60" }, { status: 400 });
  try {
    const rows = await rest<Row[]>("events?select=id,day,until,skip&repeat=eq.weekly&until=not.is.null&limit=500");
    for (const row of rows) {
      await rest(`events?id=eq.${row.id}`, { method: "PATCH", body: { day: shiftDay(row.day, weeks), until: shiftDay(row.until, weeks), skip: row.skip.map((d) => shiftDay(d, weeks)) }, prefer: "return=minimal" });
    }
    return Response.json({ moved: rows.length });
  } catch (error) {
    return Response.json({ error: error instanceof DbUnavailable ? "Database is not connected" : "Could not save" }, { status: 503 });
  }
}
