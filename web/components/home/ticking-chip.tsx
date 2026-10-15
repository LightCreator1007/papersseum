"use client";

import { useEffect, useState } from "react";
import styles from "./home.module.css";

// The "Validating 0:04" chip on the feature card. Loops a short count so the card feels live.
export function TickingChip({ label, loop = 9 }: { label: string; loop?: number }) {
  const [s, setS] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setS((v) => (v + 1) % loop), 1000);
    return () => window.clearInterval(id);
  }, [loop]);
  return (
    <span className={styles.chip}>
      <i aria-hidden />
      {label} <b>0:{String(s).padStart(2, "0")}</b>
    </span>
  );
}
