import { apiGuard } from "@/lib/auth";
import { DbUnavailable, rest } from "@/lib/server/db";
import { readText } from "@/lib/server/input";

export async function POST(request: Request) {
  const denied = await apiGuard(request);
  if (denied) return denied;
  const title = await readText(request, "title", 300);
  if (!title) return Response.json({ error: "Title must be 1 to 300 characters" }, { status: 400 });
  try {
    await rest("tasks", { method: "POST", body: { title }, prefer: "return=minimal" });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof DbUnavailable ? "Database is not connected" : "Could not save" }, { status: 503 });
  }
}
