import { cx } from "./cx";
import styles from "./stat.module.css";

type StatProps = {
  label: string;
  value: string | number;
  /** A signed change. A number is formatted with its sign; a string is shown as given. */
  delta?: number | string;
  className?: string;
};

function deltaDirection(delta: number | string): "up" | "down" | "flat" {
  const n = typeof delta === "number" ? delta : Number.parseFloat(delta);
  if (Number.isNaN(n) || n === 0) return "flat";
  return n > 0 ? "up" : "down";
}

export function Stat({ label, value, delta, className }: StatProps) {
  const dir = delta === undefined ? null : deltaDirection(delta);
  const shown = typeof delta === "number" ? `${delta > 0 ? "+" : ""}${delta}` : delta;
  return (
    <dl className={cx(styles.stat, className)}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>
        <span className={styles.number}>{value}</span>
        {dir && shown !== undefined ? (
          <span className={styles.delta} data-dir={dir}>
            <span className={styles.arrow} aria-hidden="true">
              {dir === "up" ? "\u25B2" : dir === "down" ? "\u25BC" : "\u25C6"}
            </span>
            {shown}
            <span className="visually-hidden">{dir === "up" ? " up" : dir === "down" ? " down" : " unchanged"}</span>
          </span>
        ) : null}
      </dd>
    </dl>
  );
}
