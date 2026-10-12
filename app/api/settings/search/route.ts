import { apiGuard } from "@/lib/auth";
import { allow } from "@/lib/server/limit";
import { findPlaces } from "@/lib/server/settings-input";

export async function GET(request: Request) {
  const denied = await apiGuard(request);
  if (denied) return denied;
  if (!allow("places", 20, 60_000)) return Response.json({ error: "Too many searches. Wait a minute." }, { status: 429 });
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 80) return Response.json({ error: "Type at least 2 letters" }, { status: 400 });
  const places = await findPlaces(q);
  if (places === null) return Response.json({ error: "The place search is not reachable right now" }, { status: 503 });
  return Response.json({ places });
}
