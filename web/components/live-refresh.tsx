"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/browser";

type LiveTable = "bots" | "submissions" | "matches";

// Re-renders the page's server data when rows change. If the connection
// drops nothing is shown; a reload or reconnect catches up.
export function LiveRefresh({ table, filter }: { table: LiveTable; filter?: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let channel: RealtimeChannel | undefined;
    let cancelled = false;
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
        .subscribe();
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [table, filter, router]);
  return null;
}
