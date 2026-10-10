"use client";

import { useState, type FormEvent } from "react";
import styles from "./eventform.module.css";

function todayLocal(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export default function EventForm({ onDone }: { onDone: () => void }) {
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
        setError(data.error ?? "Could not save");
      }
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <input className={styles.control} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What is happening" aria-label="Event title" maxLength={200} autoComplete="off" required />
      <div className={styles.row}>
        <label className={styles.field}>
          Date
          <input className={styles.control} type="date" value={day} onChange={(e) => setDay(e.target.value)} required />
        </label>
        <label className={styles.field}>
          Repeats
          <select className={styles.control} value={repeat} onChange={(e) => setRepeat(e.target.value)}>
            <option value="none">Never</option>
            <option value="daily">Every day</option>
            <option value="weekly">Every week</option>
            <option value="monthly">Every month</option>
            <option value="yearly">Every year</option>
          </select>
        </label>
      </div>
      <div className={styles.row}>
        <label className={styles.field}>
          Starts
          <input className={styles.control} type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className={styles.field}>
          Ends
          <input className={styles.control} type="time" value={end} onChange={(e) => setEnd(e.target.value)} disabled={!start} />
        </label>
      </div>
      <p className={styles.hint}>Leave the times empty for an all-day event.</p>
      <button type="submit" className={styles.save} disabled={busy || title.trim().length === 0}>
        ADD EVENT
      </button>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
