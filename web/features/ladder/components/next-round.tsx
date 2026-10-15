"use client";

import { useEffect, useState } from "react";
import { minutesUntil, nextRoundAt } from "@/features/ladder/format";

// Computed in the browser so a cached page never shows a stale countdown.
export function NextRound({ frozen }: { frozen: boolean }) {
  const [minutes, setMinutes] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      setMinutes(minutesUntil(nextRoundAt(now), now));
    };
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, []);
  if (frozen || minutes === null) return null;
  return <span>next round in {minutes} min</span>;
}
