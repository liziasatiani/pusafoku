import { cookies } from "next/headers";
import { checkPassword } from "@/lib/password";
import { passwordHash, sessionSecret } from "@/lib/env";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "@/lib/session";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;
const attempts = new Map<string, { count: number; first: number }>();

function clientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

function tooMany(key: string, now: number): boolean {
  const entry = attempts.get(key);
  if (!entry || now - entry.first > WINDOW_MS) return false;
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(key: string, now: number): void {
  const entry = attempts.get(key);
  if (!entry || now - entry.first > WINDOW_MS) attempts.set(key, { count: 1, first: now });
  else entry.count += 1;
}

export async function POST(request: Request) {
  const secret = sessionSecret();
  if (!secret || !passwordHash()) {
    return Response.json({ error: "Login is not configured. Set the password hash and session secret." }, { status: 503 });
  }
  const now = Date.now();
  const key = clientKey(request);
  if (tooMany(key, now)) {
    return Response.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }
  let password = "";
  try {
    const body = (await request.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  if (!checkPassword(password, passwordHash())) {
    recordFailure(key, now);
    await new Promise((resolve) => setTimeout(resolve, 400));
    return Response.json({ error: "Wrong password" }, { status: 401 });
  }
  attempts.delete(key);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return Response.json({ ok: true });
}
