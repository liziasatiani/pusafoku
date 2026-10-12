import AddForm from "@/components/hud/AddForm";
import Panel from "@/components/hud/Panel";
import styles from "@/components/hud/hud.module.css";
import { useTr } from "@/components/hud/lang";
import type { Tr } from "@/lib/i18n";
import type { ModuleDef, PanelProps } from "@/modules/types";

export type Data = { notes: { id: string; text: string; at: string }[] };

async function remove(id: string, refresh?: () => void) {
  try {
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
  } finally {
    refresh?.();
  }
}

function ModulePanel({ result, demo, refresh }: PanelProps<Data>) {
  const tr = useTr();
  if (result.status !== "ok") {
    return <Panel title="Archive" demo={demo} status={result.status} hint={result.status === "not_connected" ? result.hint : undefined} message={result.status === "error" ? result.message : undefined} />;
  }
  const data = result.data;
  return (
    <Panel title="Archive" demo={demo}>
      {data.notes.length === 0 ? <p className={styles.sub}>{tr("No notes yet.")}</p> : (
        <ul className={styles.list}>
          {data.notes.map((n) => (
            <li key={n.id} className={styles.row}>
              <span className={styles.time + " mono"}>{n.at}</span>
              <span>{n.text}</span>
              {demo ? null : (
                <button type="button" className={styles.remove} aria-label={tr("Delete note")} onClick={() => void remove(n.id, refresh)}>
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {demo || !refresh ? null : <AddForm endpoint="/api/notes" field="text" placeholder="New note" label="New note" max={4000} onDone={refresh} />}
    </Panel>
  );
}

function toLines(data: Data, tr: Tr): string[] {
  return data.notes.length === 0 ? [tr("The archive is empty.")] : data.notes.map((n) => n.at + " " + n.text);
}

const def: ModuleDef<Data> = {
  manifest: {
    id: "notes",
    name: "Archive",
    description: "Quick voice notes, transcribed and saved.",
    env: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    refreshSeconds: 60,
    size: "M",
  },
  Panel: ModulePanel,
  lines: toLines,
  demo: () => ({ notes: [{ id: "1", text: "Ask about the new courier rates", at: "09:12" }, { id: "2", text: "Idea: weekly summary email", at: "Mon" }] }),
  notConnectedHint: "Connect the database to save notes.",
};

export default def;
