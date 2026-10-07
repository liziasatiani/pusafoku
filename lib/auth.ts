import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionSecret } from "@/lib/env";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export async function hasSession(): Promise<boolean> {
  const jar = await cookies();
  return verifySession(sessionSecret(), jar.get(SESSION_COOKIE)?.value);
}

export async function requireSession(): Promise<void> {
  if (!(await hasSession())) redirect("/login");
}

export async function apiGuard(request: Request): Promise<Response | null> {
  if (!(await hasSession())) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (request.method !== "GET" && request.method !== "HEAD") {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (!origin || !host || new URL(origin).host !== host) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
  }
  return null;
}
