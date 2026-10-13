import "server-only";
import { googleConfig } from "@/lib/env";

export type MailItem = { id: string; sender: string; subject: string; at: string };
export type Mailbox = { unread: number; items: MailItem[] };

export class GoogleDenied extends Error {}

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const SHOWN = 8;
const KEEP_MS = 60_000;
const ID = /^[A-Za-z0-9_-]{6,64}$/;

let token: { value: string; until: number } | null = null;
let box: { at: number; value: Mailbox } | null = null;

export function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export function senderName(from: unknown): string {
  const text = cleanText(from, 200);
  const start = text.endsWith(">") ? text.lastIndexOf("<") : -1;
  if (start < 0) return text.slice(0, 60);
  const name = text.slice(0, start).trim().replace(/^"+|"+$/g, "").trim();
  return (name || text.slice(start + 1, -1)).slice(0, 60);
}

type Header = { name?: unknown; value?: unknown };
type Raw = { id?: unknown; internalDate?: unknown; payload?: { headers?: Header[] } };

export function toItem(raw: Raw): MailItem | null {
  if (typeof raw.id !== "string" || !ID.test(raw.id)) return null;
  const headers = Array.isArray(raw.payload?.headers) ? raw.payload.headers : [];
  const find = (name: string) => headers.find((h) => typeof h.name === "string" && h.name.toLowerCase() === name)?.value;
  const millis = Number(raw.internalDate);
  return {
    id: raw.id,
    sender: senderName(find("from")) || "?",
    subject: cleanText(find("subject"), 120),
    at: new Date(Number.isFinite(millis) && millis > 0 ? Math.min(millis, Date.now()) : Date.now()).toISOString(),
  };
}

async function accessToken(): Promise<string> {
  const config = googleConfig();
  if (!config) throw new GoogleDenied("not configured");
  if (token && Date.now() < token.until) return token.value;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: config.refreshToken, grant_type: "refresh_token" }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new GoogleDenied("sign-in refused");
  const json = (await res.json()) as { access_token?: unknown; expires_in?: unknown };
  if (typeof json.access_token !== "string") throw new GoogleDenied("sign-in refused");
  const seconds = typeof json.expires_in === "number" ? json.expires_in : 3000;
  token = { value: json.access_token, until: Date.now() + Math.max(60, seconds - 120) * 1000 };
  return json.access_token;
}

async function get(path: string): Promise<unknown> {
  const res = await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${await accessToken()}` }, cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (res.status === 401) {
    token = null;
    throw new GoogleDenied("sign-in refused");
  }
  if (!res.ok) throw new Error(`Gmail answered ${res.status}`);
  return res.json();
}

export async function readMailbox(): Promise<Mailbox> {
  if (box && Date.now() - box.at < KEEP_MS) return box.value;
  const [label, list] = await Promise.all([
    get("/labels/INBOX") as Promise<{ messagesUnread?: unknown }>,
    get(`/messages?labelIds=INBOX&labelIds=UNREAD&maxResults=${SHOWN}`) as Promise<{ messages?: { id?: unknown }[] }>,
  ]);
  const ids = (list.messages ?? []).map((m) => m.id).filter((id): id is string => typeof id === "string" && ID.test(id));
  const raws = await Promise.all(ids.map((id) => get(`/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`) as Promise<Raw>));
  const items = raws.map(toItem).filter((i): i is MailItem => i !== null);
  const unread = typeof label.messagesUnread === "number" && label.messagesUnread >= 0 ? label.messagesUnread : items.length;
  const value = { unread, items };
  box = { at: Date.now(), value };
  return value;
}
