import type { Period, ShopSummary } from "@/lib/shop-summary";

export function money(amount: number): string {
  return "₾ " + amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const orders = (count: number) => `${count} ${count === 1 ? "order" : "orders"}`;

const part = (label: string, period: Period) => `${label} ${money(period.revenue)} from ${orders(period.orders)}.`;

function dayOfMonth(at: number, zone: string): { day: number; days: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date(at));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { day: get("day"), days: new Date(Date.UTC(get("year"), get("month"), 0)).getUTCDate() };
}

export function bankReport(summary: ShopSummary, goal: number | undefined, at: number): { task: string; body: string } {
  const { today, week, month } = summary.periods;
  const { day, days } = dayOfMonth(at, summary.timeZone);
  const goalText = goal === undefined ? "Goal: not set." : `Goal: ${Math.round((month.revenue / goal) * 100)}% of ${money(goal)}, day ${day} of ${days}.`;
  const best = summary.bestSellers.length === 0 ? "—" : summary.bestSellers.slice(0, 3).map((b) => `${b.name} ×${b.units}`).join(", ");
  const average = month.averageOrder === null ? "—" : money(month.averageOrder);
  const body = [part("Today", today), part("Week", week), part("Month", month), `Average order ${average}.`, goalText, `Best sellers: ${best}.`].join(" ").slice(0, 500);
  return { task: "Report ready", body };
}
