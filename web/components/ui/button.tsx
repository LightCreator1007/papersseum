import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, CSSProperties, MouseEvent, ReactNode } from "react";
import { cx } from "./cx";
import styles from "./button.module.css";

export type ButtonVariant = "ink" | "ghost" | "link";
export type ButtonSize = "md" | "sm";

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

type ButtonProps = Common &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
    /** Work in flight. Uses aria-disabled, not disabled, so focus stays on the button. */
    pending?: boolean;
    /** Words shown while pending. Stacked over the label so the button keeps its width. */
    pendingLabel?: string;
  };

// Hover rolls the label up and a copy rolls in from below. A plain string is split into
// letters so the roll staggers; anything else rolls as one piece. The split copies are
// decoration only: screen readers get the label once, from the visually hidden span.
function Roll({ children }: { children: ReactNode }) {
  const text = typeof children === "string" ? children : null;
  const row = () =>
    text
      ? [...text].map((ch, i) => (
          <span key={i} className={styles.char} style={{ "--i": i } as CSSProperties}>
            {ch === " " ? " " : ch}
          </span>
        ))
      : children;
  return (
    <>
      <span className="sr-only">{children}</span>
      <span className={cx(styles.roll, text !== null && styles.split)} aria-hidden="true">
        <span className={styles.row}>{row()}</span>
        <span className={cx(styles.row, styles.rowNext)}>{row()}</span>
      </span>
    </>
  );
}

function Inner({
  children,
  pending,
  pendingLabel,
  roll,
}: {
  children: ReactNode;
  pending?: boolean;
  pendingLabel?: string;
  roll: boolean;
}) {
  return (
    <span className={styles.stack}>
      <span className={styles.label} data-hidden={pending || undefined} aria-hidden={pending && pendingLabel ? true : undefined}>
        {roll ? <Roll>{children}</Roll> : children}
      </span>
      {pending ? (
        <span className={styles.pending}>
          <span className={styles.dots} aria-hidden="true" />
          {pendingLabel}
        </span>
      ) : null}
    </span>
  );
}

export function Button({
  variant = "ink",
  size = "md",
  pending = false,
  pendingLabel,
  type = "button",
  className,
  onClick,
  children,
  ...rest
}: ButtonProps) {
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (pending || rest["aria-disabled"] === true || rest["aria-disabled"] === "true") {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };
  return (
    <button
      {...rest}
      type={type}
      className={cx(styles.button, styles[variant], size === "sm" && styles.sm, className)}
      data-variant={variant}
      data-press=""
      aria-disabled={pending ? true : rest["aria-disabled"]}
      aria-busy={pending || undefined}
      onClick={handleClick}
    >
      <Inner pending={pending} pendingLabel={pendingLabel} roll={variant !== "link"}>
        {children}
      </Inner>
    </button>
  );
}

type ButtonLinkProps = Common & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children" | "href"> & { href: string };

/** Same look as Button, for navigation. Uses next/link for internal routes. */
export function ButtonLink({ variant = "ink", size = "md", href, className, children, ...rest }: ButtonLinkProps) {
  const classes = cx(styles.button, styles[variant], size === "sm" && styles.sm, className);
  // A download is a file, not a route, so it skips client-side navigation too.
  const external = /^(https?:)?\/\//.test(href) || href.startsWith("mailto:") || rest.download !== undefined;
  const inner = <Inner roll={variant !== "link"}>{children}</Inner>;
  if (external) {
    return (
      <a {...rest} href={href} className={classes} data-variant={variant} data-press="">
        {inner}
      </a>
    );
  }
  return (
    <Link {...rest} href={href} className={classes} data-variant={variant} data-press="">
      {inner}
    </Link>
  );
}
