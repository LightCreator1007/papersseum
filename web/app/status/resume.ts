import type { ArenaStatus } from "@/lib/server/arena-status";

type ResumeInput = Pick<ArenaStatus, "worker" | "skipped" | "queued" | "running">;

export function workerDown(s: Pick<ArenaStatus, "worker">): boolean {
  return s.worker === "paused" || s.worker === "unknown";
}

// When matches come back, said only as far as the data knows. A paused worker has no
// expected return, so the page promises an update rather than inventing a time.
export function resumeText(s: ResumeInput): string | null {
  if (workerDown(s)) return "We'll post here when they're back.";
  if (s.skipped?.reason === "backlog") {
    const left = s.queued + s.running;
    return `They resume once the queue clears (${left} ${left === 1 ? "match" : "matches"} left).`;
  }
  if (s.skipped?.reason === "unknown") return "We'll post here when they're back.";
  return null;
}
