import { cookies } from "next/headers";
import { apiGuard } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST(request: Request) {
  const denied = await apiGuard(request);
  if (denied) return denied;
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
