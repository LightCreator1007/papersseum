import type { ReactNode } from "react";
import { cx } from "./cx";
import styles from "./chip.module.css";

export type PlayerSlot = 0 | 1 | 2 | 3 | 4;

type ChipProps = {
  children: ReactNode;
  /** A player colour, shown only as a swatch dot. Use only where a player is. */
  slot?: PlayerSlot;
  /** Makes the chip a toggle button. */
  selected?: boolean;
  onClick?: () => void;
  className?: string;
};

export function Chip({ children, slot, selected, onClick, className }: ChipProps) {
  const dot = slot === undefined ? null : <span className={styles.dot} style={{ background: `var(--slot-${slot})` }} aria-hidden="true" />;
  if (onClick) {
    return (
      <button type="button" className={cx(styles.chip, styles.action, className)} aria-pressed={selected ?? false} onClick={onClick} data-press="">
        {dot}
        {children}
      </button>
    );
  }
  return (
    <span className={cx(styles.chip, className)} data-selected={selected || undefined}>
      {dot}
      {children}
    </span>
  );
}
