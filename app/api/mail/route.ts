import { mailToken } from "@/lib/env";
import { bearerMatches } from "@/lib/server/bearer";
import { DbUnavailable } from "@/lib/server/db";
import { allow } from "@/lib/server/limit";
import { parseMail, saveMail } from "@/lib/server/mail-sync";

const MAX_BODY = 32_000;

export async function POST(request: Request) {
  const secret = mailToken();
  if (!secret) return Response.json({ error: "Mail sync is not configured" }, { status: 503 });
  if (!allow("mail-sync", 30, 60_000)) return Response.json({ error: "Too many requests" }, { status: 429 });
  if (!bearerMatches(request, secret)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const raw = await request.text();
  if (raw.length > MAX_BODY) return Response.json({ error: "Body too large" }, { status: 413 });
  let box = null;
  try {
    box = parseMail(JSON.parse(raw), Date.now());
  } catch {
    box = null;
  }
  if (!box) return Response.json({ error: "Send unread (a whole number) and up to 8 items with id, from, subject and at" }, { status: 400 });
  try {
    await saveMail(box);
    return Response.json({ saved: box.items.length });
  } catch (error) {
    return Response.json({ error: error instanceof DbUnavailable ? "Database is not connected" : "Could not save" }, { status: 503 });
  }
}
