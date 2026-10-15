import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

type Reply = { data: unknown; error: { code?: string } | null };
const replies = vi.hoisted(() => ({ admins: null as unknown, bots: null as unknown, jobs: null as unknown }));
const from = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: "admins" | "bots" | "jobs") => {
      from(table);
      const reply = replies[table] as Reply;
      const builder: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order", "limit"]) builder[m] = () => builder;
      builder.maybeSingle = async () => reply;
      builder.then = (resolve: (v: Reply) => unknown) => resolve(reply);
      return builder;
    },
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ getUserId: vi.fn(async () => "u1") }));
import { getUserId } from "@/lib/supabase/server";
import { listBotsForAdmin, listFailedJobs } from "@/lib/server/admin";

const adminRow = { data: { user_id: "u1" }, error: null };

beforeEach(() => {
  from.mockReset();
  replies.admins = adminRow;
  replies.bots = { data: [], error: null };
  replies.jobs = { data: [], error: null };
});

describe("listBotsForAdmin", () => {
  it("refuses a non-admin and never reads bots", async () => {
    replies.admins = { data: null, error: null };
    expect(await listBotsForAdmin()).toMatchObject({ ok: false, reason: "forbidden" });
    expect(from).not.toHaveBeenCalledWith("bots");
  });
  it("refuses a signed-out visitor and runs no query", async () => {
    vi.mocked(getUserId).mockResolvedValueOnce(null);
    expect(await listBotsForAdmin()).toMatchObject({ ok: false, reason: "forbidden" });
    expect(from).not.toHaveBeenCalled();
  });
  it("returns exactly the AdminBot keys, dropping any extra column", async () => {
    replies.bots = {
      data: [{
        id: "b1", name: "neo", is_house: false, banned: false, elo: 1510, games: 4, active_version: 2,
        owner_id: "secret-owner", created_at: "2026-10-15T00:00:00Z",
      }],
      error: null,
    };
    const r = await listBotsForAdmin();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.keys(r.data[0]).sort()).toEqual(["activeVersion", "banned", "elo", "games", "id", "isHouse", "name"]);
    expect(r.data[0]).toEqual({ id: "b1", name: "neo", isHouse: false, banned: false, elo: 1510, games: 4, activeVersion: 2 });
  });
  it("returns an error and logs when the read fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    replies.bots = { data: null, error: { code: "XX000" } };
    expect(await listBotsForAdmin()).toMatchObject({ ok: false, reason: "error" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("listFailedJobs", () => {
  it("refuses a non-admin and never reads jobs", async () => {
    replies.admins = { data: null, error: null };
    expect(await listFailedJobs()).toMatchObject({ ok: false, reason: "forbidden" });
    expect(from).not.toHaveBeenCalledWith("jobs");
  });
  it("returns exactly the FailedJob keys, dropping any extra column", async () => {
    replies.jobs = {
      data: [{
        id: 7, kind: "match", match_id: 3, submission_id: null, last_error: "boom", attempts: 2,
        created_at: "2026-10-15T10:00:00Z", finished_at: "2026-10-15T10:05:00Z", worker_id: "w1", lease_until: null,
      }],
      error: null,
    };
    const r = await listFailedJobs();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.keys(r.data[0]).sort()).toEqual(["attempts", "error", "id", "kind", "matchId", "submissionId", "updatedAt"]);
    expect(r.data[0].updatedAt).toBe("2026-10-15T10:05:00Z");
  });
  it("falls back to created_at when a job has no finish time", async () => {
    replies.jobs = {
      data: [{ id: 8, kind: "validate", match_id: null, submission_id: "s1", last_error: null, attempts: 1, created_at: "2026-10-15T10:00:00Z", finished_at: null }],
      error: null,
    };
    const r = await listFailedJobs();
    expect(r.ok && r.data[0].updatedAt).toBe("2026-10-15T10:00:00Z");
  });
  it("returns an error and logs when the read fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    replies.jobs = { data: null, error: { code: "XX000" } };
    expect(await listFailedJobs()).toMatchObject({ ok: false, reason: "error" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
