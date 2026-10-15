import { cloneElement, useId, type ReactElement } from "react";
import { cx } from "./cx";
import styles from "./tooltip.module.css";

type TooltipProps = {
  label: string;
  /** One focusable element. It gets aria-describedby pointing at the tip. */
  children: ReactElement<{ "aria-describedby"?: string }>;
  className?: string;
};

/** Shows on hover (fine pointers) and on keyboard focus. The show and hide motion lives in styles/motion.css. */
export function Tooltip({ label, children, className }: TooltipProps) {
  const id = useId();
  return (
    <span className={cx(styles.wrap, className)} data-tooltip="">
      {cloneElement(children, { "aria-describedby": id })}
      <span role="tooltip" id={id} className={styles.tip}>
        {label}
      </span>
    </span>
  );
}
