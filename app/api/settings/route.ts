import { apiGuard } from "@/lib/auth";
import { DEFAULT_SETTINGS } from "@/lib/defaults";
import { DbUnavailable, rest } from "@/lib/server/db";
import { parseSettings } from "@/lib/server/settings-input";

type Row = { name: string; language: "en" | "ka"; city: string; latitude: number; longitude: number; time_zone: string; currency: string };

export async function GET(request: Request) {
  const denied = await apiGuard(request);
  if (denied) return denied;
  try {
    const [row] = await rest<Row[]>("settings?select=name,language,city,latitude,longitude,time_zone,currency&limit=1");
    if (!row) return Response.json({ ...DEFAULT_SETTINGS, latitude: 41.7151, longitude: 44.8271, editable: false });
    return Response.json({ name: row.name, language: row.language, city: row.city, latitude: Number(row.latitude), longitude: Number(row.longitude), timeZone: row.time_zone, currency: row.currency, editable: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof DbUnavailable) return Response.json({ ...DEFAULT_SETTINGS, latitude: 41.7151, longitude: 44.8271, editable: false });
    return Response.json({ error: "Could not read settings" }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const denied = await apiGuard(request);
  if (denied) return denied;
  let input = null;
  try {
    input = parseSettings(await request.json());
  } catch {
    input = null;
  }
  if (!input) return Response.json({ error: "Check the name, language, city, time zone and currency" }, { status: 400 });
  try {
    await rest("settings?id=eq.true", { method: "PATCH", body: { ...input, updated_at: new Date().toISOString() }, prefer: "return=minimal" });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof DbUnavailable ? "Database is not connected" : "Could not save" }, { status: 503 });
  }
}
