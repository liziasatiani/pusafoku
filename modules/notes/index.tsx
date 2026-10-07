import Panel from "@/components/hud/Panel";
import styles from "@/components/hud/hud.module.css";
import type { ModuleDef, PanelProps } from "@/modules/types";

export type Data = { notes: { id: string; text: string; at: string }[] };

function ModulePanel({ result, demo }: PanelProps<Data>) {
  if (result.status !== "ok") {
    return <Panel title="Archive" demo={demo} status={result.status} hint={result.status === "not_connected" ? result.hint : undefined} message={result.status === "error" ? result.message : undefined} />;
  }
  const data = result.data;
  return (
    <Panel title="Archive" demo={demo}>
      {data.notes.length === 0 ? <p className={styles.sub}>No notes yet.</p> : (
        <ul className={styles.list}>
          {data.notes.map((n) => (
            <li key={n.id} className={styles.row}>
              <span className={styles.time + " mono"}>{n.at}</span>
              <span>{n.text}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function toLines(data: Data): string[] {
  const out = data.notes.length === 0 ? "The archive is empty." : data.notes.map((n) => n.at + " " + n.text);
  return Array.isArray(out) ? out : [out];
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
