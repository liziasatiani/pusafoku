import { apiGuard } from "@/lib/auth";
import { DbUnavailable, rest } from "@/lib/server/db";
import { UUID } from "@/lib/server/input";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await apiGuard(request);
  if (denied) return denied;
  const { id } = await context.params;
  if (!UUID.test(id)) return Response.json({ error: "not found" }, { status: 404 });
  let done: unknown;
  try {
    done = ((await request.json()) as { done?: unknown }).done;
  } catch {
    done = undefined;
  }
  if (typeof done !== "boolean") return Response.json({ error: "done must be true or false" }, { status: 400 });
  try {
    await rest(`tasks?id=eq.${id}`, { method: "PATCH", body: { done, done_at: done ? new Date().toISOString() : null }, prefer: "return=minimal" });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof DbUnavailable ? "Database is not connected" : "Could not save" }, { status: 503 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await apiGuard(request);
  if (denied) return denied;
  const { id } = await context.params;
  if (!UUID.test(id)) return Response.json({ error: "not found" }, { status: 404 });
  try {
    await rest(`tasks?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof DbUnavailable ? "Database is not connected" : "Could not delete" }, { status: 503 });
  }
}
