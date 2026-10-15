"use client";

import { useEffect, useState } from "react";
import { minutesUntil, nextRoundAt } from "@/features/ladder/format";

// Computed in the browser so a cached page never shows a stale countdown.
// While the arena skips rounds for a backlog there is no next round to count down to.
export function NextRound({
  frozen,
  backlog = false,
  compact = false,
}: {
  frozen: boolean;
  backlog?: boolean;
  compact?: boolean;
}) {
  const [minutes, setMinutes] = useState<number | null>(null);
  useEffect(() => {
    if (frozen || backlog) return;
    const tick = () => {
      const now = Date.now();
      setMinutes(minutesUntil(nextRoundAt(now), now));
    };
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, [frozen, backlog]);
  if (frozen) return null;
  if (backlog) return <span>{compact ? "After the queue clears" : "Next round after the queue clears"}</span>;
  if (minutes === null) return null;
  return <span>{compact ? `${minutes} min` : `next round in ${minutes} min`}</span>;
}
