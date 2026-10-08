import { apiGuard } from "@/lib/auth";
import { DbUnavailable, rest } from "@/lib/server/db";
import { readText } from "@/lib/server/input";

export async function POST(request: Request) {
  const denied = await apiGuard(request);
  if (denied) return denied;
  const body = await readText(request, "text", 4000);
  if (!body) return Response.json({ error: "Note must be 1 to 4000 characters" }, { status: 400 });
  try {
    await rest("notes", { method: "POST", body: { body }, prefer: "return=minimal" });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof DbUnavailable ? "Database is not connected" : "Could not save" }, { status: 503 });
  }
}
