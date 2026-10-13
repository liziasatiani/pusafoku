import Panel from "@/components/hud/Panel";
import styles from "@/components/hud/hud.module.css";
import { useTr } from "@/components/hud/lang";
import type { Tr } from "@/lib/i18n";
import type { ModuleDef, PanelProps } from "@/modules/types";

export type Data = { unread: number; items: { id: string; channel: string; sender: string; text: string; at: string; read: boolean }[] };

const CHANNEL_LABEL: Record<string, string> = { telegram: "TG" };

async function act(url: string, method: string, refresh?: () => void) {
  try {
    await fetch(url, { method });
  } finally {
    refresh?.();
  }
}

function ModulePanel({ result, refresh }: PanelProps<Data>) {
  const tr = useTr();
  if (result.status !== "ok") {
    return <Panel title="Messages" status={result.status} hint={result.status === "not_connected" ? result.hint : undefined} message={result.status === "error" ? result.message : undefined} />;
  }
  const data = result.data;
  return (
    <Panel title="Messages">
      {data.items.length === 0 ? (
        <p className={styles.sub}>{tr("No messages yet. Send one to your Telegram bot.")}</p>
      ) : (
        <>
          {data.unread > 0 && refresh ? (
            <div className={styles.row}>
              <span className={styles.meta}>{tr("{n} unread", { n: data.unread })}</span>
              <button type="button" className={styles.btn} onClick={() => void act("/api/messages/read", "POST", refresh)}>
                {tr("MARK READ")}
              </button>
            </div>
          ) : null}
          <ul className={styles.list}>
            {data.items.map((m) => (
              <li key={m.id} className={styles.row}>
                <span className={styles.time + " mono"}>{m.at}</span>
                <span className={m.read ? undefined : styles.unread}>
                  <span className={styles.meta}>
                    {CHANNEL_LABEL[m.channel] ?? m.channel} · {m.sender === "Me" ? tr("Me") : m.sender}
                  </span>{" "}
                  {m.text}
                </span>
                {refresh ? (
                  <button type="button" className={styles.remove} aria-label={tr("Delete message")} onClick={() => void act(`/api/messages/${m.id}`, "DELETE", refresh)}>
                    ✕
                  </button>
                ) : null}
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
  const head = data.unread > 0 ? [tr("{n} unread messages", { n: data.unread })] : [];
  return head.concat(data.items.slice(0, 3).map((m) => m.at + " " + (m.sender === "Me" ? tr("Me") : m.sender) + ": " + m.text));
}

const def: ModuleDef<Data> = {
  manifest: {
    id: "messages",
    name: "Messages",
    description: "Messages sent to your own Telegram bot, kept for 30 days.",
    env: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "TELEGRAM_WEBHOOK_SECRET", "TELEGRAM_OWNER_ID"],
    refreshSeconds: 60,
    size: "M",
  },
  Panel: ModulePanel,
  lines: toLines,
  notConnectedHint: "Connect the database to receive messages.",
};

export default def;
