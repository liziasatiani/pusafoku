import "server-only";
import { normalizeUrl, reachesPublicHost } from "@/lib/server/monitor";

const MAX_BYTES = 1_000_000;
const MAX_HOPS = 3;
const TIMEOUT_MS = 8000;

export async function fetchPublicText(start: string): Promise<string | null> {
  let url = normalizeUrl(start);
  for (let hop = 0; url && hop <= MAX_HOPS; hop++) {
    if (!(await reachesPublicHost(new URL(url).hostname))) return null;
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "user-agent": "pusafoku-reader", accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9" },
        cache: "no-store",
      });
    } catch {
      return null;
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      await res.body?.cancel();
      url = location ? normalizeUrl(new URL(location, url).toString()) : null;
      continue;
    }
    if (!res.ok || !res.body) return null;
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    return new TextDecoder().decode(Buffer.concat(chunks));
  }
  return null;
}
