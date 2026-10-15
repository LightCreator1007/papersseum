import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { adminWarnings } from "@/app/admin/warnings";
import type { AdminBot, AdminWorker } from "@/lib/server/admin";

const NOW = Date.parse("2026-10-15T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const house: AdminBot = { id: "h", name: "greedy", isHouse: true, banned: false, elo: 300, games: 40, activeVersion: 1 };
const worker = (o: Partial<AdminWorker> = {}): AdminWorker => ({ id: "vm-1", version: "0.6.1", engineHash: "abc", lastSeen: ago(10_000), currentJob: null, ...o });
const season = { name: "Season 1", frozen: false, engineHash: "abc" };
const titles = (input: Partial<Parameters<typeof adminWarnings>[0]>) =>
  adminWarnings({ bots: [house], workers: [worker()], failed: [], season, ...input }, NOW).map((w) => w.title);

describe("adminWarnings", () => {
  it("is empty when everything is healthy", () => {
    expect(titles({})).toEqual([]);
  });
  it("flags a season with no worker at all", () => {
    expect(titles({ workers: [] })).toContain("No worker has ever checked in");
  });
  it("flags workers that have all gone quiet, but not one quiet worker among live ones", () => {
    expect(titles({ workers: [worker({ lastSeen: ago(600_000) })] })).toContain("Every worker is quiet");
    expect(titles({ workers: [worker({ lastSeen: ago(600_000) }), worker({ id: "vm-2" })] })).not.toContain("Every worker is quiet");
  });
  it("names each worker on a different engine", () => {
    expect(titles({ workers: [worker({ id: "vm-9", engineHash: "zzz" })] })).toContain("vm-9 runs a different engine");
  });
  it("ignores engine hashes while the season has none", () => {
    expect(titles({ season: { ...season, engineHash: null }, workers: [worker({ engineHash: "zzz" })] })).toEqual([]);
  });
  it("flags missing house bots, and house bots with nothing to play", () => {
    expect(titles({ bots: [] })).toContain("No house bots");
    expect(titles({ bots: [{ ...house, banned: true }] })).toContain("No house bots");
    expect(titles({ bots: [{ ...house, activeVersion: null }] })).toContain("No house bot has a passing version");
  });
  it("counts failed jobs in the title", () => {
    const job = { id: 1, kind: "match" as const, matchId: 3, submissionId: null, error: "boom", attempts: 3, updatedAt: ago(1000) };
    expect(titles({ failed: [job] })).toContain("1 failed job");
    expect(titles({ failed: [job, { ...job, id: 2 }] })).toContain("2 failed jobs");
  });
  it("says when uploads are frozen", () => {
    expect(titles({ season: { ...season, frozen: true } })).toContain("Uploads are frozen");
  });
});
