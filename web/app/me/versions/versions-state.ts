// Pure helpers for /me/versions, so they are unit-tested.
import type { SubmissionStatus } from "@/features/ladder/queries";

// A version still being checked changes on its own, so the page listens for it.
export const hasChecking = (subs: { status: SubmissionStatus }[]): boolean =>
  subs.some((s) => s.status === "pending" || s.status === "validating");

// The list is capped; say so when the cap is reached, since older versions are then hidden.
export const capNote = (count: number, limit: number): string | null =>
  count >= limit ? `Showing the latest ${limit}.` : null;
