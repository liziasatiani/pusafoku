"use client";

import { useEffect, useState } from "react";
import AddForm from "@/components/hud/AddForm";
import Panel from "@/components/hud/Panel";
import styles from "@/components/hud/hud.module.css";
import more from "@/components/hud/today.module.css";
import { useLang, useTr } from "@/components/hud/lang";
import type { Tr } from "@/lib/i18n";
import { buildPlan, clockText, durationText, type Plan, type PlanItem } from "@/lib/plan";
import type { ModuleDef, PanelProps } from "@/modules/types";

export type Data = {
  timeZone: string;
  events: { time: string; end: string; title: string; place: string }[] | null;
  tasks: { id: string; title: string; done: boolean }[] | null;
  weather: { condition: string; tempC: number; highC: number; lowC: number } | null;
  unread: number | null;
  editable: boolean;
};

function minutesNow(timeZone: string, at: Date): number {
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(at).split(":").map(Number);
  return (h % 24) * 60 + m;
}

function planFor(data: Data, now: number): Plan {
  const open = (data.tasks ?? []).filter((t) => !t.done).map((t) => t.title);
  return buildPlan(data.events ?? [], open, now);
}

async function toggle(id: string, done: boolean, refresh?: () => void) {
  try {
    await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ done }) });
  } finally {
    refresh?.();
  }
}

function headline(plan: Plan, now: number, tr: Tr): string {
  const current = plan.items.find((i) => i.kind === "event" && i.now);
  if (current) return tr("Now: {title}, until {time}", { title: (current as Extract<PlanItem, { kind: "event" }>).title, time: clockText(current.end) });
  const next = plan.items.find((i) => i.kind === "event" && i.start > now);
  if (next) return tr("Next: {title} at {time}, in {left}", { title: (next as Extract<PlanItem, { kind: "event" }>).title, time: clockText(next.start), left: durationText(next.start - now) });
  return tr("Nothing more is scheduled today.");
}

function ModulePanel({ result, refresh }: PanelProps<Data>) {
  const tr = useTr();
  const lang = useLang();
  const [at, setAt] = useState<Date | null>(null);
  useEffect(() => {
    setAt(new Date());
    const id = setInterval(() => setAt(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (result.status !== "ok") {
    return <Panel title="Today" status={result.status} hint={result.status === "not_connected" ? result.hint : undefined} message={result.status === "error" ? result.message : undefined} />;
  }
  const data = result.data;
  if (!at) return <Panel title="Today" />;
  const now = minutesNow(data.timeZone, at);
  const plan = planFor(data, now);
  const date = new Intl.DateTimeFormat(lang === "ka" ? "ka-GE" : "en-GB", { timeZone: data.timeZone, weekday: "long", day: "numeric", month: "long" }).format(at);
  const open = (data.tasks ?? []).filter((t) => !t.done);
  const done = (data.tasks ?? []).filter((t) => t.done);
  return (
    <Panel title="Today">
      <p className={styles.sub}>{date}</p>
      <p className={more.headline}>{headline(plan, now, tr)}</p>
      <p className={styles.meta}>
        {data.weather ? `${tr(data.weather.condition)} ${Math.round(data.weather.tempC)}° (${Math.round(data.weather.lowC)}° / ${Math.round(data.weather.highC)}°)` : tr("Weather is not available.")}
        {data.unread !== null ? ` · ${tr("{n} unread", { n: data.unread })}` : ""}
        {plan.free > 0 ? ` · ${tr("{time} free", { time: durationText(plan.free) })}` : ""}
      </p>
      {plan.allDay.length > 0 ? <p className={styles.meta}>{plan.allDay.join(" · ")}</p> : null}
      {data.events === null ? <p className={styles.meta}>{tr("The schedule could not be read.")}</p> : null}
      <ol className={more.timeline}>
        {plan.items.map((item, i) => (
          <li key={`${item.kind}-${item.start}-${i}`} className={more.slot} data-kind={item.kind} data-past={item.past} data-now={item.now}>
            <span className={more.range + " mono"}>
              {clockText(item.start)}
              <span className={more.to}>{clockText(item.end)}</span>
            </span>
            {item.kind === "event" ? (
              <span className={more.what}>
                {item.title}
                {item.place ? <span className={styles.meta}> · {item.place}</span> : null}
              </span>
            ) : (
              <span className={more.what}>
                <span className={more.free}>{item.task ? tr("FOCUS") : tr("FREE")}</span> {item.task ?? durationText(item.end - item.start)}
                {item.task ? <span className={styles.meta}> · {durationText(item.end - item.start)}</span> : null}
              </span>
            )}
          </li>
        ))}
        {plan.items.length === 0 ? <li className={styles.sub}>{tr("The rest of the day is free.")}</li> : null}
      </ol>
      {plan.unplaced > 0 ? <p className={styles.meta}>{tr("{n} tasks did not fit today.", { n: plan.unplaced })}</p> : null}
      <h3 className={more.heading}>{tr("Operations")}</h3>
      {data.tasks === null ? <p className={styles.meta}>{tr("Connect the database to keep tasks.")}</p> : open.length === 0 && done.length === 0 ? <p className={styles.sub}>{tr("Nothing to do.")}</p> : (
        <ul className={styles.list}>
          {[...open, ...done].map((t) => (
            <li key={t.id} className={styles.row}>
              <button type="button" className={styles.check} data-done={t.done} role="checkbox" aria-checked={t.done} aria-label={t.title} onClick={() => void toggle(t.id, !t.done, refresh)} />
              <span className={t.done ? styles.done : undefined}>{t.title}</span>
            </li>
          ))}
        </ul>
      )}
      {refresh && data.editable ? <AddForm endpoint="/api/tasks" field="title" placeholder="New task" label="New task" max={200} onDone={refresh} /> : null}
    </Panel>
  );
}

function toLines(data: Data, tr: Tr): string[] {
  const now = minutesNow(data.timeZone, new Date());
  const plan = planFor(data, now);
  const out = [headline(plan, now, tr)];
  if (plan.free > 0) out.push(tr("{time} free", { time: durationText(plan.free) }));
  const focus = plan.items.filter((i): i is Extract<PlanItem, { kind: "free" }> => i.kind === "free" && i.task !== null).slice(0, 3);
  for (const f of focus) out.push(`${clockText(f.start)} ${f.task}`);
  return out;
}

const def: ModuleDef<Data> = {
  manifest: {
    id: "today",
    name: "Today",
    description: "The day as a timeline: classes and events, free gaps, and your tasks placed in them.",
    env: [],
    refreshSeconds: 120,
    size: "L",
    pages: ["today"],
    wide: true,
  },
  Panel: ModulePanel,
  lines: toLines,
  notConnectedHint: "Connect the schedule or the database to plan the day.",
};

export default def;
