"use client";

import { useState, type FormEvent } from "react";
import { useTr } from "./lang";
import styles from "./eventform.module.css";

export default function ClassBreaks({ onDone }: { onDone: () => void }) {
  const tr = useTr();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function send(method: "POST" | "DELETE") {
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/events/skip", {
        method,
        headers: { "content-type": "application/json" },
        body: method === "POST" ? JSON.stringify({ from, to }) : undefined,
      });
      const data = (await res.json().catch(() => ({}))) as { classes?: number; days?: number; error?: string };
      if (res.ok) {
        setNote(method === "POST" ? tr("{n} days hidden for {c} classes", { n: data.days ?? 0, c: data.classes ?? 0 }) : tr("All classes are shown again"));
        onDone();
      } else {
        setNote(tr(data.error ?? "Could not save"));
      }
    } catch {
      setNote(tr("Could not reach the server"));
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void send("POST");
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.row}>
        <label className={styles.field}>
          {tr("From")}
          <input className={styles.control} type="date" value={from} onChange={(e) => setFrom(e.target.value)} required />
        </label>
        <label className={styles.field}>
          {tr("To")}
          <input className={styles.control} type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} required />
        </label>
      </div>
      <button type="submit" className={styles.save} disabled={busy || !from || !to}>
        {tr("HIDE CLASSES")}
      </button>
      <button type="button" className={styles.save} disabled={busy} onClick={() => void send("DELETE")}>
        {tr("SHOW ALL CLASSES")}
      </button>
      {note ? (
        <p className={styles.hint} role="status">
          {note}
        </p>
      ) : null}
    </form>
  );
}
