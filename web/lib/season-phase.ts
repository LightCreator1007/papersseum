export type SeasonDates = { opensAt: string | null; closesAt: string | null; finalAt: string | null; frozen: boolean };
export type Phase = "unscheduled" | "upcoming" | "open" | "closing-soon" | "frozen" | "final" | "over";

const DAY = 86_400_000;

export function seasonPhase(d: SeasonDates, now: Date): { phase: Phase; target: string | null } {
  const t = now.getTime();
  const open = d.opensAt ? Date.parse(d.opensAt) : null;
  const close = d.closesAt ? Date.parse(d.closesAt) : null;
  const final = d.finalAt ? Date.parse(d.finalAt) : null;

  if (final !== null && t >= final + DAY) return { phase: "over", target: null };
  if (final !== null && t >= final) return { phase: "final", target: null };
  if (close !== null && t >= close) return { phase: "frozen", target: d.finalAt };
  if (d.frozen) return { phase: "frozen", target: d.finalAt };
  if (open !== null && t < open) return { phase: "upcoming", target: d.opensAt };
  if (close !== null && t >= close - DAY) return { phase: "closing-soon", target: d.closesAt };
  if (open !== null || close !== null) return { phase: "open", target: d.closesAt };
  return { phase: "unscheduled", target: null };
}

export function countdown(target: string, now: Date) {
  const ms = Math.max(0, Date.parse(target) - now.getTime());
  const s = Math.floor(ms / 1000);
  return {
    days: Math.floor(s / 86_400),
    hours: Math.floor((s % 86_400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    done: ms === 0,
  };
}
