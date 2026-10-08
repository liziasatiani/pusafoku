import { apiGuard } from "@/lib/auth";
import { loadModule } from "@/lib/server/modules";

const ID = /^[a-z]{2,20}$/;

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await apiGuard(request);
  if (denied) return denied;
  const { id } = await context.params;
  if (!ID.test(id)) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(await loadModule(id), { headers: { "cache-control": "no-store" } });
}
