import { cx } from "./cx";
import styles from "./skeleton.module.css";

/** Ruled rows that hold the space of a section while it streams in. Rows match the old Placeholder: 37px, hairline below. */
export function Skeleton({ rows = 3, label = "Loading", className }: { rows?: number; label?: string; className?: string }) {
  const count = Math.max(1, Math.floor(rows));
  return (
    <div className={cx(styles.skeleton, className)} role="status">
      <span className="visually-hidden">{label}</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={styles.row} aria-hidden="true">
          <span className={styles.bar} data-skeleton="" style={{ width: `${88 - ((i * 17) % 40)}%` }} />
        </div>
      ))}
    </div>
  );
}
