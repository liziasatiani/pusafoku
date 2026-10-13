import Panel from "@/components/hud/Panel";
import styles from "@/components/hud/hud.module.css";
import { useTr } from "@/components/hud/lang";
import type { Tr } from "@/lib/i18n";
import type { ModuleDef, PanelProps } from "@/modules/types";

export type Data = { unread: number; items: { id: string; sender: string; subject: string; at: string }[] };

function ModulePanel({ result }: PanelProps<Data>) {
  const tr = useTr();
  if (result.status !== "ok") {
    return <Panel title="Messages" status={result.status} hint={result.status === "not_connected" ? result.hint : undefined} message={result.status === "error" ? result.message : undefined} />;
  }
  const data = result.data;
  return (
    <Panel title="Messages">
      {data.items.length === 0 ? (
        <p className={styles.sub}>{tr("No unread email.")}</p>
      ) : (
        <>
          <p className={styles.meta}>{tr("{n} unread", { n: data.unread })}</p>
          <ul className={styles.list}>
            {data.items.map((m) => (
              <li key={m.id} className={styles.row}>
                <span className={styles.time + " mono"}>{m.at}</span>
                <a className={styles.mailLink} href={`https://mail.google.com/mail/u/0/#inbox/${m.id}`} target="_blank" rel="noopener noreferrer">
                  <span className={styles.meta}>{m.sender}</span> {m.subject || tr("(no subject)")}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function toLines(data: Data, tr: Tr): string[] {
  if (data.items.length === 0) return [tr("No new messages.")];
  return [tr("{n} unread messages", { n: data.unread })].concat(data.items.slice(0, 3).map((m) => m.at + " " + m.sender + ": " + (m.subject || tr("(no subject)"))));
}

const def: ModuleDef<Data> = {
  manifest: {
    id: "messages",
    name: "Messages",
    description: "Unread email from your Google account: sender and subject only, never stored.",
    env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"],
    refreshSeconds: 120,
    size: "M",
    pages: ["home"],
  },
  Panel: ModulePanel,
  lines: toLines,
  notConnectedHint: "Connect your Google account to see unread email.",
};

export default def;
