"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import styles from "./auto-refresh.module.css";

// Re-renders the server components on this page every `every` ms while the tab
// is visible. Public pages poll instead of subscribing (see specs/redesign/README.md rule 3).
// With `stamp`, it also shows how fresh the page is, and says so when the browser is
// offline (the "Stale or offline" column of the screen state matrix).

let lastRefresh = 0; // when this page's data was last asked for; one AutoRefresh per page

const tick = (notify: () => void) => {
  const id = window.setInterval(notify, 1000);
  return () => window.clearInterval(id);
};
const ageSeconds = () => (lastRefresh ? Math.floor((Date.now() - lastRefresh) / 1000) : 0);
const noAge = () => null;

const onConnection = (notify: () => void) => {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
};
const isOnline = () => navigator.onLine;
const assumeOnline = () => true;

function ago(s: number) {
  if (s < 5) return "just now";
  if (s < 60) return `${s} s ago`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ago`;
}

export function AutoRefresh({ every = 30_000, stamp = false }: { every?: number; stamp?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    lastRefresh = Date.now();
    const id = window.setInterval(() => {
      if (document.hidden || !navigator.onLine) return;
      lastRefresh = Date.now();
      router.refresh();
    }, every);
    // Coming back online or to the tab: catch up at once rather than at the next interval.
    const catchUp = () => {
      if (document.hidden || !navigator.onLine || Date.now() - lastRefresh < every) return;
      lastRefresh = Date.now();
      router.refresh();
    };
    window.addEventListener("online", catchUp);
    document.addEventListener("visibilitychange", catchUp);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("online", catchUp);
      document.removeEventListener("visibilitychange", catchUp);
    };
  }, [router, every]);

  const age = useSyncExternalStore(stamp ? tick : noop, ageSeconds, noAge);
  const online = useSyncExternalStore(onConnection, isOnline, assumeOnline);
  if (!stamp) return null;

  return (
    <p className={styles.stamp} data-offline={!online || undefined}>
      <i aria-hidden />
      {!online
        ? `Offline. Showing what loaded ${age === null ? "earlier" : ago(age)}.`
        : age === null
          ? "Live"
          : `Live · updated ${ago(age)}`}
    </p>
  );
}

function noop() {
  return () => {};
}
