"use client";

import { useState, type FormEvent } from "react";
import styles from "./addform.module.css";

type Props = {
  endpoint: string;
  field: string;
  placeholder: string;
  label: string;
  max: number;
  onDone: () => void;
};

export default function AddForm({ endpoint, field, placeholder, label, max, onDone }: Props) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!value.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        setValue("");
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
      <input className={styles.input} value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} aria-label={label} maxLength={max} autoComplete="off" />
      <button type="submit" className={styles.add} disabled={busy || value.trim().length === 0}>
        ADD
      </button>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
