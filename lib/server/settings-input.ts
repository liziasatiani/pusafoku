import "server-only";

export const CURRENCIES = ["GEL", "USD", "EUR", "GBP"];

export type SettingsInput = { name: string; language: "en" | "ka"; city: string; latitude: number; longitude: number; time_zone: string; currency: string };

function validZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export function parseSettings(body: unknown): SettingsInput | null {
  if (typeof body !== "object" || body === null) return null;
  const { name, language, city, latitude, longitude, timeZone, currency } = body as Record<string, unknown>;
  if (typeof name !== "string" || name.trim().length < 1 || name.trim().length > 40) return null;
  if (language !== "en" && language !== "ka") return null;
  if (typeof city !== "string" || city.trim().length < 1 || city.trim().length > 80) return null;
  if (typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  if (typeof timeZone !== "string" || timeZone.length > 60 || !validZone(timeZone)) return null;
  if (typeof currency !== "string" || !CURRENCIES.includes(currency)) return null;
  return { name: name.trim(), language, city: city.trim(), latitude: Math.round(latitude * 1e5) / 1e5, longitude: Math.round(longitude * 1e5) / 1e5, time_zone: timeZone, currency };
}

export type Place = { city: string; country: string; latitude: number; longitude: number; timeZone: string };

export async function findPlaces(query: string): Promise<Place[] | null> {
  const params = new URLSearchParams({ name: query, count: "5", language: "en", format: "json" });
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { results?: { name: string; country?: string; latitude: number; longitude: number; timezone?: string }[] };
    return (json.results ?? [])
      .filter((r) => typeof r.timezone === "string" && validZone(r.timezone))
      .map((r) => ({ city: String(r.name).slice(0, 80), country: String(r.country ?? "").slice(0, 80), latitude: r.latitude, longitude: r.longitude, timeZone: r.timezone as string }));
  } catch {
    return null;
  }
}
