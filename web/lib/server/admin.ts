import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_PERSONAS, devPersona } from "@/lib/dev-auth";
import { getUserId } from "@/lib/supabase/server";
import { fail, ok, type Result } from "@/lib/server/result";

export type AdminBot = {
  id: string;
  name: string;
  isHouse: boolean;
  banned: boolean;
  elo: number | null;
  games: number;
  activeVersion: number | null;
};

export type FailedJob = {
  id: number;
  kind: "validate" | "match";
  matchId: number | null;
  submissionId: string | null;
  error: string | null;
  attempts: number;
  updatedAt: string;
};

export type AdminWorker = {
  id: string;
  version: string | null;
  engineHash: string | null;
  lastSeen: string;
  currentJob: number | null;
};

export type AdminSeason = { name: string; frozen: boolean; engineHash: string | null };

export async function requireAdmin(): Promise<Result<{ userId: string }>> {
  // Dev login: the organiser persona is an organiser, the others aren't, and neither asks
  // the database, whose admins table has never heard of these ids.
  const persona = await devPersona();
  if (persona) {
    return persona === "organiser" ? ok({ userId: DEV_PERSONAS.organiser.userId }) : fail("forbidden", "Only organisers can do that.");
  }
  const userId = await getUserId();
  if (!userId) return fail("forbidden", "Sign in as an organiser to do that.");
  const { data, error } = await createAdminClient().from("admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (error) {
    console.error("admin: lookup failed", error);
    return fail("error", "Couldn't check organiser access. Try again in a minute.");
  }
  return data ? ok({ userId }) : fail("forbidden", "Only organisers can do that.");
}

export async function listBotsForAdmin(): Promise<Result<AdminBot[]>> {
  const who = await requireAdmin();
  if (!who.ok) return who;
  const { data, error } = await createAdminClient()
    .from("bots")
    .select("id, name, is_house, banned, elo, games, active_version")
    .order("name", { ascending: true });
  if (error) {
    console.error("admin: bots read failed", error);
    return fail("error", "Couldn't load the bots.");
  }
  return ok(data.map((b) => ({
    id: b.id,
    name: b.name,
    isHouse: b.is_house,
    banned: b.banned,
    elo: b.elo,
    games: b.games,
    activeVersion: b.active_version,
  })));
}

export async function listFailedJobs(limit = 50): Promise<Result<FailedJob[]>> {
  const who = await requireAdmin();
  if (!who.ok) return who;
  const { data, error } = await createAdminClient()
    .from("jobs")
    .select("id, kind, match_id, submission_id, last_error, attempts, created_at, finished_at")
    .eq("status", "failed")
    .order("id", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("admin: failed jobs read failed", error);
    return fail("error", "Couldn't load the failed jobs.");
  }
  return ok(data.map((j) => ({
    id: j.id,
    kind: j.kind,
    matchId: j.match_id,
    submissionId: j.submission_id,
    error: j.last_error,
    attempts: j.attempts,
    updatedAt: j.finished_at ?? j.created_at,
  })));
}

export async function listWorkersForAdmin(): Promise<Result<AdminWorker[]>> {
  const who = await requireAdmin();
  if (!who.ok) return who;
  const { data, error } = await createAdminClient()
    .from("workers")
    .select("id, version, engine_hash, last_seen, current_job")
    .order("last_seen", { ascending: false });
  if (error) {
    console.error("admin: workers read failed", error);
    return fail("error", "Couldn't load the workers.");
  }
  return ok(data.map((w) => ({
    id: w.id,
    version: w.version,
    engineHash: w.engine_hash,
    lastSeen: w.last_seen,
    currentJob: w.current_job,
  })));
}

export async function loadSeasonForAdmin(): Promise<Result<AdminSeason>> {
  const who = await requireAdmin();
  if (!who.ok) return who;
  const { data, error } = await createAdminClient().from("season").select("name, frozen, engine_hash").limit(1).single();
  if (error || !data) {
    console.error("admin: season read failed", error);
    return fail("error", "Couldn't load the season.");
  }
  return ok({ name: data.name, frozen: data.frozen, engineHash: data.engine_hash });
}
