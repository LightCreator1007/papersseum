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
