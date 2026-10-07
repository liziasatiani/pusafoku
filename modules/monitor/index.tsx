import Panel from "@/components/hud/Panel";
import styles from "@/components/hud/hud.module.css";
import type { ModuleDef, PanelProps } from "@/modules/types";

export type Data = { sites: { url: string; ok: boolean; ms: number }[] };

function ModulePanel({ result, demo }: PanelProps<Data>) {
  if (result.status !== "ok") {
    return <Panel title="Network" demo={demo} status={result.status} hint={result.status === "not_connected" ? result.hint : undefined} message={result.status === "error" ? result.message : undefined} />;
  }
  const data = result.data;
  return (
    <Panel title="Network" demo={demo}>
      <ul className={styles.list}>
        {data.sites.map((s) => (
          <li key={s.url} className={styles.row}>
            <span className={styles.dot + " " + (s.ok ? styles.dotOk : styles.dotBad)} aria-hidden="true" />
            <span className="mono">{s.url}</span>
            <span className={styles.meta + " mono"}>{s.ok ? s.ms + " ms" : "down"}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function toLines(data: Data): string[] {
  const out = (() => { const down = data.sites.filter((s) => !s.ok); return data.sites.map((s) => s.url + (s.ok ? " " + s.ms + " ms. OK." : " no response. DOWN.")).concat(down.length === 0 ? [] : [down.length + " asset" + (down.length > 1 ? "s" : "") + " down."]); })();
  return Array.isArray(out) ? out : [out];
}

const def: ModuleDef<Data> = {
  manifest: {
    id: "monitor",
    name: "Network",
    description: "Checks a list of URLs every 15 minutes.",
    env: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    refreshSeconds: 900,
    size: "M",
  },
  Panel: ModulePanel,
  lines: toLines,
  demo: () => ({ sites: [{ url: "example.com", ok: true, ms: 182 }, { url: "example.org", ok: true, ms: 244 }, { url: "example.net", ok: false, ms: 0 }] }),
  notConnectedHint: "Add websites in Settings and connect the database to monitor them.",
};

export default def;
