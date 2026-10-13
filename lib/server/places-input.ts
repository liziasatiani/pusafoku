import "server-only";

export type PlaceInput = { name: string; latitude: number; longitude: number };

export const MAX_PLACES = 100;

export function parsePlace(body: unknown): PlaceInput | null {
  if (typeof body !== "object" || body === null) return null;
  const { name, latitude, longitude } = body as Record<string, unknown>;
  if (typeof name !== "string" || /[\u0000-\u001f]/.test(name)) return null;
  const label = name.trim();
  if (label.length < 1 || label.length > 60) return null;
  if (typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  return { name: label, latitude: Math.round(latitude * 10000) / 10000, longitude: Math.round(longitude * 10000) / 10000 };
}
