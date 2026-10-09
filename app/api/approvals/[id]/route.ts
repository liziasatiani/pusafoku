import { apiGuard } from "@/lib/auth";
import { DbUnavailable, rest } from "@/lib/server/db";
import { UUID } from "@/lib/server/input";

type Row = { id: string; title: string };

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await apiGuard(request);
  if (denied) return denied;
  const { id } = await context.params;
  if (!UUID.test(id)) return Response.json({ error: "not found" }, { status: 404 });
  let body: { action?: unknown; draft?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  try {
    if (body.action === "edit") {
      if (typeof body.draft !== "string" || body.draft.length > 8000) return Response.json({ error: "Draft must be up to 8000 characters" }, { status: 400 });
      const rows = await rest<Row[]>(`approvals?id=eq.${id}&status=eq.pending&select=id,title`, { method: "PATCH", body: { draft: body.draft } });
      if (rows.length === 0) return Response.json({ error: "Item is no longer waiting" }, { status: 409 });
      return Response.json({ ok: true });
    }
    if (body.action !== "approve" && body.action !== "reject") return Response.json({ error: "action must be approve, reject or edit" }, { status: 400 });
    const status = body.action === "approve" ? "approved" : "rejected";
    const rows = await rest<Row[]>(`approvals?id=eq.${id}&status=eq.pending&select=id,title`, { method: "PATCH", body: { status, decided_at: new Date().toISOString() } });
    if (rows.length === 0) return Response.json({ error: "Item is no longer waiting" }, { status: 409 });
    await rest("audit_log", { method: "POST", body: { action: `approval.${status}`, detail: { id: rows[0].id, title: rows[0].title } }, prefer: "return=minimal" });
    return Response.json({ ok: true, status });
  } catch (error) {
    return Response.json({ error: error instanceof DbUnavailable ? "Database is not connected" : "Could not save" }, { status: 503 });
  }
}
