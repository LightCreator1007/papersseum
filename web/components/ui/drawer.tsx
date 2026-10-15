"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { durMs } from "@/lib/motion";
import styles from "./drawer.module.css";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  side?: "right";
  children: ReactNode;
};

const subscribeNothing = () => () => {};
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A modal side panel. While open the rest of the page is inert, Escape and the backdrop
 * close it, and focus goes back to whatever opened it. It stays mounted for one exit
 * transition after `open` turns false.
 */
export function Drawer({ open, onClose, title, side = "right", children }: DrawerProps) {
  const isClient = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const [mounted, setMounted] = useState(open);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setMounted(true);
  }

  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open || !isClient) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const inerted: Element[] = [];
    for (const el of Array.from(document.body.children)) {
      if (el === rootRef.current || el.hasAttribute("inert") || el.hasAttribute("data-inert-exempt")) continue;
      if (el.tagName.toLowerCase().startsWith("nextjs-")) continue;
      el.setAttribute("inert", "");
      inerted.push(el);
    }

    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      inerted.forEach((el) => el.removeAttribute("inert"));
      if (opener?.isConnected) opener.focus();
    };
  }, [open, isClient]);

  useEffect(() => {
    if (open || !mounted) return;
    const t = setTimeout(() => setMounted(false), durMs.slow);
    return () => clearTimeout(t);
  }, [open, mounted]);

  if (!isClient || !(mounted || open)) return null;
  const state = open ? "open" : "closed";

  return createPortal(
    <div ref={rootRef} className={styles.root} inert={!open}>
      <div className={styles.backdrop} data-state={state} data-drawer-backdrop="" onClick={() => onClose()} />
      <div
        ref={panelRef}
        className={styles.panel}
        data-side={side}
        data-state={state}
        data-lenis-prevent=""
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button type="button" className={styles.close} onClick={() => onClose()} aria-label={`Close ${title}`} data-press="">
            <span aria-hidden="true">&times;</span>
          </button>
        </header>
        <div className={styles.body}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
