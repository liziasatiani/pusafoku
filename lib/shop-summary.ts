export type Period = { revenue: number; orders: number; averageOrder: number | null };

export type ShopSummary = {
  generatedAt: string;
  timeZone: string;
  currency: string;
  periods: { today: Period; week: Period; month: Period };
  bestSellers: { name: string; units: number; revenue: number }[];
};

const isAmount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

function parsePeriod(value: unknown): Period | null {
  if (typeof value !== "object" || value === null) return null;
  const { revenue, orders, averageOrder } = value as Record<string, unknown>;
  if (!isAmount(revenue) || !isAmount(orders) || !Number.isInteger(orders)) return null;
  if (averageOrder !== null && !isAmount(averageOrder)) return null;
  return { revenue, orders, averageOrder };
}

function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  return text.length > 0 ? text : null;
}

export function parseSummary(json: unknown): ShopSummary | null {
  if (typeof json !== "object" || json === null) return null;
  const { generatedAt, timeZone, currency, periods, bestSellers } = json as Record<string, unknown>;
  if (typeof generatedAt !== "string" || Number.isNaN(Date.parse(generatedAt))) return null;
  if (typeof timeZone !== "string" || typeof currency !== "string" || currency !== "GEL") return null;
  try {
    new Intl.DateTimeFormat("en", { timeZone });
  } catch {
    return null;
  }
  if (typeof periods !== "object" || periods === null || !Array.isArray(bestSellers)) return null;
  const { today, week, month } = periods as Record<string, unknown>;
  const parsed = { today: parsePeriod(today), week: parsePeriod(week), month: parsePeriod(month) };
  if (!parsed.today || !parsed.week || !parsed.month) return null;
  const best: ShopSummary["bestSellers"] = [];
  for (const row of bestSellers.slice(0, 5)) {
    if (typeof row !== "object" || row === null) return null;
    const { name, units, revenue } = row as Record<string, unknown>;
    const label = cleanName(name);
    if (!label || !isAmount(units) || !isAmount(revenue)) return null;
    best.push({ name: label, units, revenue });
  }
  return { generatedAt, timeZone, currency, periods: { today: parsed.today, week: parsed.week, month: parsed.month }, bestSellers: best };
}
