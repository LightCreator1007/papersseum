import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { intervalMinutes } from "@/features/ladder/format";
import { sortLadder } from "@/features/ladder/ladder-order";
import type { Database } from "@/lib/supabase/database.types";
import type { SeasonDates } from "@/lib/season-phase";
import type { SeatRow } from "@/lib/stats/scorecards";
import type { Notification } from "@/lib/notifications";
import { callRpc } from "@/lib/server/rpc";
import { parseGenome, type BotGenome } from "@/lib/character/genome";
import { DEV_PERSONAS, devPersona, personaForUser } from "@/lib/dev-auth";
import { devBot, devHistory, devNotifications, devSubmissions, isDevBotId } from "@/lib/dev-fixtures";

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

// A8: once opens_at, closes_at and final_at ship and database.types.ts is regenerated,
// add them to this select and map them to opensAt, closesAt and finalAt.
export async function getSeasonDates(): Promise<SeasonDates> {
  const supabase = await createClient();
  const row = check("the season dates", await supabase.from("season").select("frozen").eq("id", 1).single());
  return { opensAt: null, closesAt: null, finalAt: null, frozen: row.frozen };
}

// The owner name: the person's Google account name, or null if the account has none.
export async function getProfileName(userId: string): Promise<string | null> {
  const persona = personaForUser(userId);
  if (persona) return DEV_PERSONAS[persona].name;
  const supabase = await createClient();
  const row = checkMaybe("your profile", await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle());
  return row?.display_name ?? null;
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
  activeSince: string | null;
  // The character saved in the Bot Forge, or null to draw the one the name seeds.
  appearance: BotGenome | null;
};

// Ties (equal rank) go to more games, then the older bot, then name. The database orders the
// same way so a `limit` cuts at the right row; sortLadder keeps it true whatever the driver does.
export async function getLeaderboard(limit?: number): Promise<LeaderRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("leaderboard")
    .select("*")
    .order("rank")
    .order("games", { ascending: false })
    .order("active_since", { ascending: true, nullsFirst: false })
    .order("name");
  if (limit) query = query.limit(limit);
  const rows = check("the leaderboard", await query);
  return sortLadder(rows.map((r) => ({
    rank: r.rank ?? 0,
    botId: r.bot_id!,
    name: r.name!,
    owner: r.is_house ? null : r.owner_name,
    isHouse: !!r.is_house,
    rating: r.conservative ?? 0,
    elo: r.elo ?? 0,
    sigma: r.sigma ?? 0,
    games: r.games ?? 0,
    version: r.active_version,
    activeSince: r.active_since,
    appearance: parseGenome(r.appearance),
  })));
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

export type SeatSummary = {
  slot: number;
  name: string | null;
  isHouse: boolean;
  placement: number | null;
  coverage: number | null;
  crashed: boolean | null;
  appearance: BotGenome | null;
};

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
    .select("id, round_id, status, created_at, finished_at, match_players(slot, placement, coverage, crashed, bots(name, is_house, appearance))");
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
      .map((p) => ({
        slot: p.slot,
        name: p.bots?.name ?? null,
        isHouse: p.bots?.is_house ?? false,
        placement: p.placement,
        coverage: p.coverage,
        crashed: p.crashed,
        appearance: parseGenome(p.bots?.appearance),
      }))
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
  version: number | null;
  banned: boolean;
  appearance: BotGenome | null;
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
      .select("id, round_id, seed, status, error, replay_path, created_at, started_at, finished_at, match_players(slot, submission_id, placement, coverage, deaths, strikes, crashed, elo_before, elo_after, bots(name, is_house, banned, appearance))")
      .eq("id", id)
      .maybeSingle(),
  );
  if (!m) return null;
  const versions = await seatVersions(m.match_players.map((p) => p.submission_id));
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
        version: p.submission_id ? (versions.get(p.submission_id) ?? null) : null,
        banned: !!p.bots?.banned,
        appearance: parseGenome(p.bots?.appearance),
      }))
      .sort((a, b) => (a.placement ?? 9) - (b.placement ?? 9) || a.slot - b.slot),
  };
}

// The version each seat played. Row-level security hides other players'
// submissions (anon can't read the table at all), so this reads only the
// version numbers with the server key; bots.active_version is public already.
// A failure here leaves the versions blank rather than failing the page.
async function seatVersions(ids: (string | null)[]): Promise<Map<string, number>> {
  const wanted = ids.filter((id): id is string => !!id);
  if (wanted.length === 0) return new Map();
  try {
    const { data, error } = await createAdminClient().from("submissions").select("id, version").in("id", wanted);
    if (error) throw error;
    return new Map(data.map((s) => [s.id, s.version]));
  } catch (error) {
    console.error("query failed: seat versions", error);
    return new Map();
  }
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
  appearance: BotGenome | null;
};

export async function getBot(name: string): Promise<BotProfile | null> {
  const supabase = await createClient();
  const bot = checkMaybe(
    "this bot",
    await supabase
      .from("bots")
      .select("id, name, is_house, banned, elo, games, active_version, active_since, appearance, profiles(display_name)")
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
    owner: bot.profiles ? (bot.profiles.display_name ?? "an unnamed player") : null,
    isHouse: bot.is_house,
    banned: bot.banned,
    elo: bot.elo,
    games: bot.games,
    activeVersion: bot.active_version,
    activeSince: bot.active_since,
    rank: ladder?.rank ?? null,
    rating: ladder?.conservative ?? null,
    sigma: ladder?.sigma ?? null,
    appearance: parseGenome(bot.appearance),
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

export type MyBot = {
  id: string;
  name: string;
  banned: boolean;
  activeVersion: number | null;
  rank: number | null;
  // The bot's name before this season's rename, or null if the rename is still unused.
  renamedFrom: string | null;
  appearance: BotGenome | null;
};

export async function getMyBot(userId: string): Promise<MyBot | null> {
  const persona = personaForUser(userId);
  if (persona) return devBot(persona);
  const supabase = await createClient();
  const bot = checkMaybe(
    "your bot",
    await supabase
      .from("bots")
      .select("id, name, banned, active_version, appearance, bot_name_aliases(old_name)")
      .eq("owner_id", userId)
      .maybeSingle(),
  );
  if (!bot) return null;
  const ladder = checkMaybe(
    "your rank",
    await supabase.from("leaderboard").select("rank").eq("bot_id", bot.id).maybeSingle(),
  );
  return {
    id: bot.id,
    name: bot.name,
    banned: bot.banned,
    activeVersion: bot.active_version,
    rank: ladder?.rank ?? null,
    renamedFrom: bot.bot_name_aliases[0]?.old_name ?? null,
    appearance: parseGenome(bot.appearance),
  };
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

export const MY_SUBMISSIONS_LIMIT = 50;

export async function getMySubmissions(botId: string): Promise<MySubmission[]> {
  if (isDevBotId(botId)) return devSubmissions(botId);
  const supabase = await createClient();
  const rows = check(
    "your uploads",
    await supabase
      .from("submissions")
      .select("id, version, status, error, violations, created_at")
      .eq("bot_id", botId)
      .order("version", { ascending: false })
      .limit(MY_SUBMISSIONS_LIMIT),
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

// PostgREST caps a response at max_rows (1000), so long reads page with .range().
const PAGE_SIZE = 1000;

async function readAllPages<T>(
  what: string,
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const rows = check(what, await page(from, from + PAGE_SIZE - 1));
    all.push(...rows);
    if (rows.length < PAGE_SIZE) return all;
  }
}

// Every finished match this bot played, with the other seats, oldest data first.
// Feeds versionScorecards and milestones.
export async function getSubmissionHistory(botId: string): Promise<SeatRow[]> {
  if (isDevBotId(botId)) return devHistory(botId);
  const supabase = await createClient();
  const mine = await readAllPages("this bot's matches", (from, to) =>
    supabase
      .from("match_players")
      .select("match_id, slot, submission_id, placement, coverage, crashed, elo_before, elo_after, matches!inner(status, finished_at), submissions(version)")
      .eq("bot_id", botId)
      .eq("matches.status", "done")
      .order("match_id", { ascending: true })
      .order("slot", { ascending: true })
      .range(from, to),
  );
  const seats = mine.filter((r) => r.placement !== null && r.matches.finished_at !== null);
  if (seats.length === 0) return [];

  const ids = seats.map((r) => r.match_id);
  const others = new Map<number, SeatRow["opponents"]>();
  for (let i = 0; i < ids.length; i += 200) {
    const chunkIds = ids.slice(i, i + 200);
    const chunk = await readAllPages("the other seats in this bot's matches", (from, to) =>
      supabase
        .from("match_players")
        .select("match_id, slot, placement, bots(name, is_house)")
        .in("match_id", chunkIds)
        .neq("bot_id", botId)
        .order("match_id", { ascending: true })
        .order("slot", { ascending: true })
        .range(from, to),
    );
    for (const o of chunk) {
      if (o.placement === null || !o.bots) continue;
      const list = others.get(o.match_id) ?? [];
      list.push({ name: o.bots.name, isHouse: o.bots.is_house, placement: o.placement });
      others.set(o.match_id, list);
    }
  }

  return seats.map((r) => ({
    matchId: r.match_id,
    finishedAt: r.matches.finished_at ?? "",
    submissionId: r.submission_id,
    version: r.submissions?.version ?? null,
    placement: r.placement ?? 0,
    coverage: r.coverage ?? 0,
    crashed: r.crashed ?? false,
    eloBefore: r.elo_before,
    eloAfter: r.elo_after,
    opponents: others.get(r.match_id) ?? [],
  }));
}

type NotificationRow = {
  id: number;
  kind: Notification["kind"];
  payload: Record<string, unknown> | null;
  created_at: string;
  read_at: string | null;
};

// The saved email choice for the settings checkbox. False when it was never
// saved or can't be read, which matches the database default.
export async function getEmailOptIn(): Promise<boolean> {
  if (await devPersona()) return false;
  const r = await callRpc<{ email_opt_in: boolean }[] | null>(await createClient(), "my_settings", {});
  return r.ok ? (r.data?.[0]?.email_opt_in ?? false) : false;
}

// A10: reads through my_notifications, so RLS and the 100-row cap apply.
export async function getNotifications(limit = 30): Promise<{ items: Notification[]; available: boolean; error: string | null }> {
  const persona = await devPersona();
  if (persona) return { items: devNotifications(persona).slice(0, limit), available: true, error: null };
  const r = await callRpc<NotificationRow[] | null>(await createClient(), "my_notifications", { p_limit: limit });
  if (!r.ok) {
    if (r.reason === "unavailable") return { items: [], available: false, error: null };
    console.error("notifications: read failed", r.reason, r.message);
    return { items: [], available: true, error: "Couldn't load your inbox. Try again in a minute." };
  }
  return {
    available: true,
    error: null,
    items: (r.data ?? []).map((n) => ({
      id: n.id,
      kind: n.kind,
      payload: n.payload ?? {},
      createdAt: n.created_at,
      readAt: n.read_at,
    })),
  };
}
