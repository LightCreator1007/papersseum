import { TIME_ZONE } from "@/features/ladder/format";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function dayKey(ms: number): string {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

// The heading a match sits under: "Last hour", "Earlier today", "Yesterday", then the date.
export function timeGroup(iso: string, now: number): string {
  const at = Date.parse(iso);
  if (now - at < HOUR) return "Last hour";
  const day = dayKey(at);
  if (day === dayKey(now)) return "Earlier today";
  if (day === dayKey(now - DAY)) return "Yesterday";
  return new Date(at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: TIME_ZONE });
}

// Consecutive runs that share a heading. Input order is kept, so a newest-first list stays newest first.
export function groupByTime<T>(items: T[], when: (item: T) => string, now: number): { label: string; items: T[] }[] {
  const groups: { label: string; items: T[] }[] = [];
  for (const item of items) {
    const label = timeGroup(when(item), now);
    const last = groups.at(-1);
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}
