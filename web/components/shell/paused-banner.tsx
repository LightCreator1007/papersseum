"use client";

import { useEffect, useState } from "react";
import styles from "./paused-banner.module.css";

export const STATUS_POLL_MS = 30_000;

type StatusBody = { worker?: string } | null;

export function bannerFor(status: StatusBody): string | null {
  if (status?.worker === "paused") {
    return "Matches are paused. Uploads still work; they will be checked when matches resume.";
  }
  return null;
}

export function PausedBanner() {
  const [status, setStatus] = useState<StatusBody>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as StatusBody;
        if (alive) setStatus(body);
      } catch {
        // A failed status poll keeps the last known state; the next tick retries.
      }
    };
    void load();
    const id = window.setInterval(load, STATUS_POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const text = bannerFor(status);
  if (!text || dismissed) return null;
  return (
    <div className={styles.banner} role="status">
      <div className="wrap">
        <span className={styles.dot} aria-hidden />
        {text} <a href="/status">Status</a>
        <button type="button" className={styles.close} onClick={() => setDismissed(true)} aria-label="Hide this notice">
          ×
        </button>
      </div>
    </div>
  );
}
