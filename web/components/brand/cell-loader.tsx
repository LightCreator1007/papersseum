import styles from './cell-loader.module.css';

/** A 3x3 loader for wherever a spinner would go. CSS only; `label` is the accessible name and, under reduced motion, visible text. */
export function CellLoader({ label }: { label: string }) {
  return (
    <div className={styles.loader} role="status">
      <div className={styles.grid} aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className={styles.cell} />
        ))}
      </div>
      <span className={styles.label}>{label}</span>
    </div>
  );
}
