"use client";

import { useState, type FormEvent } from "react";
import { useTr } from "./lang";
import styles from "./eventform.module.css";

export default function TermShift({ onDone }: { onDone: () => void }) {
  const tr = useTr();
  const [weeks, setWeeks] = useState("26");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/events/shift", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ weeks: Number(weeks) }),
      });
      const data = (await res.json().catch(() => ({}))) as { moved?: number; error?: string };
      if (res.ok) {
        setNote(data.moved ? tr("{n} classes moved", { n: data.moved }) : tr("No weekly classes with an end date to move"));
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

  return (
    <form className={styles.form} onSubmit={submit}>
      <label className={styles.field}>
        {tr("Weeks to move forward")}
        <input className={styles.control} type="number" inputMode="numeric" min={1} max={60} step={1} value={weeks} onChange={(e) => setWeeks(e.target.value)} required />
      </label>
      <button type="submit" className={styles.save} disabled={busy}>
        {tr("MOVE CLASSES")}
      </button>
      {note ? (
        <p className={styles.hint} role="status">
          {note}
        </p>
      ) : null}
    </form>
  );
}
