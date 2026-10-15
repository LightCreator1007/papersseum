"use client";

import { useId, useState, type ReactNode } from "react";
import styles from "./faq.module.css";

// One question as a disclosure: a button with aria-expanded in a heading, and a panel
// whose height eases between 0fr and 1fr. A closed panel is inert, so its text is out
// of the tab order and the accessibility tree until it opens.
export function FaqItem({ question, children }: { question: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={styles.item} data-open={open || undefined}>
      <h3 className={styles.q}>
        <button
          type="button"
          id={`${id}-q`}
          aria-expanded={open}
          aria-controls={`${id}-a`}
          onClick={() => setOpen((o) => !o)}
        >
          <span className={styles.qText}>{question}</span>
          <svg className={styles.icon} viewBox="0 0 12 12" aria-hidden="true">
            <rect x="4" y="0" width="4" height="4" data-arm="v" />
            <rect x="0" y="4" width="4" height="4" />
            <rect x="4" y="4" width="4" height="4" />
            <rect x="8" y="4" width="4" height="4" />
            <rect x="4" y="8" width="4" height="4" data-arm="v" />
          </svg>
        </button>
      </h3>
      <div id={`${id}-a`} className={styles.panel} inert={!open}>
        <div className={styles.panelInner}>
          <p>{children}</p>
        </div>
      </div>
    </div>
  );
}
