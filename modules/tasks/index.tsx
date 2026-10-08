import AddForm from "@/components/hud/AddForm";
import Panel from "@/components/hud/Panel";
import styles from "@/components/hud/hud.module.css";
import type { ModuleDef, PanelProps } from "@/modules/types";

export type Data = { tasks: { id: string; title: string; done: boolean }[] };

async function remove(id: string, refresh?: () => void) {
  try {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
  } finally {
    refresh?.();
  }
}

async function toggle(id: string, done: boolean, refresh?: () => void) {
  try {
    await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ done }) });
  } finally {
    refresh?.();
  }
}

function ModulePanel({ result, demo, refresh }: PanelProps<Data>) {
  if (result.status !== "ok") {
    return <Panel title="Operations" demo={demo} status={result.status} hint={result.status === "not_connected" ? result.hint : undefined} message={result.status === "error" ? result.message : undefined} />;
  }
  const data = result.data;
  return (
    <Panel title="Operations" demo={demo}>
      {data.tasks.length === 0 ? <p className={styles.sub}>Nothing to do.</p> : (
        <ul className={styles.list}>
          {data.tasks.map((t) => (
            <li key={t.id} className={styles.row}>
              {demo ? (
                <span className={styles.check} data-done={t.done} aria-hidden="true" />
              ) : (
                <button type="button" className={styles.check} data-done={t.done} role="checkbox" aria-checked={t.done} aria-label={t.title} onClick={() => void toggle(t.id, !t.done, refresh)} />
              )}
              <span className={t.done ? styles.done : undefined}>{t.title}</span>
              {demo ? null : (
                <button type="button" className={styles.remove} aria-label={`Delete ${t.title}`} onClick={() => void remove(t.id, refresh)}>
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {demo || !refresh ? null : <AddForm endpoint="/api/tasks" field="title" placeholder="New task" label="New task" max={300} onDone={refresh} />}
    </Panel>
  );
}

function toLines(data: Data): string[] {
  const out = (() => { const open = data.tasks.filter((t) => !t.done); const closed = data.tasks.length - open.length; return [open.length === 0 ? "No open operations." : "Open: " + open.map((t) => t.title).join(". ") + ".", closed > 0 ? "Closed: " + closed + "." : ""].filter(Boolean); })();
  return Array.isArray(out) ? out : [out];
}

const def: ModuleDef<Data> = {
  manifest: {
    id: "tasks",
    name: "Operations",
    description: "A to-do list stored in PUSAFOKU's own database.",
    env: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    refreshSeconds: 60,
    size: "M",
  },
  Panel: ModulePanel,
  lines: toLines,
  demo: () => ({ tasks: [{ id: "1", title: "Reply to the courier", done: false }, { id: "2", title: "Check stock counts", done: false }, { id: "3", title: "Pay hosting", done: true }] }),
  notConnectedHint: "Connect the database to store tasks.",
};

export default def;
