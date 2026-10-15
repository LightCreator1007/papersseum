import "server-only";
import { personaForUser } from "@/lib/dev-auth";
import { devBot, devCheckProgress, devSubmissions, isDevSubmissionId } from "@/lib/dev-fixtures";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/supabase/server";
import { fail, ok, type Result } from "@/lib/server/result";

// Where an upload is in the validate queue. Jobs aren't readable through row-level security,
// so this reads with the service role and returns only counts about the caller's own upload.
// Because the service role skips row-level security, ownership is checked here, not by the caller.
export type CheckProgress = {
  stage: "queued" | "checking";
  ahead: number | null; // queued validate jobs in front of this one; null once claimed
  attempts: number; // the worker retries a check that could not run, up to max_attempts
  maxAttempts: number;
};

const NOT_YOURS = "That upload isn't yours.";

function ownsDevSubmission(userId: string, submissionId: string): boolean {
  const persona = personaForUser(userId);
  const bot = persona ? devBot(persona) : null;
  return bot ? devSubmissions(bot.id).some((s) => s.id === submissionId) : false;
}

export async function loadCheckProgress(submissionId: string): Promise<Result<CheckProgress | null>> {
  const userId = await getUserId();
  if (!userId) return fail("forbidden", "Sign in to see your upload.");
  if (isDevSubmissionId(submissionId)) {
    return ownsDevSubmission(userId, submissionId) ? ok(devCheckProgress(submissionId)) : fail("forbidden", NOT_YOURS);
  }
  try {
    const db = createAdminClient();
    const bot = await db.from("bots").select("id").eq("owner_id", userId).maybeSingle();
    if (bot.error) return fail("error", bot.error.message);
    if (!bot.data) return fail("forbidden", NOT_YOURS);
    const own = await db.from("submissions").select("id").eq("id", submissionId).eq("bot_id", bot.data.id).maybeSingle();
    if (own.error) return fail("error", own.error.message);
    if (!own.data) return fail("forbidden", NOT_YOURS);

    const job = await db
      .from("jobs")
      .select("id, status, attempts, max_attempts")
      .eq("kind", "validate")
      .eq("submission_id", submissionId)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (job.error) return fail("error", job.error.message);
    if (!job.data || (job.data.status !== "queued" && job.data.status !== "running")) return ok(null);

    const base = { attempts: job.data.attempts, maxAttempts: job.data.max_attempts };
    if (job.data.status === "running") return ok({ stage: "checking", ahead: null, ...base });

    const ahead = await db
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("kind", "validate")
      .eq("status", "queued")
      .lt("id", job.data.id);
    if (ahead.error) return fail("error", ahead.error.message);
    return ok({ stage: "queued", ahead: ahead.count ?? 0, ...base });
  } catch (e) {
    return fail("error", e instanceof Error ? e.message : "Could not read the check queue.");
  }
}
