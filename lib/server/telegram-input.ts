import "server-only";

export type IncomingMessage = { sender: string; body: string; at: string };

const MAX_BODY = 1000;
const MAX_SENDER = 80;

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function origin(message: Record<string, unknown>): string {
  const forwarded = message.forward_origin;
  if (typeof forwarded !== "object" || forwarded === null) return "";
  const f = forwarded as Record<string, unknown>;
  const user = typeof f.sender_user === "object" && f.sender_user !== null ? (f.sender_user as Record<string, unknown>) : null;
  const chat = typeof f.chat === "object" && f.chat !== null ? (f.chat as Record<string, unknown>) : null;
  const name = user ? [clean(user.first_name, 40), clean(user.last_name, 40)].filter(Boolean).join(" ") : "";
  return clean(name || f.sender_user_name || chat?.title, MAX_SENDER);
}

export function parseUpdate(body: unknown, owner: string): IncomingMessage | null {
  if (typeof body !== "object" || body === null) return null;
  const message = (body as Record<string, unknown>).message;
  if (typeof message !== "object" || message === null) return null;
  const m = message as Record<string, unknown>;
  const from = typeof m.from === "object" && m.from !== null ? (m.from as Record<string, unknown>) : null;
  if (!from || typeof from.id !== "number" || String(from.id) !== owner) return null;
  if (typeof m.chat !== "object" || m.chat === null || (m.chat as Record<string, unknown>).type !== "private") return null;
  const text = clean(m.text ?? m.caption, MAX_BODY);
  if (!text) return null;
  const seconds = typeof m.date === "number" && Number.isFinite(m.date) ? m.date : Date.now() / 1000;
  const at = new Date(Math.min(seconds * 1000, Date.now())).toISOString();
  return { sender: origin(m) || "Me", body: text, at };
}
