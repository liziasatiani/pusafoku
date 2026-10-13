import AddForm from "@/components/hud/AddForm";
import EventForm from "@/components/hud/EventForm";
import ClassBreaks from "@/components/hud/ClassBreaks";
import TermShift from "@/components/hud/TermShift";
import Panel from "@/components/hud/Panel";
import styles from "@/components/hud/hud.module.css";
import { useTr } from "@/components/hud/lang";
import type { Tr } from "@/lib/i18n";
import more from "@/components/hud/calendar.module.css";
import type { ModuleDef, PanelProps } from "@/modules/types";

export type Data = {
  events: { time: string; title: string; place?: string }[];
  mine?: { id: string; title: string; day: string; start: string | null; repeat: string; place?: string; until?: string | null; hidden?: number }[];
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

const HELP = "Google: Settings, your calendar, Integrate calendar, Secret address in iCal format. Apple: Share calendar, Public Calendar, copy the link. Outlook: Settings, Shared calendars, Publish a calendar, copy the ICS link. The address is stored privately and never shown again.";

const REPEAT_LABEL: Record<string, string> = { none: "", daily: "every day", weekly: "every week", monthly: "every month", yearly: "every year" };

function ModulePanel({ result, refresh }: PanelProps<Data>) {
  const tr = useTr();
  if (result.status !== "ok") {
    return <Panel title="Schedule" status={result.status} hint={result.status === "not_connected" ? result.hint : undefined} message={result.status === "error" ? result.message : undefined} />;
  }
  const data = result.data;
  const mine = data.mine ?? [];
  const sources = data.sources ?? [];
  const manage = !!refresh && data.editable !== false;
  return (
    <Panel title="Schedule">
      {data.events.length === 0 ? (
        <p className={styles.sub}>{tr("No events today.")}</p>
      ) : (
        <ul className={styles.list}>
          {data.events.map((e, i) => (
            <li key={`${e.time}-${e.title}-${i}`} className={styles.row}>
              <span className={styles.time + " mono"}>{tr(e.time)}</span>
              <span>
                {e.title}
                {e.place ? <span className={styles.meta}> · {e.place}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
      {data.failed ? <p className={styles.meta}>{tr(data.failed > 1 ? "{n} calendars could not be read" : "{n} calendar could not be read", { n: data.failed })}</p> : null}
      {manage && refresh ? (
        <div className={more.manage}>
          <details className={more.group}>
            <summary className={more.summary}>{tr("Add an event")}</summary>
            <EventForm onDone={refresh} />
          </details>
          <details className={more.group}>
            <summary className={more.summary}>{tr("My events ({n})", { n: mine.length })}</summary>
            {mine.length === 0 ? (
              <p className={styles.meta}>{tr("Nothing saved yet.")}</p>
            ) : (
              <ul className={styles.list}>
                {mine.map((m) => (
                  <li key={m.id} className={styles.row}>
                    <span className={styles.time + " mono"}>{m.day.slice(5)}</span>
                    <span>
                      {m.title} <span className={styles.meta}>{[m.start, m.place, REPEAT_LABEL[m.repeat] ? tr(REPEAT_LABEL[m.repeat]) : "", m.until ? tr("until {date}", { date: m.until.slice(5) }) : "", m.hidden ? tr("{n} days hidden", { n: m.hidden }) : ""].filter(Boolean).join(" · ")}</span>
                    </span>
                    <button type="button" className={styles.remove} aria-label={tr("Delete {title}", { title: m.title })} onClick={() => void call(`/api/events/${m.id}`, "DELETE", refresh)}>
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </details>
          <details className={more.group}>
            <summary className={more.summary}>{tr("Hide classes on certain days")}</summary>
            <ClassBreaks onDone={refresh} />
          </details>
          <details className={more.group}>
            <summary className={more.summary}>{tr("Move classes to the next term")}</summary>
            <TermShift onDone={refresh} />
          </details>
          <details className={more.group}>
            <summary className={more.summary}>{tr("Connect a calendar ({n}/5)", { n: sources.length })}</summary>
            {sources.length > 0 ? (
              <ul className={styles.chips}>
                {sources.map((s) => (
                  <li key={s.id} className={styles.chip}>
                    <span className="mono">{s.label}</span>
                    <button type="button" className={styles.remove} aria-label={tr("Disconnect {name}", { name: s.label })} onClick={() => void call(`/api/calendar/sources/${s.id}`, "DELETE", refresh)}>
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <AddForm endpoint="/api/calendar/sources" field="url" placeholder="Paste the calendar address" label="Calendar address" max={1200} onDone={refresh} />
            <p className={more.help}>{tr(HELP)}</p>
          </details>
        </div>
      ) : null}
    </Panel>
  );
}

function toLines(data: Data, tr: Tr): string[] {
  return data.events.length === 0 ? [tr("Nothing scheduled today.")] : data.events.map((e) => tr(e.time) + " " + e.title + (e.place ? ` (${e.place})` : ""));
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
  notConnectedHint: "Connect the database to keep your own calendar.",
};

export default def;
