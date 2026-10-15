"use client";

import { useCallback, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./cx";
import styles from "./tabs.module.css";

export type TabItem = { id: string; label: string; content: ReactNode };

type TabsProps = {
  label: string;
  items: TabItem[];
  defaultId?: string;
  value?: string;
  onValueChange?: (id: string) => void;
  className?: string;
};

export function Tabs({ label, items, defaultId, value, onValueChange, className }: TabsProps) {
  const uid = useId();
  const [inner, setInner] = useState(defaultId ?? items[0]?.id);
  const current = value ?? inner;
  const listRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  const select = useCallback(
    (id: string) => {
      if (value === undefined) setInner(id);
      onValueChange?.(id);
    },
    [value, onValueChange],
  );

  // Places the sliding indicator through --js-tab-x / --js-tab-w (see styles/motion.css).
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const place = () => {
      const tab = current ? tabRefs.current.get(current) : undefined;
      if (!tab) return;
      list.style.setProperty("--js-tab-x", `${tab.offsetLeft}px`);
      list.style.setProperty("--js-tab-w", String(tab.offsetWidth));
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(list);
    return () => ro.disconnect();
  }, [current, items]);

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const i = items.findIndex((t) => t.id === current);
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % items.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const id = items[next].id;
    select(id);
    tabRefs.current.get(id)?.focus();
  };

  if (items.length === 0) return null;

  return (
    <div className={cx(styles.tabs, className)}>
      <div ref={listRef} className={styles.list} role="tablist" aria-label={label} onKeyDown={onKeyDown}>
        {items.map((t) => (
          <button
            key={t.id}
            ref={(el) => {
              if (el) tabRefs.current.set(t.id, el);
              else tabRefs.current.delete(t.id);
            }}
            type="button"
            role="tab"
            id={`${uid}-tab-${t.id}`}
            aria-selected={t.id === current}
            aria-controls={t.id === current ? `${uid}-panel-${t.id}` : undefined}
            tabIndex={t.id === current ? 0 : -1}
            className={styles.tab}
            onClick={() => select(t.id)}
          >
            {t.label}
          </button>
        ))}
        <span className={styles.indicator} data-tabs-indicator="" aria-hidden="true" />
      </div>
      {items.map((t) =>
        t.id === current ? (
          <div key={t.id} role="tabpanel" id={`${uid}-panel-${t.id}`} aria-labelledby={`${uid}-tab-${t.id}`} className={styles.panel}>
            {t.content}
          </div>
        ) : null,
      )}
    </div>
  );
}
