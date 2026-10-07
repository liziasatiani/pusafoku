"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";

export default function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace("/");
        router.refresh();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError((data.error ?? "Sign-in failed").toUpperCase());
    } catch {
      setError("SERVER UNREACHABLE");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.card} onSubmit={submit}>
      <h1 className={styles.brand}>PUSAFOKU</h1>
      <p className={styles.hint}>ACCESS TERMINAL</p>
      <p className={styles.hint}>PRIVATE SYSTEM. ONE OPERATOR.</p>
      <label className={styles.field} htmlFor="password">
        &gt; Passphrase
        <input
          id="password"
          className={styles.input}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
        />
      </label>
      <p className={styles.error} role="alert">
        {error}
      </p>
      <button className={styles.button} type="submit" disabled={busy || password.length === 0}>
        {busy ? "CHECKING" : "ENTER"}
      </button>
    </form>
  );
}
