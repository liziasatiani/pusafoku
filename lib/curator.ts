import { dayOfMonth, money } from "@/lib/bank";
import type { ShopSummary } from "@/lib/shop-summary";

export type CuratorInput = { summary: ShopSummary | null; goal: number | undefined; at: number; pending: number; tasks: string[] };

const orders = (count: number) => `${count} ${count === 1 ? "order" : "orders"}`;

const short = (text: string) => (text.length > 80 ? `${text.slice(0, 79)}…` : text);

function shopLines(input: CuratorInput): { goal: string | null; activity: string } {
  const { summary, goal, at } = input;
  if (!summary) return { goal: null, activity: "The shop numbers could not be read today." };
  const { today, month } = summary.periods;
  const best = summary.bestSellers[0]?.name;
  let goalLine: string | null = null;
  if (goal !== undefined) {
    const { day, days } = dayOfMonth(at, summary.timeZone);
    if (month.revenue < (goal * day) / days) goalLine = `Behind the monthly goal: ${money(month.revenue)} of ${money(goal)}, day ${day} of ${days}.`;
  }
  if (month.orders === 0) return { goal: goalLine, activity: "No paid orders this month yet. Pick one product and promote it today." };
  if (today.orders === 0) return { goal: goalLine, activity: best ? `No orders yet today. Promote ${best} again.` : "No orders yet today." };
  return { goal: goalLine, activity: `${orders(today.orders)} so far today, ${money(today.revenue)}.${best ? ` Keep ${best} visible.` : ""}` };
}

export function priorities(input: CuratorInput): string[] {
  const shop = shopLines(input);
  const lines: (string | null)[] = [
    input.pending > 0 ? `Decide ${input.pending} waiting ${input.pending === 1 ? "item" : "items"} in Authorizations.` : null,
    shop.goal,
    input.tasks[0] ? `Finish: ${short(input.tasks[0])}` : null,
    shop.activity,
    input.tasks[1] ? `Finish: ${short(input.tasks[1])}` : null,
  ];
  const picked = lines.filter((l): l is string => l !== null).slice(0, 3);
  return picked.length > 0 ? picked : ["Nothing urgent today. Plan tomorrow."];
}

export function curatorReport(input: CuratorInput): { task: string; body: string } {
  const body = `Today's priorities. ${priorities(input).map((line, i) => `${i + 1}. ${line}`).join(" ")}`.slice(0, 500);
  return { task: "Priorities set", body };
}
