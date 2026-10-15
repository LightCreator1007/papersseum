import type { Database } from "@/lib/supabase/database.types";

export const TIME_ZONE = "Asia/Kolkata";

type SubmissionStatus = Database["public"]["Enums"]["submission_status"];
type MatchStatus = Database["public"]["Enums"]["match_status"];

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const ROUND_EVERY = 15 * MINUTE; // pg_cron: */15 * * * *

export function relativeTime(iso: string, now: number = Date.now()): string {
  const diff = now - Date.parse(iso);
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} h ago`;
  return shortDate(iso);
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: TIME_ZONE });
}

export function shortDateTime(iso: string): string {
  return `${shortDate(iso)}, ${clockTime(Date.parse(iso))}`;
}

// Every absolute time on the site is Kolkata time, so it says so.
export function clockTime(ms: number): string {
  const time = new Date(ms).toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TIME_ZONE,
  });
  return `${time} IST`;
}

export function duration(startIso: string, endIso: string): string {
  const secs = Math.round((Date.parse(endIso) - Date.parse(startIso)) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m} min ${s} s` : `${s} s`;
}

export function elo(n: number | null): string {
  return n === null ? "-" : n.toFixed(1);
}

// A bot with no games has only the starting Elo, so it isn't rated yet (same as the leaderboard).
export function rating(n: number | null, games: number): string {
  return games === 0 ? "Not rated yet" : elo(n);
}

export function eloChange(before: number | null, after: number | null) {
  if (before === null || after === null) return null;
  const d = Math.round((after - before) * 10) / 10;
  if (d > 0) return { text: `+${d.toFixed(1)}`, tone: "up" as const };
  if (d < 0) return { text: `−${Math.abs(d).toFixed(1)}`, tone: "down" as const };
  return { text: "0.0", tone: "none" as const };
}

export function percent(n: number | null): string {
  return n === null ? "-" : `${n.toFixed(1)}%`;
}

export function intervalMinutes(text: string): number {
  const m = /^(\d+):(\d{2}):(\d{2})$/.exec(text);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

export function nextRoundAt(now: number): number {
  return (Math.floor(now / ROUND_EVERY) + 1) * ROUND_EVERY;
}

export type RoundOutlook = { frozen: boolean; backlog: boolean; noPlayers?: boolean; at: number };

// One sentence on when the next round runs. A backlogged arena skips rounds, so no clock time then.
export function nextRoundSentence(
  { frozen, backlog, noPlayers = false, at }: RoundOutlook,
  { first = false }: { first?: boolean } = {},
): string {
  if (frozen) return "The season is frozen, so no rounds are scheduled.";
  if (backlog) return "Next round after the queue clears.";
  if (noPlayers) return "Rounds start once a player has a bot on the ladder.";
  return first ? `The first round runs at ${clockTime(at)}.` : `Next round at ${clockTime(at)}.`;
}

export function minutesUntil(target: number, now: number): number {
  return Math.max(1, Math.ceil((target - now) / MINUTE));
}

export const SUBMISSION_STATUS: Record<SubmissionStatus, string> = {
  pending: "Checking…",
  validating: "Checking…",
  active: "Active",
  rejected: "Rejected",
  superseded: "Replaced",
};

export const MATCH_STATUS: Record<MatchStatus, string> = {
  queued: "Waiting",
  running: "Playing",
  done: "Finished",
  failed: "Failed",
};
