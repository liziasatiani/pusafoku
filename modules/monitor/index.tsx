import AddForm from "@/components/hud/AddForm";
import Panel from "@/components/hud/Panel";
import styles from "@/components/hud/hud.module.css";
import type { ModuleDef, PanelProps } from "@/modules/types";

export type Data = { sites: { id?: string; url: string; ok: boolean | null; ms: number; checkedAt?: string | null }[] };

async function call(url: string, method: string, refresh?: () => void) {
  try {
    await fetch(url, { method });
  } finally {
    refresh?.();
  }
}

function ModulePanel({ result, demo, refresh }: PanelProps<Data>) {
  if (result.status !== "ok") {
    return <Panel title="Network" demo={demo} status={result.status} hint={result.status === "not_connected" ? result.hint : undefined} message={result.status === "error" ? result.message : undefined} />;
  }
  const data = result.data;
  return (
    <Panel title="Network" demo={demo}>
      {data.sites.length === 0 ? <p className={styles.sub}>No websites yet. Add one below.</p> : (
        <ul className={styles.list}>
          {data.sites.map((s) => (
            <li key={s.id ?? s.url} className={styles.row}>
              <span className={styles.dot + " " + (s.ok === null ? styles.dotOff : s.ok ? styles.dotOk : styles.dotBad)} aria-hidden="true" />
              <span className="mono">{s.url}</span>
              <span className={styles.meta + " mono"}>{s.ok === null ? "pending" : s.ok ? s.ms + " ms" : "down"}</span>
              {!demo && s.id ? (
                <button type="button" className={styles.remove} aria-label={`Remove ${s.url}`} onClick={() => void call(`/api/monitor/sites/${s.id}`, "DELETE", refresh)}>
                  ✕
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {demo || !refresh ? null : (
        <>
          <AddForm endpoint="/api/monitor/sites" field="url" placeholder="https://example.com" label="Website address" max={500} onDone={refresh} />
          <button type="button" className={styles.btn} onClick={() => void call("/api/monitor/check", "POST", refresh)}>
            CHECK NOW
          </button>
        </>
      )}
    </Panel>
  );
}

function toLines(data: Data): string[] {
  if (data.sites.length === 0) return ["No websites are being watched."];
  const down = data.sites.filter((s) => s.ok === false);
  const lines = data.sites.map((s) => (s.ok === null ? s.url + " not checked yet." : s.url + (s.ok ? " " + s.ms + " ms. OK." : " no response. DOWN.")));
  return down.length === 0 ? lines : lines.concat(down.length + " asset" + (down.length > 1 ? "s" : "") + " down.");
}

const def: ModuleDef<Data> = {
  manifest: {
    id: "monitor",
    name: "Network",
    description: "Checks a list of websites on a schedule and shows whether each is up.",
    env: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "CRON_SECRET"],
    refreshSeconds: 300,
    size: "M",
  },
  Panel: ModulePanel,
  lines: toLines,
  demo: () => ({ sites: [{ url: "example.com", ok: true, ms: 182 }, { url: "example.org", ok: true, ms: 244 }, { url: "example.net", ok: false, ms: 0 }] }),
  notConnectedHint: "Connect the database to monitor websites.",
};

export default def;
