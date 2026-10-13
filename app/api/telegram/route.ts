import { telegramOwner, telegramSecret } from "@/lib/env";
import { headerMatches } from "@/lib/server/bearer";
import { DbUnavailable, rest } from "@/lib/server/db";
import { allow } from "@/lib/server/limit";
import { parseUpdate } from "@/lib/server/telegram-input";

const MAX_BODY = 20_000;
const KEEP_DAYS = 30;

function clientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function POST(request: Request) {
  const secret = telegramSecret();
  const owner = telegramOwner();
  if (!secret || !owner) return Response.json({ error: "Telegram is not configured" }, { status: 503 });
  if (!allow(`telegram:${clientKey(request)}`, 120, 60_000)) return Response.json({ error: "Too many requests" }, { status: 429 });
  if (!headerMatches(request, "x-telegram-bot-api-secret-token", secret)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const raw = await request.text();
  if (raw.length > MAX_BODY) return Response.json({ error: "Body too large" }, { status: 413 });
  let message = null;
  try {
    message = parseUpdate(JSON.parse(raw), owner);
  } catch {
    message = null;
  }
  if (!message) return Response.json({ ok: true });
  try {
    await rest("messages", { method: "POST", body: { channel: "telegram", sender: message.sender, body: message.body, received_at: message.at }, prefer: "return=minimal" });
    const cutoff = new Date(Date.now() - KEEP_DAYS * 86400000).toISOString();
    await rest(`messages?received_at=lt.${encodeURIComponent(cutoff)}`, { method: "DELETE", prefer: "return=minimal" });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof DbUnavailable ? "Database is not connected" : "Could not save" }, { status: 503 });
  }
}
