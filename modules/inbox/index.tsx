import Panel from "@/components/hud/Panel";
import styles from "@/components/hud/hud.module.css";
import type { ModuleDef, PanelProps } from "@/modules/types";

export type Data = { items: { id: string; title: string; source: string; draft: string }[] };

function ModulePanel({ result, demo }: PanelProps<Data>) {
  if (result.status !== "ok") {
    return <Panel title="Authorizations" demo={demo} status={result.status} hint={result.status === "not_connected" ? result.hint : undefined} message={result.status === "error" ? result.message : undefined} />;
  }
  const data = result.data;
  return (
    <Panel title="Authorizations" demo={demo}>
      {data.items.length === 0 ? <p className={styles.sub}>Nothing waiting.</p> : (
        <ul className={styles.list}>
          {data.items.map((i) => (
            <li key={i.id} className={styles.inboxItem}>
              <p className={styles.itemTitle}>{i.title} <span className={styles.meta}>{i.source}</span></p>
              <p className={styles.sub}>{i.draft}</p>
              <div className={styles.actions}>
                <button type="button" className={styles.btn}>Approve</button>
                <button type="button" className={styles.btn}>Edit</button>
                <button type="button" className={styles.btn}>Reject</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function toLines(data: Data): string[] {
  const out = data.items.length === 0 ? "Nothing waiting for authorization." : [data.items.length + " waiting for approval."].concat(data.items.map((i, n) => (n + 1) + ". " + i.title + " (" + i.source + ")"), "Nothing is sent until you approve.");
  return Array.isArray(out) ? out : [out];
}

const def: ModuleDef<Data> = {
  manifest: {
    id: "inbox",
    name: "Authorizations",
    description: "Items waiting for you. Approve only marks an item approved.",
    env: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "INBOX_TOKEN"],
    refreshSeconds: 30,
    size: "L",
  },
  Panel: ModulePanel,
  lines: toLines,
  demo: () => ({ items: [{ id: "1", title: "Reply to a customer question", source: "Store", draft: "Thanks for asking. The item ships within two days." }, { id: "2", title: "Post a product update", source: "Store", draft: "New arrivals this week." }] }),
  notConnectedHint: "Connect the database and set INBOX_TOKEN so other tools can add items.",
};

export default def;
