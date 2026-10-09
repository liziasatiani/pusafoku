import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const OPEN_PAGES = new Set(["/login"]);
const OPEN_API = [
  { path: "/api/auth/login", methods: ["POST"] },
  { path: "/api/inbox", methods: ["POST", "GET"] },
];

function isOpenApi(pathname: string, method: string): boolean {
  if (pathname.startsWith("/api/cron/")) return true;
  return OPEN_API.some((rule) => rule.path === pathname && rule.methods.includes(method));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");
  if (isApi ? isOpenApi(pathname, request.method) : OPEN_PAGES.has(pathname)) {
    return NextResponse.next();
  }
  const ok = await verifySession(process.env.PUSAFOKU_SESSION_SECRET, request.cookies.get(SESSION_COOKIE)?.value);
  if (ok) return NextResponse.next();
  if (isApi) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
