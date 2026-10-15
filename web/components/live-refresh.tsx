"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/browser";
import {
  CONNECT_GRACE_MS, POLL_MS, nextLiveState, reconnectingText, shouldCatchUp, shouldPoll,
  type LiveEvent, type LiveState,
} from "@/components/live-refresh-state";
import styles from "./live-refresh.module.css";

type LiveTable = "bots" | "submissions" | "matches";

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

// Re-renders the page's server data when rows change. While the channel isn't
// joined (a drop, a refused join, the realtime quota) it polls every 30 s
// instead and shows a "Reconnecting" line, which goes away once it is back.
// `quiet` keeps the polling but hides the line.
export function LiveRefresh({ table, filter, quiet = false }: { table: LiveTable; filter?: string; quiet?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<LiveState>("connecting");
  const stateRef = useRef<LiveState>("connecting");
  const online = useSyncExternalStore(onConnection, isOnline, assumeOnline);

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let channel: RealtimeChannel | undefined;
    let cancelled = false;
    const apply = (event: LiveEvent) => {
      if (cancelled) return;
      const prev = stateRef.current;
      const next = nextLiveState(prev, event);
      if (next === prev) return;
      stateRef.current = next;
      setState(next);
      if (shouldCatchUp(prev, next)) router.refresh();
    };
    const grace = setTimeout(() => apply("grace-expired"), CONNECT_GRACE_MS);
    (async () => {
      // The browser client loads the session asynchronously. A channel that
      // joins before the token is known joins as anonymous, and the server
      // refuses row-level-security tables (like submissions) for it.
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) await supabase.realtime.setAuth(token);
      } catch {
        // Signed out or session unreadable: join as anonymous. Public tables still work.
      }
      if (cancelled) return;
      channel = supabase
        .channel(`live:${table}:${filter ?? "all"}`)
        .on("postgres_changes", { event: "*", schema: "public", table, ...(filter ? { filter } : {}) }, () => {
          clearTimeout(timer);
          timer = setTimeout(() => router.refresh(), 400);
        })
        .subscribe((status) => apply(status));
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(grace);
      if (channel) supabase.removeChannel(channel);
    };
  }, [table, filter, router]);

  const polling = shouldPoll(state);
  useEffect(() => {
    if (!polling) return;
    const refresh = () => {
      if (!document.hidden && navigator.onLine) router.refresh();
    };
    const id = window.setInterval(refresh, POLL_MS);
    window.addEventListener("online", refresh);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("online", refresh);
    };
  }, [polling, router]);

  if (quiet || (state !== "reconnecting" && online)) return null;
  return (
    <p className={styles.line} role="status" data-offline={!online || undefined}>
      <i aria-hidden="true" />
      {reconnectingText(online)}
    </p>
  );
}
