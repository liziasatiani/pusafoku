import "server-only";
import { supabaseConfig } from "@/lib/env";

export class DbUnavailable extends Error {}

export async function rest<T>(path: string, init: { method?: string; body?: unknown; prefer?: string } = {}): Promise<T> {
  const config = supabaseConfig();
  if (!config) throw new DbUnavailable("Database is not connected");
  const res = await fetch(`${config.url}/rest/v1/${path}`, {
    method: init.method ?? "GET",
    headers: {
      apikey: config.key,
      authorization: `Bearer ${config.key}`,
      "content-type": "application/json",
      prefer: init.prefer ?? "return=representation",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Database request failed (${res.status})`);
  const text = await res.text();
  return (text ? JSON.parse(text) : []) as T;
}

export function dbConfigured(): boolean {
  return supabaseConfig() !== undefined;
}
