import { inboxToken } from "@/lib/env";
import { bearerMatches } from "@/lib/server/bearer";
import { DbUnavailable, rest } from "@/lib/server/db";
import { allow } from "@/lib/server/limit";

const MAX_BODY = 16_000;
const MAX_PENDING = 200;

type Fields = { title: string; source: string; draft: string };

function clientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

function gate(request: Request): Response | null {
  const secret = inboxToken();
  if (!secret) return Response.json({ error: "Inbox is not configured" }, { status: 503 });
  if (!allow(`inbox:${clientKey(request)}`, 60, 60_000)) return Response.json({ error: "Too many requests" }, { status: 429 });
  if (!bearerMatches(request, secret)) return Response.json({ error: "unauthorized" }, { status: 401 });
  return null;
}

function parse(body: unknown): Fields | null {
  if (typeof body !== "object" || body === null) return null;
  const { title, source, draft } = body as Record<string, unknown>;
  if (typeof title !== "string" || title.trim().length < 1 || title.length > 300) return null;
  if (source !== undefined && (typeof source !== "string" || source.length > 80)) return null;
  if (draft !== undefined && (typeof draft !== "string" || draft.length > 8000)) return null;
  return { title: title.trim(), source: (source as string | undefined)?.trim() || "api", draft: (draft as string | undefined) ?? "" };
}

export async function POST(request: Request) {
  const blocked = gate(request);
  if (blocked) return blocked;
  const raw = await request.text();
  if (raw.length > MAX_BODY) return Response.json({ error: "Body too large" }, { status: 413 });
  let fields: Fields | null = null;
  try {
    fields = parse(JSON.parse(raw));
  } catch {
    fields = null;
  }
  if (!fields) return Response.json({ error: "Send title (1 to 300 chars), optional source (80) and draft (8000)" }, { status: 400 });
  try {
    const pending = await rest<{ id: string }[]>(`approvals?select=id&status=eq.pending&limit=${MAX_PENDING}`);
    if (pending.length >= MAX_PENDING) return Response.json({ error: "Too many items waiting" }, { status: 429 });
    const [row] = await rest<{ id: string }[]>("approvals", { method: "POST", body: fields });
    return Response.json({ id: row.id, status: "pending" }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof DbUnavailable ? "Database is not connected" : "Could not save" }, { status: 503 });
  }
}

export async function GET(request: Request) {
  const blocked = gate(request);
  if (blocked) return blocked;
  try {
    const rows = await rest<{ id: string; title: string; source: string; draft: string; decided_at: string }[]>(
      "approvals?select=id,title,source,draft,decided_at&status=eq.approved&order=decided_at.desc&limit=50",
    );
    return Response.json({ approved: rows }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof DbUnavailable ? "Database is not connected" : "Could not read" }, { status: 503 });
  }
}
