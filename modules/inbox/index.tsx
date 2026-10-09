"use client";

import { useState } from "react";
import Panel from "@/components/hud/Panel";
import styles from "@/components/hud/hud.module.css";
import type { ModuleDef, PanelProps } from "@/modules/types";

export type Data = { items: { id: string; title: string; source: string; draft: string }[] };

type Item = Data["items"][number];

function Entry({ item, live, refresh }: { item: Item; live: boolean; refresh?: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.draft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(body: { action: string; draft?: string }) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/approvals/${item.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) {
        setEditing(false);
        refresh?.();
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not save");
        if (res.status === 409) refresh?.();
      }
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  const locked = !live || busy;
  return (
    <li className={styles.inboxItem}>
      <p className={styles.itemTitle}>
        {item.title} <span className={styles.meta}>{item.source}</span>
      </p>
      {editing ? (
        <textarea className={styles.draftBox} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={8000} rows={4} aria-label={`Draft for ${item.title}`} />
      ) : (
        <p className={styles.sub}>{item.draft}</p>
      )}
      <div className={styles.actions}>
        {editing ? (
          <>
            <button type="button" className={styles.btn} disabled={locked} onClick={() => void send({ action: "edit", draft })}>
              Save
            </button>
            <button type="button" className={styles.btn} disabled={busy} onClick={() => { setEditing(false); setDraft(item.draft); }}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button type="button" className={styles.btn} disabled={locked} onClick={() => void send({ action: "approve" })}>
              Approve
            </button>
            <button type="button" className={styles.btn} disabled={locked} onClick={() => setEditing(true)}>
              Edit
            </button>
            <button type="button" className={styles.btn} disabled={locked} onClick={() => void send({ action: "reject" })}>
              Reject
            </button>
          </>
        )}
      </div>
      {error ? (
        <p className={styles.bad} role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function ModulePanel({ result, demo, refresh }: PanelProps<Data>) {
  if (result.status !== "ok") {
    return <Panel title="Authorizations" demo={demo} status={result.status} hint={result.status === "not_connected" ? result.hint : undefined} message={result.status === "error" ? result.message : undefined} />;
  }
  const data = result.data;
  return (
    <Panel title="Authorizations" demo={demo}>
      {data.items.length === 0 ? (
        <p className={styles.sub}>Nothing waiting.</p>
      ) : (
        <ul className={styles.list}>
          {data.items.map((i) => (
            <Entry key={i.id} item={i} live={!demo} refresh={refresh} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function toLines(data: Data): string[] {
  if (data.items.length === 0) return ["Nothing waiting for authorization."];
  return [data.items.length + " waiting for approval."].concat(data.items.map((i, n) => n + 1 + ". " + i.title + " (" + i.source + ")"), "Nothing is sent until you approve.");
}

const def: ModuleDef<Data> = {
  manifest: {
    id: "inbox",
    name: "Authorizations",
    description: "Items other tools send in, waiting for your yes or no. Approving only marks an item approved.",
    env: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "INBOX_TOKEN"],
    refreshSeconds: 60,
    size: "L",
  },
  Panel: ModulePanel,
  lines: toLines,
  demo: () => ({ items: [{ id: "1", title: "Reply to a customer question", source: "Store", draft: "Thanks for asking. The item ships within two days." }, { id: "2", title: "Post a product update", source: "Store", draft: "New arrivals this week." }] }),
  notConnectedHint: "Connect the database to see items waiting for approval.",
};

export default def;
