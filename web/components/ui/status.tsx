import { cx } from "./cx";
import styles from "./status.module.css";

export type StatusTone = "live" | "waiting" | "done" | "failed" | "paused";

/** A dot plus its words. Colour is never the only signal: each tone also has its own shape. */
export function Status({ tone, label, className }: { tone: StatusTone; label: string; className?: string }) {
  return (
    <span className={cx(styles.status, className)} data-tone={tone}>
      <span className={cx(styles.mark, styles[tone])} aria-hidden="true" />
      {label}
    </span>
  );
}
