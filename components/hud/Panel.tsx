import type { ReactNode } from "react";
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
  return (
    <section className={styles.panel} aria-label={title}>
      <header className={styles.panelHead}>
        <h2 className={styles.panelTitle}>{title}</h2>
        {demo ? <span className={styles.demoTag}>DEMO</span> : null}
        <span className={`${styles.dot} ${status === "ok" ? styles.dotOk : status === "error" ? styles.dotBad : styles.dotOff}`} aria-hidden="true" />
      </header>
      <div className={styles.panelBody}>
        {status === "not_connected" ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>Not connected</p>
            <p className={styles.emptyHint}>{hint}</p>
          </div>
        ) : status === "error" ? (
          <div className={styles.empty}>
            <p className={`${styles.emptyTitle} ${styles.bad}`}>Error</p>
            <p className={styles.emptyHint}>{message}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
