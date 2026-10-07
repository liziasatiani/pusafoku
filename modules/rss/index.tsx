import Panel from "@/components/hud/Panel";
import styles from "@/components/hud/hud.module.css";
import type { ModuleDef, PanelProps } from "@/modules/types";

export type Data = { items: { title: string; source: string; ago: string }[] };

function ModulePanel({ result, demo }: PanelProps<Data>) {
  if (result.status !== "ok") {
    return <Panel title="Signals" demo={demo} status={result.status} hint={result.status === "not_connected" ? result.hint : undefined} message={result.status === "error" ? result.message : undefined} />;
  }
  const data = result.data;
  return (
    <Panel title="Signals" demo={demo}>
      <ul className={styles.list}>
        {data.items.map((n) => (
          <li key={n.title} className={styles.row}>
            <span className={styles.time + " mono"}>{n.ago}</span>
            <span>{n.title} <span className={styles.meta}>{n.source}</span></span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function toLines(data: Data): string[] {
  const out = data.items.length === 0 ? "No new signals." : data.items.map((i) => i.title + " (" + i.source + ", " + i.ago + ")");
  return Array.isArray(out) ? out : [out];
}

const def: ModuleDef<Data> = {
  manifest: {
    id: "rss",
    name: "Signals",
    description: "Headlines from the RSS feeds you choose.",
    env: ["RSS_FEEDS"],
    refreshSeconds: 1800,
    size: "M",
  },
  Panel: ModulePanel,
  lines: toLines,
  demo: () => ({ items: [{ title: "Sample headline one", source: "Feed A", ago: "12m" }, { title: "Sample headline two", source: "Feed B", ago: "41m" }, { title: "Sample headline three", source: "Feed A", ago: "2h" }] }),
  notConnectedHint: "Add feed URLs in Settings or RSS_FEEDS to show headlines.",
};

export default def;
