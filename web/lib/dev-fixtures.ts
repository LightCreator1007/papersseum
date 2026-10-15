import { devAuthEnabled, type DevPersona } from "@/lib/dev-auth";
import type { Notification } from "@/lib/notifications";
import type { MyBot, MySubmission } from "@/features/ladder/queries";
import type { CheckProgress } from "@/features/upload/check-progress";
import type { SeatRow } from "@/lib/stats/scorecards";

// Fixture data behind the dev login (lib/dev-auth.ts). Seeded, so every reload shows the
// same thing. Each persona covers a different set of states on the /me pages.

const bot = (n: number) => `00000000-0000-4000-8000-00000000b00${n}`;
const sub = (b: number, v: number) => `00000000-0000-4000-8000-0000000${b}${String(v).padStart(4, "0")}`;

const BOTS: Record<DevPersona, MyBot | null> = {
  // New accounts get a bot named after the email handle, often a roll number (FigJam Identity).
  newcomer: { id: bot(1), name: "23bcs101", banned: false, activeVersion: null, rank: null },
  player: { id: bot(2), name: "ash_bot", banned: false, activeVersion: 3, rank: 12 },
  banned: { id: bot(3), name: "rule_bender", banned: true, activeVersion: 1, rank: null },
  organiser: null, // organisers run the season; they needn't have a bot
};

const hoursAgo = (h: number) => new Date(Date.UTC(2026, 9, 15, 12) - h * 3_600_000).toISOString();

const SUBMISSIONS: Record<string, MySubmission[]> = {
  [bot(1)]: [],
  [bot(2)]: [
    { id: sub(2, 5), version: 5, status: "validating", error: null, violations: [], createdAt: hoursAgo(0.1) },
    {
      id: sub(2, 4),
      version: 4,
      status: "rejected",
      error: "Your bot imports a module that isn't allowed.",
      violations: [
        { line: 3, kind: "import", detail: "import socket is not allowed" },
        { line: 41, kind: "call", detail: "open() is not allowed" },
      ],
      createdAt: hoursAgo(5),
    },
    { id: sub(2, 3), version: 3, status: "active", error: null, violations: [], createdAt: hoursAgo(26) },
    { id: sub(2, 2), version: 2, status: "superseded", error: null, violations: [], createdAt: hoursAgo(70) },
    { id: sub(2, 1), version: 1, status: "superseded", error: null, violations: [], createdAt: hoursAgo(120) },
  ],
  [bot(3)]: [{ id: sub(3, 1), version: 1, status: "active", error: null, violations: [], createdAt: hoursAgo(48) }],
};

const HOUSE = ["house_greedy_1", "house_safe_expander_1", "house_hunter", "house_greedy_2", "house_random"];
const PLAYERS = ["snake_eater", "territory_tom", "grid_witch", "a_very_long_bot_name_that_keeps_going"];

// Small seeded PRNG (mulberry32) so the history is stable across reloads.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function history(b: number, versions: number[], perVersion: number, skill: number[]): SeatRow[] {
  const rand = rng(b * 97);
  const rows: SeatRow[] = [];
  let elo = 1500;
  let matchId = 4000 + b * 300;
  versions.forEach((v, vi) => {
    for (let i = 0; i < perVersion; i++) {
      matchId += 1 + Math.floor(rand() * 6);
      const roll = rand() + skill[vi];
      const placement = roll > 1.1 ? 1 : roll > 0.85 ? 2 : roll > 0.6 ? 3 : roll > 0.35 ? 4 : 5;
      const crashed = placement === 5 && rand() < 0.3;
      const delta = Math.round((3 - placement) * 9 + (rand() - 0.5) * 6);
      const pool = [...HOUSE, ...PLAYERS].sort(() => rand() - 0.5).slice(0, 4);
      const places = [1, 2, 3, 4, 5].filter((p) => p !== placement);
      rows.push({
        matchId,
        finishedAt: hoursAgo((versions.length - vi) * 30 - i * 0.25),
        submissionId: sub(b, v),
        version: v,
        placement,
        coverage: crashed ? 0.02 : Math.max(0.03, 0.42 - placement * 0.07 + rand() * 0.05),
        crashed,
        eloBefore: elo,
        eloAfter: elo + delta,
        opponents: pool.map((name, k) => ({ name, isHouse: name.startsWith("house_"), placement: places[k] })),
      });
      elo += delta;
    }
  });
  return rows;
}

const HISTORY: Record<string, SeatRow[]> = {
  [bot(2)]: history(2, [1, 2, 3], 14, [-0.15, 0.05, 0.25]),
  [bot(3)]: history(3, [1], 6, [0.1]),
};

const NOTIFICATIONS: Record<DevPersona, Notification[]> = {
  newcomer: [],
  player: [
    { id: 5, kind: "submission_rejected", payload: { version: 4, error: "Your bot imports a module that isn't allowed." }, createdAt: hoursAgo(5), readAt: null },
    { id: 4, kind: "first_match", payload: { match_id: 9, placement: 2 }, createdAt: hoursAgo(25), readAt: null },
    { id: 3, kind: "submission_passed", payload: { version: 3 }, createdAt: hoursAgo(26), readAt: hoursAgo(20) },
    { id: 2, kind: "submission_passed", payload: { version: 2 }, createdAt: hoursAgo(70), readAt: hoursAgo(60) },
  ],
  banned: [{ id: 7, kind: "submission_passed", payload: { version: 1 }, createdAt: hoursAgo(48), readAt: null }],
  organiser: [],
};

export const devBot = (p: DevPersona) => BOTS[p];
export const devNotifications = (p: DevPersona) => NOTIFICATIONS[p];
export const isDevBotId = (id: string) => devAuthEnabled() && id in SUBMISSIONS;
export const devSubmissions = (botId: string) => SUBMISSIONS[botId] ?? [];
export const devHistory = (botId: string) => HISTORY[botId] ?? [];

// The player's v5 is mid-check; there is no real job behind it.
const PROGRESS: Record<string, CheckProgress> = {
  [sub(2, 5)]: { stage: "checking", ahead: null, attempts: 1, maxAttempts: 3 },
};

export const isDevSubmissionId = (id: string) => devAuthEnabled() && Object.values(SUBMISSIONS).some((l) => l.some((s) => s.id === id));
export const devCheckProgress = (id: string) => PROGRESS[id] ?? null;
