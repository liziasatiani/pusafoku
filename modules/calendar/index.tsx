import AddForm from "@/components/hud/AddForm";
import EventForm from "@/components/hud/EventForm";
import Panel from "@/components/hud/Panel";
import styles from "@/components/hud/hud.module.css";
import more from "@/components/hud/calendar.module.css";
import type { ModuleDef, PanelProps } from "@/modules/types";

export type Data = {
  events: { time: string; title: string }[];
  mine?: { id: string; title: string; day: string; start: string | null; repeat: string }[];
  sources?: { id: string; label: string }[];
  failed?: number;
  editable?: boolean;
};

async function call(url: string, method: string, refresh?: () => void) {
  try {
    await fetch(url, { method });
  } finally {
    refresh?.();
  }
}

const REPEAT_LABEL: Record<string, string> = { none: "", daily: "every day", weekly: "every week", monthly: "every month", yearly: "every year" };

function ModulePanel({ result, demo, refresh }: PanelProps<Data>) {
  if (result.status !== "ok") {
    return <Panel title="Schedule" demo={demo} status={result.status} hint={result.status === "not_connected" ? result.hint : undefined} message={result.status === "error" ? result.message : undefined} />;
  }
  const data = result.data;
  const mine = data.mine ?? [];
  const sources = data.sources ?? [];
  const manage = !demo && !!refresh && data.editable !== false;
  return (
    <Panel title="Schedule" demo={demo}>
      {data.events.length === 0 ? (
        <p className={styles.sub}>No events today.</p>
      ) : (
        <ul className={styles.list}>
          {data.events.map((e, i) => (
            <li key={`${e.time}-${e.title}-${i}`} className={styles.row}>
              <span className={styles.time + " mono"}>{e.time}</span>
              <span>{e.title}</span>
            </li>
          ))}
        </ul>
      )}
      {data.failed ? <p className={styles.meta}>{data.failed} calendar{data.failed > 1 ? "s" : ""} could not be read</p> : null}
      {manage && refresh ? (
        <div className={more.manage}>
          <details className={more.group}>
            <summary className={more.summary}>Add an event</summary>
            <EventForm onDone={refresh} />
          </details>
          <details className={more.group}>
            <summary className={more.summary}>My events ({mine.length})</summary>
            {mine.length === 0 ? (
              <p className={styles.meta}>Nothing saved yet.</p>
            ) : (
              <ul className={styles.list}>
                {mine.map((m) => (
                  <li key={m.id} className={styles.row}>
                    <span className={styles.time + " mono"}>{m.day.slice(5)}</span>
                    <span>
                      {m.title} <span className={styles.meta}>{[m.start, REPEAT_LABEL[m.repeat]].filter(Boolean).join(" · ")}</span>
                    </span>
                    <button type="button" className={styles.remove} aria-label={`Delete ${m.title}`} onClick={() => void call(`/api/events/${m.id}`, "DELETE", refresh)}>
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </details>
          <details className={more.group}>
            <summary className={more.summary}>Connect a calendar ({sources.length}/5)</summary>
            {sources.length > 0 ? (
              <ul className={styles.chips}>
                {sources.map((s) => (
                  <li key={s.id} className={styles.chip}>
                    <span className="mono">{s.label}</span>
                    <button type="button" className={styles.remove} aria-label={`Disconnect ${s.label}`} onClick={() => void call(`/api/calendar/sources/${s.id}`, "DELETE", refresh)}>
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <AddForm endpoint="/api/calendar/sources" field="url" placeholder="Paste the calendar address" label="Calendar address" max={1200} onDone={refresh} />
            <p className={more.help}>
              Google: Settings, your calendar, Integrate calendar, Secret address in iCal format. Apple: Share calendar, Public Calendar, copy the link. Outlook: Settings, Shared calendars, Publish a calendar, copy the ICS link. The address is stored privately and never shown again.
            </p>
          </details>
        </div>
      ) : null}
    </Panel>
  );
}

function toLines(data: Data): string[] {
  return data.events.length === 0 ? ["Nothing scheduled today."] : data.events.map((e) => e.time + " " + e.title);
}

const def: ModuleDef<Data> = {
  manifest: {
    id: "calendar",
    name: "Schedule",
    description: "Today's events from your own calendar here and any calendars you connect.",
    env: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    refreshSeconds: 600,
    size: "M",
  },
  Panel: ModulePanel,
  lines: toLines,
  demo: () => ({ events: [{ time: "10:00", title: "Supplier call" }, { time: "13:30", title: "Lunch" }, { time: "17:00", title: "Review week" }] }),
  notConnectedHint: "Connect the database to keep your own calendar.",
};

export default def;
