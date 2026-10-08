import "server-only";

export async function readText(request: Request, field: string, max: number): Promise<string | null> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const value = body[field];
    if (typeof value !== "string") return null;
    const text = value.trim();
    return text.length >= 1 && text.length <= max ? text : null;
  } catch {
    return null;
  }
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
