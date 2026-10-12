"use client";

import { useState, type FormEvent } from "react";
import { useTr } from "./lang";
import styles from "./eventform.module.css";

function todayLocal(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export default function EventForm({ onDone }: { onDone: () => void }) {
  const tr = useTr();
  const [title, setTitle] = useState("");
  const [day, setDay] = useState(todayLocal);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [repeat, setRepeat] = useState("none");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, day, start, end, repeat }),
      });
      if (res.ok) {
        setTitle("");
        setStart("");
        setEnd("");
        setRepeat("none");
        onDone();
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(tr(data.error ?? "Could not save"));
      }
    } catch {
      setError(tr("Could not reach the server"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <input className={styles.control} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr("What is happening")} aria-label={tr("Event title")} maxLength={200} autoComplete="off" required />
      <div className={styles.row}>
        <label className={styles.field}>
          {tr("Date")}
          <input className={styles.control} type="date" value={day} onChange={(e) => setDay(e.target.value)} required />
        </label>
        <label className={styles.field}>
          {tr("Repeats")}
          <select className={styles.control} value={repeat} onChange={(e) => setRepeat(e.target.value)}>
            <option value="none">{tr("Never")}</option>
            <option value="daily">{tr("Every day")}</option>
            <option value="weekly">{tr("Every week")}</option>
            <option value="monthly">{tr("Every month")}</option>
            <option value="yearly">{tr("Every year")}</option>
          </select>
        </label>
      </div>
      <div className={styles.row}>
        <label className={styles.field}>
          {tr("Starts")}
          <input className={styles.control} type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className={styles.field}>
          {tr("Ends")}
          <input className={styles.control} type="time" value={end} onChange={(e) => setEnd(e.target.value)} disabled={!start} />
        </label>
      </div>
      <p className={styles.hint}>{tr("Leave the times empty for an all-day event.")}</p>
      <button type="submit" className={styles.save} disabled={busy || title.trim().length === 0}>
        {tr("ADD EVENT")}
      </button>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
