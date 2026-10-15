import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type Result } from "@/lib/server/result";

export const PAUSED_AFTER_MS = 300_000;
export const ROUND_EVERY_MS = 900_000;
export const ROUND_GRACE_MS = 120_000;

export type WorkerState = "running" | "idle" | "paused" | "unknown";
export type SkipReason = "frozen" | "backlog" | "no-players" | "unknown";
export type ArenaStatus = {
  worker: WorkerState;
  lastSeenAt: string | null;
  queued: number;
  running: number;
  lastRoundAt: string | null;
  nextRoundAt: string;
  skipped: { reason: SkipReason; since: string } | null;
  checkedAt: string;
};
export type StatusInput = {
  lastSeenAt: string | null;
  queued: number;
  running: number;
  lastRoundAt: string | null;
  frozen: boolean;
  maxBacklog: number;
  activePlayers: number;
};

const nextBoundary = (t: number) => (Math.floor(t / ROUND_EVERY_MS) + 1) * ROUND_EVERY_MS;

export function deriveArenaStatus(i: StatusInput, now: Date): ArenaStatus {
  const t = now.getTime();
  let worker: WorkerState = "unknown";
  if (i.lastSeenAt) {
    const age = t - Date.parse(i.lastSeenAt);
    worker = age > PAUSED_AFTER_MS ? "paused" : i.running > 0 ? "running" : "idle";
  }

  let skipped: ArenaStatus["skipped"] = null;
  if (i.lastRoundAt) {
    const missedAt = nextBoundary(Date.parse(i.lastRoundAt));
    if (t > missedAt + ROUND_GRACE_MS) {
      const reason: SkipReason = i.frozen ? "frozen"
        : i.queued + i.running >= i.maxBacklog ? "backlog"
        : i.activePlayers === 0 ? "no-players"
        : "unknown";
      skipped = { reason, since: new Date(missedAt).toISOString() };
    }
  }

  return {
    worker,
    lastSeenAt: i.lastSeenAt,
    queued: i.queued,
    running: i.running,
    lastRoundAt: i.lastRoundAt,
    nextRoundAt: new Date(nextBoundary(t)).toISOString(),
    skipped,
    checkedAt: now.toISOString(),
  };
}

export async function loadArenaStatus(): Promise<Result<ArenaStatus>> {
  try {
    const db = createAdminClient();
    const [worker, queued, running, round, season, players] = await Promise.all([
      db.from("workers").select("last_seen").order("last_seen", { ascending: false }).limit(1).maybeSingle(),
      db.from("jobs").select("id", { count: "exact", head: true }).eq("kind", "match").eq("status", "queued"),
      db.from("jobs").select("id", { count: "exact", head: true }).eq("kind", "match").eq("status", "running"),
      db.from("rounds").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      db.from("season").select("frozen, max_backlog").limit(1).single(),
      db.from("bots").select("id", { count: "exact", head: true })
        .eq("is_house", false).eq("banned", false).not("active_submission_id", "is", null),
    ]);
    const firstError = [worker, queued, running, round, season, players].find((r) => r.error)?.error;
    if (firstError || !season.data) {
      console.error("status: read failed", firstError ?? "no season row");
      return fail("error", "Couldn't read the arena status.");
    }
    return ok(deriveArenaStatus({
      lastSeenAt: worker.data?.last_seen ?? null,
      queued: queued.count ?? 0,
      running: running.count ?? 0,
      lastRoundAt: round.data?.created_at ?? null,
      frozen: season.data.frozen,
      maxBacklog: season.data.max_backlog,
      activePlayers: players.count ?? 0,
    }, new Date()));
  } catch (e) {
    console.error("status: threw", e);
    return fail("error", "Couldn't read the arena status.");
  }
}
