import { apiGuard } from "@/lib/auth";
import { DbUnavailable, rest } from "@/lib/server/db";
import { MAX_PLACES, parsePlace } from "@/lib/server/places-input";

export async function POST(request: Request) {
  const denied = await apiGuard(request);
  if (denied) return denied;
  let place = null;
  try {
    place = parsePlace(await request.json());
  } catch {
    place = null;
  }
  if (!place) return Response.json({ error: "Check the place name and position" }, { status: 400 });
  try {
    const existing = await rest<{ id: string }[]>(`places?select=id&limit=${MAX_PLACES}`);
    if (existing.length >= MAX_PLACES) return Response.json({ error: `Limit is ${MAX_PLACES} places` }, { status: 400 });
    await rest("places", { method: "POST", body: place, prefer: "return=minimal" });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof DbUnavailable ? "Database is not connected" : "Could not save" }, { status: 503 });
  }
}
