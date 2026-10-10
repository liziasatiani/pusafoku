import { apiGuard } from "@/lib/auth";
import { DbUnavailable, rest } from "@/lib/server/db";
import { UUID } from "@/lib/server/input";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await apiGuard(request);
  if (denied) return denied;
  const { id } = await context.params;
  if (!UUID.test(id)) return Response.json({ error: "not found" }, { status: 404 });
  try {
    await rest(`events?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof DbUnavailable ? "Database is not connected" : "Could not delete" }, { status: 503 });
  }
}
