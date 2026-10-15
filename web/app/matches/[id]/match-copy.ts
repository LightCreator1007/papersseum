// Plain-words copy for the match page. Pure, so it is unit-tested.

// matches.error is written by internal.mark_job_failed: the worker's
// "ExceptionType: message", or "Worker stopped responding" when the lease ran
// out after the last retry. Players get the cause in plain words; the raw text
// stays available for the organisers.
const REASONS: [RegExp, string][] = [
  [/stopped responding/i, "The match server stopped responding, and every retry ran out."],
  [/sandbox|docker/i, "The match server couldn't start the sandbox the bots run in."],
  [/sha256|download|storage/i, "A bot's file couldn't be downloaded intact."],
  [/operationalerror|connection|timed? ?out|timeout/i, "The match server lost its connection to the database."],
  [/engine.?hash/i, "The match server was running a different engine version from the arena's."],
];

export type FailureReason = { summary: string; raw: string | null };

export function failureReason(error: string | null | undefined): FailureReason {
  const raw = error?.trim() || null;
  if (!raw) return { summary: "No reason was recorded.", raw: null };
  const match = REASONS.find(([pattern]) => pattern.test(raw));
  return { summary: match ? match[1] : "The match server hit an error it couldn't recover from.", raw };
}

// The bots in a match are drawn from bots that aren't banned, so a banned bot
// still waiting to play was banned after the draw.
export function bannedNote(status: string, banned: boolean): string | null {
  if (!banned) return null;
  return status === "queued" || status === "running" ? "Banned after this match was drawn." : "Banned since this match.";
}

export const versionLabel = (version: number | null): string | null => (version === null ? null : `v${version}`);
