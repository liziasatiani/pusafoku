"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { SUGGESTIONS } from "@/lib/commands";
import styles from "./commandline.module.css";

type Props = {
  ask: (input: string) => string[];
  onBusy?: (busy: boolean) => void;
  compact?: boolean;
};

type Entry = { id: number; kind: "in" | "out"; text: string };

export default function CommandLine({ ask, onBusy, compact }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [value, setValue] = useState("");
  const run = useRef(0);
  const nextId = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries]);

  useEffect(() => () => {
    run.current += 1;
  }, []);

  async function submit(raw: string) {
    const text = raw.trim();
    if (!text) return;
    const id = ++run.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setEntries((list) => [...list, { id: nextId.current++, kind: "in", text: `> ${text}` }]);
    onBusy?.(true);
    for (const line of ask(text)) {
      const lineId = nextId.current++;
      setEntries((list) => [...list, { id: lineId, kind: "out", text: "" }]);
      if (reduced) {
        setEntries((list) => list.map((e) => (e.id === lineId ? { ...e, text: line } : e)));
        continue;
      }
      for (let i = 1; i <= line.length; i += 2) {
        if (id !== run.current) return;
        setEntries((list) => list.map((e) => (e.id === lineId ? { ...e, text: line.slice(0, i + 1) } : e)));
        await new Promise((resolve) => setTimeout(resolve, 14));
      }
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    if (id === run.current) onBusy?.(false);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = value;
    setValue("");
    void submit(text);
  }

  return (
    <div className={`${styles.cli} ${compact ? styles.compact : ""}`}>
      {entries.length > 0 ? (
        <div ref={logRef} className={styles.log} aria-live="polite">
          {entries.map((e) => (
            <p key={e.id} className={e.kind === "in" ? styles.in : styles.out}>
              {e.text}
            </p>
          ))}
        </div>
      ) : null}
      <div className={styles.sugg}>
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" className={styles.suggBtn} onClick={() => void submit(s)}>
            {s}
          </button>
        ))}
      </div>
      <form className={styles.prompt} onSubmit={onSubmit}>
        <label htmlFor="cmd" className={styles.caret}>
          &gt;
        </label>
        <input id="cmd" className={styles.input} value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" placeholder="Type a command. Try: start my day" />
        <button type="submit" className={styles.send}>
          SEND
        </button>
      </form>
    </div>
  );
}
