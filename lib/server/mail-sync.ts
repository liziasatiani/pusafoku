import "server-only";
import { cleanText, senderName, type MailItem, type Mailbox } from "@/lib/server/gmail";
import { rest } from "@/lib/server/db";

export const MAX_ITEMS = 8;
export const STALE_MS = 45 * 60_000;
const ID = /^[A-Za-z0-9_-]{6,64}$/;

export function parseMail(body: unknown, now: number): Mailbox | null {
  if (typeof body !== "object" || body === null) return null;
  const { unread, items } = body as Record<string, unknown>;
  if (typeof unread !== "number" || !Number.isInteger(unread) || unread < 0 || unread > 999_999) return null;
  if (!Array.isArray(items) || items.length > MAX_ITEMS) return null;
  const parsed: MailItem[] = [];
  for (const row of items) {
    if (typeof row !== "object" || row === null) return null;
    const { id, from, subject, at } = row as Record<string, unknown>;
    if (typeof id !== "string" || !ID.test(id) || typeof from !== "string" || typeof subject !== "string" || typeof at !== "number" || !Number.isFinite(at)) return null;
    parsed.push({ id, sender: senderName(from) || "?", subject: cleanText(subject, 120), at: new Date(at > 0 ? Math.min(at, now) : now).toISOString() });
  }
  return { unread, items: parsed };
}

export async function saveMail(box: Mailbox): Promise<void> {
  await rest("mail_snapshot?on_conflict=id", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: { id: true, unread: box.unread, items: box.items, updated_at: new Date().toISOString() } });
}

export async function readSnapshot(): Promise<{ box: Mailbox; age: number } | null> {
  try {
    const [row] = await rest<{ unread: number; items: MailItem[]; updated_at: string }[]>("mail_snapshot?select=unread,items,updated_at&limit=1");
    if (!row) return null;
    return { box: { unread: row.unread, items: row.items }, age: Date.now() - Date.parse(row.updated_at) };
  } catch {
    return null;
  }
}
