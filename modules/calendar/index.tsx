import Panel from "@/components/hud/Panel";
import styles from "@/components/hud/hud.module.css";
import type { ModuleDef, PanelProps } from "@/modules/types";

export type Data = { events: { time: string; title: string }[] };

function ModulePanel({ result, demo }: PanelProps<Data>) {
  if (result.status !== "ok") {
    return <Panel title="Schedule" demo={demo} status={result.status} hint={result.status === "not_connected" ? result.hint : undefined} message={result.status === "error" ? result.message : undefined} />;
  }
  const data = result.data;
  return (
    <Panel title="Schedule" demo={demo}>
      {data.events.length === 0 ? <p className={styles.sub}>No events today.</p> : (
        <ul className={styles.list}>
          {data.events.map((e, i) => (
            <li key={`${e.time}-${e.title}-${i}`} className={styles.row}>
              <span className={styles.time + " mono"}>{e.time}</span>
              <span>{e.title}</span>
            </li>
          ))}
        </ul>
      )}
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
    description: "Today's events from your private calendar address.",
    env: ["CALENDAR_ICS_URL"],
    refreshSeconds: 600,
    size: "M",
  },
  Panel: ModulePanel,
  lines: toLines,
  demo: () => ({ events: [{ time: "10:00", title: "Supplier call" }, { time: "13:30", title: "Lunch" }, { time: "17:00", title: "Review week" }] }),
  notConnectedHint: "Add your private calendar address to show today's events.",
};

export default def;
