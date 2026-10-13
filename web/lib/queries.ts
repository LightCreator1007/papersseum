import "server-only";
import { createClient } from "@/lib/supabase/server";
import { intervalMinutes } from "@/lib/format";
import type { Database } from "@/lib/database.types";

// Every read throws on failure so the nearest <LoadBoundary> shows
// "Couldn't load …". Details go to the server log only.
//
// These are generic over the whole response (R) rather than its data (T):
// with `Result<T>`, passing `await supabase.from(...).single()` inline made
// TypeScript infer the query's row type from the helper's `T | null`, so the
// row came back typed as possibly null (or never for `.maybeSingle()`).
type Result = { data: unknown; error: { message: string } | null };

function fail(what: string, error: unknown): never {
  console.error(`query failed: ${what}`, error);
  throw new Error(`Couldn't load ${what}`);
}

// For list and .single() reads: data must be there.
export function check<R extends Result>(what: string, res: R): NonNullable<R["data"]> {
  if (res.error || res.data === null) fail(what, res.error ?? "no data");
  return res.data as NonNullable<R["data"]>;
}

// For .maybeSingle() and count-only reads, where no data is a valid answer.
export function checkMaybe<R extends Result>(what: string, res: R): R["data"] {
  if (res.error) fail(what, res.error);
  return res.data;
}

export type Season = {
  name: string;
  frozen: boolean;
  engineHash: string | null;
  domain: string | null;
  cooldownMinutes: number;
};

export async function getSeason(): Promise<Season> {
  const supabase = await createClient();
  const row = check(
    "the season",
    await supabase
      .from("season")
      .select("name, frozen, engine_hash, allowed_email_domain, submission_cooldown")
      .eq("id", 1)
      .single(),
  );
  return {
    name: row.name,
    frozen: row.frozen,
    engineHash: row.engine_hash,
    domain: row.allowed_email_domain,
    cooldownMinutes: intervalMinutes(String(row.submission_cooldown)),
  };
}

export async function getProfileHandle(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const row = checkMaybe("your profile", await supabase.from("profiles").select("handle").eq("id", userId).maybeSingle());
  return row?.handle ?? null;
}

export type MatchStatus = Database["public"]["Enums"]["match_status"];
export type SubmissionStatus = Database["public"]["Enums"]["submission_status"];

export type LeaderRow = {
  rank: number;
  botId: string;
  name: string;
  owner: string | null;
  isHouse: boolean;
  rating: number;
  elo: number;
  sigma: number;
  games: number;
  version: number | null;
};

export async function getLeaderboard(limit?: number): Promise<LeaderRow[]> {
  const supabase = await createClient();
  let query = supabase.from("leaderboard").select("*").order("rank").order("name");
  if (limit) query = query.limit(limit);
  const rows = check("the leaderboard", await query);
  return rows.map((r) => ({
    rank: r.rank ?? 0,
    botId: r.bot_id!,
    name: r.name!,
    owner: r.is_house ? null : r.handle,
    isHouse: !!r.is_house,
    rating: r.conservative ?? 0,
    elo: r.elo ?? 0,
    sigma: r.sigma ?? 0,
    games: r.games ?? 0,
    version: r.active_version,
  }));
}

export async function getLadderStats(): Promise<{ bots: number; matches: number }> {
  const supabase = await createClient();
  const [bots, matches] = await Promise.all([
    supabase.from("leaderboard").select("bot_id", { count: "exact", head: true }),
    supabase.from("matches").select("id", { count: "exact", head: true }).eq("status", "done"),
  ]);
  checkMaybe("ladder stats", bots);
  checkMaybe("ladder stats", matches);
  return { bots: bots.count ?? 0, matches: matches.count ?? 0 };
}

export type SeatSummary = { slot: number; name: string | null; placement: number | null; crashed: boolean | null };

export type MatchSummary = {
  id: number;
  roundId: number;
  status: MatchStatus;
  createdAt: string;
  finishedAt: string | null;
  seats: SeatSummary[];
};

export async function getMatches({
  page,
  pageSize,
  finishedOnly = false,
}: {
  page: number;
  pageSize: number;
  finishedOnly?: boolean;
}) {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  let query = supabase
    .from("matches")
    .select("id, round_id, status, created_at, finished_at, match_players(slot, placement, crashed, bots(name))");
  if (finishedOnly) query = query.eq("status", "done");
  const rows = check(
    "matches",
    await query.order("id", { ascending: false }).range(from, from + pageSize), // one extra row tells us whether there is another page
  );
  const matches: MatchSummary[] = rows.slice(0, pageSize).map((m) => ({
    id: m.id,
    roundId: m.round_id,
    status: m.status,
    createdAt: m.created_at,
    finishedAt: m.finished_at,
    seats: m.match_players
      .map((p) => ({ slot: p.slot, name: p.bots?.name ?? null, placement: p.placement, crashed: p.crashed }))
      .sort((a, b) => (a.placement ?? 9) - (b.placement ?? 9) || a.slot - b.slot),
  }));
  return { matches, hasMore: rows.length > pageSize };
}

export type SeatResult = {
  slot: number;
  name: string | null;
  isHouse: boolean;
  placement: number | null;
  coverage: number | null;
  deaths: number | null;
  strikes: number | null;
  crashed: boolean | null;
  eloBefore: number | null;
  eloAfter: number | null;
};

export type MatchDetail = {
  id: number;
  roundId: number;
  seed: number;
  status: MatchStatus;
  error: string | null;
  replayPath: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  seats: SeatResult[];
};

export async function getMatch(id: number): Promise<MatchDetail | null> {
  const supabase = await createClient();
  const m = checkMaybe(
    "this match",
    await supabase
      .from("matches")
      .select("id, round_id, seed, status, error, replay_path, created_at, started_at, finished_at, match_players(slot, placement, coverage, deaths, strikes, crashed, elo_before, elo_after, bots(name, is_house))")
      .eq("id", id)
      .maybeSingle(),
  );
  if (!m) return null;
  return {
    id: m.id,
    roundId: m.round_id,
    seed: Number(m.seed),
    status: m.status,
    error: m.error,
    replayPath: m.replay_path,
    createdAt: m.created_at,
    startedAt: m.started_at,
    finishedAt: m.finished_at,
    seats: m.match_players
      .map((p) => ({
        slot: p.slot,
        name: p.bots?.name ?? null,
        isHouse: !!p.bots?.is_house,
        placement: p.placement,
        coverage: p.coverage,
        deaths: p.deaths,
        strikes: p.strikes,
        crashed: p.crashed,
        eloBefore: p.elo_before,
        eloAfter: p.elo_after,
      }))
      .sort((a, b) => (a.placement ?? 9) - (b.placement ?? 9) || a.slot - b.slot),
  };
}

export function replayUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/replays/${encodeURIComponent(path)}`;
}

export type BotProfile = {
  id: string;
  name: string;
  owner: string | null;
  isHouse: boolean;
  banned: boolean;
  elo: number;
  games: number;
  activeVersion: number | null;
  activeSince: string | null;
  rank: number | null;
  rating: number | null;
  sigma: number | null;
};

export async function getBot(name: string): Promise<BotProfile | null> {
  const supabase = await createClient();
  const bot = checkMaybe(
    "this bot",
    await supabase
      .from("bots")
      .select("id, name, is_house, banned, elo, games, active_version, active_since, profiles(handle)")
      .eq("name", name)
      .maybeSingle(),
  );
  if (!bot) return null;
  const ladder = checkMaybe(
    "this bot's rank",
    await supabase.from("leaderboard").select("rank, conservative, sigma").eq("bot_id", bot.id).maybeSingle(),
  );
  return {
    id: bot.id,
    name: bot.name,
    owner: bot.profiles?.handle ?? null,
    isHouse: bot.is_house,
    banned: bot.banned,
    elo: bot.elo,
    games: bot.games,
    activeVersion: bot.active_version,
    activeSince: bot.active_since,
    rank: ladder?.rank ?? null,
    rating: ladder?.conservative ?? null,
    sigma: ladder?.sigma ?? null,
  };
}

export type HistoryRow = {
  matchId: number;
  finishedAt: string | null;
  placement: number | null;
  coverage: number | null;
  eloBefore: number | null;
  eloAfter: number | null;
};

// Newest first.
export async function getBotHistory(botId: string, limit: number): Promise<HistoryRow[]> {
  const supabase = await createClient();
  const rows = check(
    "this bot's matches",
    await supabase
      .from("match_players")
      .select("match_id, placement, coverage, elo_before, elo_after, matches!inner(status, finished_at)")
      .eq("bot_id", botId)
      .eq("matches.status", "done")
      .order("match_id", { ascending: false })
      .limit(limit),
  );
  return rows.map((r) => ({
    matchId: r.match_id,
    finishedAt: r.matches.finished_at,
    placement: r.placement,
    coverage: r.coverage,
    eloBefore: r.elo_before,
    eloAfter: r.elo_after,
  }));
}

export type MyBot = { id: string; name: string; banned: boolean; activeVersion: number | null; rank: number | null };

export async function getMyBot(userId: string): Promise<MyBot | null> {
  const supabase = await createClient();
  const bot = checkMaybe(
    "your bot",
    await supabase.from("bots").select("id, name, banned, active_version").eq("owner_id", userId).maybeSingle(),
  );
  if (!bot) return null;
  const ladder = checkMaybe(
    "your rank",
    await supabase.from("leaderboard").select("rank").eq("bot_id", bot.id).maybeSingle(),
  );
  return { id: bot.id, name: bot.name, banned: bot.banned, activeVersion: bot.active_version, rank: ladder?.rank ?? null };
}

export type Violation = { line: number; kind: string; detail: string };

export type MySubmission = {
  id: string;
  version: number;
  status: SubmissionStatus;
  error: string | null;
  violations: Violation[];
  createdAt: string;
};

// Row-level security returns only the signed-in user's own submissions.
function parseViolations(raw: unknown): Violation[] {
  if (!Array.isArray(raw)) return [];
  const out: Violation[] = [];
  for (const v of raw) {
    if (typeof v !== "object" || v === null) continue;
    const { line, kind, detail } = v as Record<string, unknown>;
    if (typeof line !== "number" || typeof detail !== "string") continue;
    out.push({ line, kind: typeof kind === "string" ? kind : "", detail });
  }
  return out;
}

export async function getMySubmissions(botId: string): Promise<MySubmission[]> {
  const supabase = await createClient();
  const rows = check(
    "your uploads",
    await supabase
      .from("submissions")
      .select("id, version, status, error, violations, created_at")
      .eq("bot_id", botId)
      .order("version", { ascending: false })
      .limit(50),
  );
  return rows.map((s) => ({
    id: s.id,
    version: s.version,
    status: s.status,
    error: s.error,
    violations: parseViolations(s.violations),
    createdAt: s.created_at,
  }));
}
