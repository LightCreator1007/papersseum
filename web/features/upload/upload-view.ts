// What the upload module on /me shows, worked out from data the page already loads.
// The database still decides every upload (api_create_submission); this only picks the copy.

type Sub = { version: number; status: string; createdAt: string };

export type UploadView<S extends Sub> = {
  /** The version number the next upload gets: one past the highest, like the database. */
  next: number;
  /** The newest upload while it's still being checked. */
  checking: S | null;
  /** The newest upload, when it was rejected, so its reason leads. */
  rejected: S | null;
  /** When the cooldown from the newest upload ends, or null if there's none to wait out. */
  nextUploadAt: string | null;
  closed: "banned" | "frozen" | null;
};

export function uploadView<S extends Sub>(
  subs: S[],
  { banned, frozen, cooldownMinutes }: { banned: boolean; frozen: boolean; cooldownMinutes: number },
): UploadView<S> {
  let newest: S | null = null;
  for (const s of subs) if (newest === null || s.version > newest.version) newest = s;
  const checking = newest && (newest.status === "pending" || newest.status === "validating") ? newest : null;
  const at = newest ? Date.parse(newest.createdAt) : NaN;
  return {
    next: (newest?.version ?? 0) + 1,
    checking,
    rejected: newest?.status === "rejected" ? newest : null,
    nextUploadAt: Number.isFinite(at) && cooldownMinutes > 0 ? new Date(at + cooldownMinutes * 60_000).toISOString() : null,
    closed: banned ? "banned" : frozen ? "frozen" : null,
  };
}

export function cooldownLeft(nextUploadAt: string | null, now: number): number {
  if (!nextUploadAt) return 0;
  const at = Date.parse(nextUploadAt);
  return Number.isFinite(at) ? Math.max(0, at - now) : 0;
}

/** 7:05 under an hour, then 1 h 5 min. Rounds up so it never reads 0:00 while still waiting. */
export function countdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 3600) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
}
