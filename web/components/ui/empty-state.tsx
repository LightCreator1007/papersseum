import type { ReactNode } from "react";
import { Button, ButtonLink } from "./button";
import { cx } from "./cx";
import styles from "./empty-state.module.css";

type Action = { label: string; onClick?: () => void; href?: string };

type EmptyStateProps = {
  /** An optional drawing or character. Decorative. */
  art?: ReactNode;
  title: string;
  body: string;
  /** The one thing to do next. There is only ever one primary action. */
  action?: Action;
  /** A quieter way out, shown as a text link. */
  secondary?: Action;
  className?: string;
};

function Primary({ action }: { action: Action }) {
  if (action.href) {
    return (
      <ButtonLink href={action.href} variant="ink" data-primary-action="">
        {action.label}
      </ButtonLink>
    );
  }
  return (
    <Button variant="ink" onClick={action.onClick} data-primary-action="">
      {action.label}
    </Button>
  );
}

function Secondary({ action }: { action: Action }) {
  if (action.href) return <ButtonLink href={action.href} variant="link">{action.label}</ButtonLink>;
  return <Button variant="link" onClick={action.onClick}>{action.label}</Button>;
}

export function EmptyState({ art, title, body, action, secondary, className }: EmptyStateProps) {
  return (
    <div className={cx(styles.empty, className)}>
      {art ? <div className={styles.art} aria-hidden="true">{art}</div> : null}
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.body}>{body}</p>
      {action || secondary ? (
        <div className={styles.actions}>
          {action ? <Primary action={action} /> : null}
          {secondary ? <Secondary action={secondary} /> : null}
        </div>
      ) : null}
    </div>
  );
}
