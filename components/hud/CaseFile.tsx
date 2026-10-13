"use client";

import { useEffect, useRef } from "react";
import type { AnyModule, ModuleResult } from "@/modules/types";
import { useTr } from "./lang";
import styles from "./casefile.module.css";

type Props = {
  mod: AnyModule;
  result: ModuleResult<unknown>;
  onClose: () => void;
};

function stamp(result: ModuleResult<unknown>): string {
  if (result.status === "not_connected") return "NO DATA";
  if (result.status === "error") return "ERROR";
  return "ON FILE";
}

export default function CaseFile({ mod, result, onClose }: Props) {
  const tr = useTr();
  const closeRef = useRef<HTMLButtonElement>(null);
  const { id, name, description, env, refreshSeconds } = mod.manifest;
  const lines = result.status === "ok" ? mod.lines(result.data, tr) : [tr(result.status === "error" ? result.message : result.hint)];
  const updated = result.status === "ok" ? new Date(result.fetchedAt).toLocaleTimeString("en-GB") : tr("NEVER");

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <article className={styles.file} role="dialog" aria-modal="true" aria-label={tr("{name} file", { name: tr(name) })} onClick={(event) => event.stopPropagation()}>
        <header className={styles.head}>
          <p className={styles.kind}>{tr("CASE FILE")}</p>
          <p className={styles.ref}>PSF-{id.toUpperCase()}</p>
          <span className={styles.stamp} data-tone={result.status === "ok" ? "ok" : "off"}>
            {tr(stamp(result))}
          </span>
          <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label={tr("Close file")}>
            {tr("CLOSE")}
          </button>
        </header>
        <h2 className={styles.title}>{tr(name).toUpperCase()}</h2>
        <dl className={styles.fields}>
          <dt>{tr("Subject")}</dt>
          <dd>{tr(description)}</dd>
          <dt>{tr("Updated")}</dt>
          <dd>{updated}</dd>
          <dt>{tr("Refresh")}</dt>
          <dd>{refreshSeconds >= 60 ? tr("every {n} min", { n: Math.round(refreshSeconds / 60) }) : tr("every {n} s", { n: refreshSeconds })}</dd>
          <dt>{tr("Source")}</dt>
          <dd>{env.length === 0 ? tr("none needed") : env.join(", ")}</dd>
        </dl>
        <ul className={styles.entries}>
          {lines.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
      </article>
    </div>
  );
}
