import { apiGuard } from "@/lib/auth";
import { DbUnavailable, rest } from "@/lib/server/db";

export async function POST(request: Request) {
  const denied = await apiGuard(request);
  if (denied) return denied;
  try {
    await rest("messages?read=eq.false", { method: "PATCH", body: { read: true }, prefer: "return=minimal" });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof DbUnavailable ? "Database is not connected" : "Could not save" }, { status: 503 });
  }
}
