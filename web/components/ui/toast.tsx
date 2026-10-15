"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { durMs } from "@/lib/motion";
import { Status, type StatusTone } from "./status";
import styles from "./toast.module.css";

export type ToastInput = {
  title: string;
  body?: string;
  /** failed stays until dismissed; everything else leaves after a few seconds. */
  tone?: Extract<StatusTone, "done" | "failed" | "waiting">;
};

type Item = ToastInput & { id: number; closing: boolean };

const AUTO_DISMISS_MS = 5000;

const ToastContext = createContext<{ toast: (t: ToastInput) => void; dismiss: (id: number) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast needs a <ToastProvider> above it.");
  return ctx;
}

const subscribeNothing = () => () => {};

/** One toast. Presentational; ToastProvider handles the queue and the live region. */
export function Toast({ title, body, tone = "done", closing = false, onDismiss, onHold, onRelease }: ToastInput & {
  closing?: boolean;
  onDismiss: () => void;
  onHold?: () => void;
  onRelease?: () => void;
}) {
  return (
    <div className={styles.toast} data-state={closing ? "closed" : "open"} data-tone={tone} onPointerEnter={onHold} onPointerLeave={onRelease} onFocus={onHold} onBlur={onRelease}>
      <div className={styles.text}>
        <Status tone={tone} label={title} className={styles.title} />
        {body ? <p className={styles.body}>{body}</p> : null}
      </div>
      <button type="button" className={styles.close} onClick={onDismiss} aria-label={`Dismiss: ${title}`} data-press="">
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const isClient = useSyncExternalStore(subscribeNothing, () => true, () => false);

  const remove = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const clear = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      clear(id);
      setItems((list) => list.map((t) => (t.id === id ? { ...t, closing: true } : t)));
      timers.current.set(id, setTimeout(() => remove(id), durMs.moderate));
    },
    [clear, remove],
  );

  const arm = useCallback(
    (id: number) => {
      clear(id);
      timers.current.set(id, setTimeout(() => dismiss(id), AUTO_DISMISS_MS));
    },
    [clear, dismiss],
  );

  const toast = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++;
      setItems((list) => [...list, { ...input, id, closing: false }]);
      if (input.tone !== "failed") arm(id);
    },
    [arm],
  );

  useEffect(() => {
    const live = timers.current;
    return () => {
      live.forEach((t) => clearTimeout(t));
      live.clear();
    };
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {isClient
        ? createPortal(
            <div className={styles.region} data-inert-exempt="">
              <div className={styles.live} role="region" aria-label="Notifications" aria-live="polite" aria-relevant="additions text">
                {items.map((t) => (
                  <Toast
                    key={t.id}
                    title={t.title}
                    body={t.body}
                    tone={t.tone}
                    closing={t.closing}
                    onDismiss={() => dismiss(t.id)}
                    onHold={t.tone === "failed" || t.closing ? undefined : () => clear(t.id)}
                    onRelease={t.tone === "failed" || t.closing ? undefined : () => arm(t.id)}
                  />
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}
