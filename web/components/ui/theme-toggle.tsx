"use client";

import { useSyncExternalStore } from "react";
import { readTheme, writeTheme, type Theme } from "@/lib/theme";
import styles from "./theme-toggle.module.css";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function subscribe(onChange: () => void) {
  window.addEventListener("themechange", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("themechange", onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function ThemeToggle() {
  // null on the server: no segment is pressed until the stored choice is known.
  const theme = useSyncExternalStore<Theme | null>(subscribe, readTheme, () => null);

  return (
    <div className={styles.toggle} role="group" aria-label="Theme">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          className={styles.option}
          aria-pressed={theme === o.value}
          onClick={() => writeTheme(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
