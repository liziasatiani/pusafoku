import AddForm from "@/components/hud/AddForm";
import Panel from "@/components/hud/Panel";
import styles from "@/components/hud/hud.module.css";
import { useTr } from "@/components/hud/lang";
import type { Tr } from "@/lib/i18n";
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

function ModulePanel({ result, refresh }: PanelProps<Data>) {
  const tr = useTr();
  if (result.status !== "ok") {
    return <Panel title="Operations" status={result.status} hint={result.status === "not_connected" ? result.hint : undefined} message={result.status === "error" ? result.message : undefined} />;
  }
  const data = result.data;
  return (
    <Panel title="Operations">
      {data.tasks.length === 0 ? <p className={styles.sub}>{tr("Nothing to do.")}</p> : (
        <ul className={styles.list}>
          {data.tasks.map((t) => (
            <li key={t.id} className={styles.row}>
              <button type="button" className={styles.check} data-done={t.done} role="checkbox" aria-checked={t.done} aria-label={t.title} onClick={() => void toggle(t.id, !t.done, refresh)} />
              <span className={t.done ? styles.done : undefined}>{t.title}</span>
              <button type="button" className={styles.remove} aria-label={tr("Delete {title}", { title: t.title })} onClick={() => void remove(t.id, refresh)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {!refresh ? null : <AddForm endpoint="/api/tasks" field="title" placeholder="New task" label="New task" max={300} onDone={refresh} />}
    </Panel>
  );
}

function toLines(data: Data, tr: Tr): string[] {
  const open = data.tasks.filter((t) => !t.done);
  const closed = data.tasks.length - open.length;
  const lines = [open.length === 0 ? tr("No open operations.") : tr("Open: {list}.", { list: open.map((t) => t.title).join(". ") })];
  if (closed > 0) lines.push(tr("Closed: {n}.", { n: closed }));
  return lines;
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
  notConnectedHint: "Connect the database to store tasks.",
};

export default def;
