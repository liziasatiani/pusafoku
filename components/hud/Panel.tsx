import type { ReactNode } from "react";
import { useTr } from "./lang";
import styles from "./hud.module.css";

type Props = {
  title: string;
  demo?: boolean;
  status?: "ok" | "not_connected" | "error";
  hint?: string;
  message?: string;
  children?: ReactNode;
};

export default function Panel({ title, demo, status = "ok", hint, message, children }: Props) {
  const tr = useTr();
  return (
    <section className={styles.panel} aria-label={tr(title)}>
      <header className={styles.panelHead}>
        <h2 className={styles.panelTitle}>{tr(title)}</h2>
        {demo ? <span className={styles.demoTag}>{tr("DEMO")}</span> : null}
        <span className={`${styles.dot} ${status === "ok" ? styles.dotOk : status === "error" ? styles.dotBad : styles.dotOff}`} aria-hidden="true" />
      </header>
      <div className={styles.panelBody}>
        {status === "not_connected" ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>{tr("Not connected")}</p>
            <p className={styles.emptyHint}>{hint ? tr(hint) : null}</p>
          </div>
        ) : status === "error" ? (
          <div className={styles.empty}>
            <p className={`${styles.emptyTitle} ${styles.bad}`}>{tr("Error")}</p>
            <p className={styles.emptyHint}>{message ? tr(message) : null}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
