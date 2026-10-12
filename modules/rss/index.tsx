import AddForm from "@/components/hud/AddForm";
import Panel from "@/components/hud/Panel";
import styles from "@/components/hud/hud.module.css";
import { useTr } from "@/components/hud/lang";
import type { Tr } from "@/lib/i18n";
import type { ModuleDef, PanelProps } from "@/modules/types";

export type Data = {
  items: { title: string; source: string; ago: string; url?: string | null }[];
  feeds?: { id: string; label: string }[];
  failed?: number;
};

async function removeFeed(id: string, refresh?: () => void) {
  try {
    await fetch(`/api/feeds/${id}`, { method: "DELETE" });
  } finally {
    refresh?.();
  }
}

function ModulePanel({ result, demo, refresh }: PanelProps<Data>) {
  const tr = useTr();
  if (result.status !== "ok") {
    return <Panel title="Signals" demo={demo} status={result.status} hint={result.status === "not_connected" ? result.hint : undefined} message={result.status === "error" ? result.message : undefined} />;
  }
  const data = result.data;
  const feeds = data.feeds ?? [];
  return (
    <Panel title="Signals" demo={demo}>
      {data.items.length === 0 ? (
        <p className={styles.sub}>{feeds.length === 0 ? tr("No feeds yet. Add one below.") : tr("No headlines available right now.")}</p>
      ) : (
        <ul className={styles.list}>
          {data.items.map((n, index) => (
            <li key={`${n.url ?? n.title}-${index}`} className={styles.row}>
              <span className={styles.time + " mono"}>{n.ago}</span>
              <span>
                {n.url ? (
                  <a className={styles.link} href={n.url} target="_blank" rel="noopener noreferrer">
                    {n.title}
                  </a>
                ) : (
                  n.title
                )}{" "}
                <span className={styles.meta}>{n.source}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {data.failed ? <p className={styles.meta}>{tr(data.failed > 1 ? "{n} feeds unreachable" : "{n} feed unreachable", { n: data.failed })}</p> : null}
      {demo || !refresh ? null : (
        <>
          {feeds.length > 0 ? (
            <ul className={styles.chips}>
              {feeds.map((f) => (
                <li key={f.id} className={styles.chip}>
                  <span className="mono">{f.label}</span>
                  <button type="button" className={styles.remove} aria-label={tr("Remove {name}", { name: f.label })} onClick={() => void removeFeed(f.id, refresh)}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <AddForm endpoint="/api/feeds" field="url" placeholder="https://site.com/feed.xml" label="Feed address" max={500} onDone={refresh} />
        </>
      )}
    </Panel>
  );
}

function toLines(data: Data, tr: Tr): string[] {
  if (data.items.length === 0) return [tr("No new signals.")];
  return data.items.slice(0, 6).map((i) => i.title + " (" + i.source + (i.ago ? ", " + i.ago : "") + ")");
}

const def: ModuleDef<Data> = {
  manifest: {
    id: "rss",
    name: "Signals",
    description: "Headlines from the news feeds you add.",
    env: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    refreshSeconds: 600,
    size: "M",
  },
  Panel: ModulePanel,
  lines: toLines,
  demo: () => ({ items: [{ title: "Sample headline one", source: "Feed A", ago: "12m" }, { title: "Sample headline two", source: "Feed B", ago: "41m" }, { title: "Sample headline three", source: "Feed A", ago: "2h" }] }),
  notConnectedHint: "Connect the database to add news feeds.",
};

export default def;
