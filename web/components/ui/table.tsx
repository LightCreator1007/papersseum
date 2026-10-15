import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cx } from "./cx";
import styles from "./table.module.css";

/**
 * A hairline table. Write native thead, tbody and tr inside it; use Th and Td for cells.
 * It scrolls sideways inside its own box rather than widening the page.
 */
export function Table({ caption, children, className }: { caption: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx(styles.wrap, className)} data-lenis-prevent="">
      <table className={styles.table}>
        <caption className="visually-hidden">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

type CellProps = {
  /** A numeric column: right aligned, monospaced, tabular. */
  num?: boolean;
  /** Clip a long value to one line with an ellipsis. */
  truncate?: boolean;
};

export function Th({ num, truncate, className, scope = "col", ...rest }: CellProps & ThHTMLAttributes<HTMLTableCellElement>) {
  return <th {...rest} scope={scope} className={cx(num && "num", truncate && styles.truncate, className)} />;
}

export function Td({ num, truncate, className, ...rest }: CellProps & TdHTMLAttributes<HTMLTableCellElement>) {
  return <td {...rest} className={cx(num && "num", truncate && styles.truncate, className)} />;
}
